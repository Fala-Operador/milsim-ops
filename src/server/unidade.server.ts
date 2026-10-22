// Unidade de trabalho do monólito: toda server function de leitura ou escrita passa por aqui.
//
//  1. identifica a pessoa pela sessão do Supabase Auth (JWT verificado com getClaims);
//  2. carrega a base (RPC export_base, uma ida ao banco);
//  3. executa a regra de negócio — os serviços de src/services leem e mutam a base
//     por carregarBase()/mutarBase(), que no servidor apontam para esta requisição;
//  4. envia imagens/PDFs recebidos como data URL para o Storage;
//  5. grava as diferenças numa única transação (RPC apply_changes) com controle
//     otimista de versão — se outra escrita aconteceu no meio, repete do passo 2;
//  6. devolve o resultado e a visão atualizada para o navegador.
import "@tanstack/react-start/server-only";
import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";
import { registrarProvedorContexto, ErroDominio, type ContextoBase } from "@/services/db";
import { baseDasTabelas, calcularMudancas, objetosAlterados, type TabelasExportadas } from "@/lib/persistencia";
import { visaoParaUsuario, type Visao } from "@/lib/visao";
import { enviarMidia } from "@/server/midia";
import { recalcularProgressao } from "@/services/progressao";
import { supabaseAdmin, supabaseSessao } from "@/server/supabase.server";
import type { BaseDados, Usuario } from "@/lib/domain/types";

const armazenamento = new AsyncLocalStorage<ContextoBase>();
registrarProvedorContexto({ obter: () => armazenamento.getStore() });

const TENTATIVAS = 4;
/** Espera antes de refazer após conflito: cresce e é aleatória, para escritas simultâneas não colidirem de novo. */
const esperarConflito = (tentativa: number) =>
  new Promise((r) => setTimeout(r, (60 * 2 ** tentativa) * (0.5 + Math.random())));

export interface Contexto {
  base: BaseDados;
  /** Pessoa autenticada e ativa (null = visitante). */
  usuario: Usuario | null;
}

export interface RespostaApi<T> {
  resultado: T;
  visao: Visao;
}

/** Id (auth.users) da sessão atual, com o JWT verificado. */
export async function idDaSessao(): Promise<string | null> {
  const { data, error } = await supabaseSessao().auth.getClaims();
  if (error || !data?.claims?.sub) return null;
  return data.claims.sub;
}

// ---------- Cache da base por versão ----------
// Ler a base inteira (export_base) custa ~135 ms de CPU no banco; a versão global
// (base_control) muda a cada gravação feita por apply_changes. Cada instância do
// servidor guarda a última base lida e, por requisição, só confere a versão (consulta
// mínima); relê tudo apenas quando algo mudou. A validade curta cobre alterações feitas
// fora da aplicação (SQL manual), que não incrementam a versão.
const VALIDADE_CACHE_MS = 60_000;
let cache: { versao: number; base: BaseDados; lidoEm: number } | null = null;
let exportando: Promise<{ base: BaseDados; versao: number }> | null = null;

// Respostas que não são JSON (ex.: 521/525 da Cloudflare quando a API do Supabase oscila)
// chegam sem `message`; o status HTTP diz o que houve.
const descreverErro = (error: { message?: string; code?: string }, status: number) =>
  error.message || error.code || `HTTP ${status || "sem resposta"}`;

/** O banco (ou a rede até ele) não respondeu: 5xx ou sem resposta. Vale tentar de novo. */
class ErroIndisponivel extends Error {}

/** Falha ao falar com o banco: indisponibilidade vira ErroIndisponivel, o resto (schema, permissão) Error comum. */
const falhaBanco = (contexto: string, error: { message?: string; code?: string }, status: number) =>
  new (status === 0 || status >= 500 ? ErroIndisponivel : Error)(`${contexto}: ${descreverErro(error, status)}`);

/** Leituras são idempotentes: uma falha transitória (5xx ou rede) ganha uma nova tentativa. */
async function lerComRetentativa<R extends { error: unknown; status: number }>(ler: () => PromiseLike<R>): Promise<R> {
  const r = await ler();
  if (!r.error || (r.status > 0 && r.status < 500)) return r;
  await new Promise((ok) => setTimeout(ok, 400));
  return ler();
}

async function versaoAtual(): Promise<number> {
  const { data, error, status } = await lerComRetentativa(() =>
    supabaseAdmin().from("base_control").select("version").eq("id", 1).single(),
  );
  if (error) throw falhaBanco("Falha ao ler a versão da base", error, status);
  return Number(data.version);
}

async function exportarBase(): Promise<{ base: BaseDados; versao: number }> {
  // Requisições simultâneas na mesma instância compartilham uma única exportação.
  exportando ??= (async () => {
    try {
      const { data, error, status } = await lerComRetentativa(() => supabaseAdmin().rpc("export_base"));
      if (error) throw falhaBanco("Falha ao ler a base", error, status);
      const r = data as { version: number; tables: TabelasExportadas };
      const base = baseDasTabelas(r.tables);
      cache = { versao: r.version, base, lidoEm: Date.now() };
      return { base, versao: r.version };
    } finally {
      exportando = null;
    }
  })();
  const r = await exportando;
  return { base: structuredClone(r.base), versao: r.versao };
}

/** Cópia da base atual (cada requisição pode mutar a sua à vontade). */
async function lerBase(): Promise<{ base: BaseDados; versao: number }> {
  // Referência local: uma gravação concorrente pode invalidar `cache` durante o await.
  const emMemoria = cache;
  if (emMemoria && Date.now() - emMemoria.lidoEm < VALIDADE_CACHE_MS) {
    const versao = await versaoAtual();
    if (versao === emMemoria.versao) return { base: structuredClone(emMemoria.base), versao };
  }
  return exportarBase();
}

/** Depois de gravar, a próxima leitura busca a base nova no banco. */
function invalidarCache(): void {
  cache = null;
}

const usuarioAtivo = (base: BaseDados, id: string | null) =>
  (id && base.usuarios.find((u) => u.id === id && u.ativo)) || null;

/**
 * Erros de regra chegam ao navegador com a mensagem; os demais viram mensagem genérica,
 * com um código que também sai no log do servidor (o detalhe nunca vai ao navegador).
 * Procure o código no log do servidor (Dokploy/Lovable) para ver a causa real.
 */
export function tratarErro(e: unknown): never {
  if (e instanceof ErroDominio) throw new Error(e.message);
  const codigo = randomUUID().slice(0, 8).toUpperCase();
  console.error(`[erro ${codigo}]`, e);
  if (e instanceof ErroIndisponivel) {
    throw new Error(`O servidor de dados não respondeu. Tente novamente em instantes. (código ${codigo})`);
  }
  throw new Error(`Não foi possível concluir a operação. Tente novamente. (código ${codigo})`);
}

/**
 * Leitura: executa `fn` sobre a base atual, sem gravar nada.
 * `usuarioId` força a identidade (ex.: logo após login/logout, quando os cookies
 * novos ainda não chegaram nesta requisição).
 */
export async function ler<T>(
  fn: (ctx: Contexto) => T | Promise<T>,
  opcoes: { usuarioId?: string | null } = {},
): Promise<RespostaApi<T>> {
  try {
    const id = opcoes.usuarioId !== undefined ? opcoes.usuarioId : await idDaSessao();
    const { base, versao } = await lerBase();
    const usuario = usuarioAtivo(base, id);
    const resultado = await armazenamento.run({ base }, () => fn({ base, usuario }));
    return { resultado, visao: { base: visaoParaUsuario(base, usuario), usuarioId: usuario?.id ?? null, versao } };
  } catch (e) {
    tratarErro(e);
  }
}

/**
 * Base completa + pessoa, sem montar visão. Só para módulos do servidor que gravam
 * fora da base transacional (ex.: métricas) e devolvem dados já filtrados.
 */
export async function contextoSomenteLeitura(): Promise<Contexto> {
  const id = await idDaSessao();
  const { base } = await lerBase();
  return { base, usuario: usuarioAtivo(base, id) };
}

/**
 * Consulta pontual (ex.: carregadores de rota): `fn` recebe só a visão da pessoa,
 * nunca a base completa — o que ela devolver já respeita as regras de leitura.
 */
export async function consultar<T>(fn: (visao: BaseDados, usuario: Usuario | null) => T): Promise<T> {
  try {
    const id = await idDaSessao();
    const { base } = await lerBase();
    const usuario = usuarioAtivo(base, id);
    return fn(visaoParaUsuario(base, usuario), usuario);
  } catch (e) {
    tratarErro(e);
  }
}

/**
 * Escrita: executa `fn` (que pode lançar ErroDominio) e grava o que mudou.
 * `fn` pode rodar mais de uma vez em caso de conflito — não faça efeitos fora da base nela.
 */
const AFETAM_PARTICIPACAO = ["inscricoes", "eventos", "checkins", "correcoesParticipacao"] as const;

export async function mutar<T>(
  fn: (ctx: Contexto) => T | Promise<T>,
  opcoes: { exigirLogin?: boolean } = { exigirLogin: true },
): Promise<RespostaApi<T>> {
  try {
    const id = await idDaSessao();
    for (let tentativa = 0; tentativa < TENTATIVAS; tentativa++) {
      const { base, versao } = await lerBase();
      const usuario = usuarioAtivo(base, id);
      if (opcoes.exigirLogin !== false && !usuario) {
        throw new ErroDominio("sem_sessao", "Entre na sua conta para continuar.");
      }
      const antes = structuredClone(base);
      const resultado = await armazenamento.run({ base }, () => fn({ base, usuario }));

      // Inscrições, eventos, check-ins (inclusive sincronização offline) e correções
      // mudam a participação: recalcula insígnias/recompensas (idempotente).
      if (AFETAM_PARTICIPACAO.some((c) => antes[c] !== base[c] && JSON.stringify(antes[c]) !== JSON.stringify(base[c]))) {
        recalcularProgressao(base);
      }
      await enviarMidia(supabaseAdmin(), objetosAlterados(antes, base));
      const lote = calcularMudancas(antes, base);
      if (Object.keys(lote).length > 0) {
        const { error, status } = await supabaseAdmin().rpc("apply_changes", { p_changes: lote, p_version: versao });
        invalidarCache(); // gravou (ou outra escrita entrou antes): a base em memória ficou velha
        // MS409 = conflito de versão (supabase/migrations/20261014193000_conflito_sem_retentativa.sql).
        // 40001 só em bancos sem essa migração — e lá o PostgREST repete sozinho, sem limite.
        if (error?.code === "MS409" || error?.code === "40001") {
          await esperarConflito(tentativa); // outra escrita entrou antes: refaz com a base nova
          continue;
        }
        if (error) throw falhaBanco("Falha ao gravar", error, status);
      }
      const depois = usuarioAtivo(base, id);
      // apply_changes incrementa a versão em 1 a cada lote gravado.
      const versaoNova = Object.keys(lote).length > 0 ? versao + 1 : versao;
      return { resultado, visao: { base: visaoParaUsuario(base, depois), usuarioId: depois?.id ?? null, versao: versaoNova } };
    }
    throw new ErroDominio("concorrencia", "Muitas alterações ao mesmo tempo. Tente novamente.");
  } catch (e) {
    tratarErro(e);
  }
}

/** Exige perfil admin (para operações administrativas). */
export function exigirAdmin(usuario: Usuario | null): Usuario {
  if (!usuario || usuario.perfil !== "admin") {
    throw new ErroDominio("sem_permissao", "Apenas administradores podem fazer isso.");
  }
  return usuario;
}

export function exigirUsuario(usuario: Usuario | null): Usuario {
  if (!usuario) throw new ErroDominio("sem_sessao", "Entre na sua conta para continuar.");
  return usuario;
}
