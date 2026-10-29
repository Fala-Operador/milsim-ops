// Unidade de trabalho do monólito: toda server function de leitura ou escrita passa por aqui.
//
//  1. identifica a pessoa pela sessão do Supabase Auth (JWT verificado com getClaims);
//  2. carrega a base (RPC export_base, uma ida ao banco);
//  3. executa a regra de negócio — os serviços de src/services leem e mutam a base
//     por carregarBase()/mutarBase(), que no servidor apontam para esta requisição;
//  4. envia imagens/PDFs recebidos como data URL para o Storage;
//  5. grava as diferenças numa única transação (RPC apply_changes) com controle
//     otimista de versão — se outra escrita aconteceu no meio, repete do passo 2;
//     dados pessoais saem cifrados e voltam decifrados aqui (src/server/cifraDados.ts);
//  6. devolve o resultado e a visão atualizada para o navegador.
import "@tanstack/react-start/server-only";
import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";
import { registrarProvedorContexto, ErroDominio, gerarId, type ContextoBase } from "@/services/db";
import { concluirEventosEncerrados, eventosParaConcluir } from "@/lib/cicloEvento";
import { baseDasTabelas, calcularMudancas, linhasDaBase, objetosAlterados, type TabelasExportadas } from "@/lib/persistencia";
import { chaveiroDoAmbiente, cifrarLote, decifrarTabelas, incluirPendentes, totalPendentes, type Pendentes } from "@/server/cifraDados";
import { visaoParaUsuario, type Visao } from "@/lib/visao";
import { enviarMidia } from "@/server/midia";
import { recalcularProgressao } from "@/services/progressao";
import { supabaseAdmin, supabaseSessao } from "@/server/supabase.server";
import type { BaseDados, Usuario } from "@/lib/domain/types";
import { tr } from "@/i18n/server/unidade.server";

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
// `pendentes`: linhas com dado pessoal ainda em texto puro ou com chave antiga (regravadas cifradas).
interface BaseLida { base: BaseDados; versao: number; pendentes: Pendentes }
let cache: (BaseLida & { lidoEm: number }) | null = null;
let exportando: Promise<BaseLida> | null = null;

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

async function exportarBase(): Promise<BaseLida> {
  // Requisições simultâneas na mesma instância compartilham uma única exportação.
  exportando ??= (async () => {
    try {
      const { data, error, status } = await lerComRetentativa(() => supabaseAdmin().rpc("export_base"));
      if (error) throw falhaBanco("Falha ao ler a base", error, status);
      const r = data as { version: number; tables: TabelasExportadas };
      const { tabelas, pendentes } = await decifrarTabelas(r.tables, await chaveiroDoAmbiente());
      const base = baseDasTabelas(tabelas);
      cache = { versao: r.version, base, pendentes, lidoEm: Date.now() };
      return { base, versao: r.version, pendentes };
    } finally {
      exportando = null;
    }
  })();
  const r = await exportando;
  return { ...r, base: structuredClone(r.base) };
}

/** Cópia da base atual (cada requisição pode mutar a sua à vontade). */
async function lerBase(): Promise<BaseLida> {
  // Referência local: uma gravação concorrente pode invalidar `cache` durante o await.
  const emMemoria = cache;
  if (emMemoria && Date.now() - emMemoria.lidoEm < VALIDADE_CACHE_MS) {
    const versao = await versaoAtual();
    if (versao === emMemoria.versao) return { base: structuredClone(emMemoria.base), versao, pendentes: emMemoria.pendentes };
  }
  return exportarBase();
}

/**
 * Base atual com o ciclo dos eventos em dia. Não há tarefa agendada no servidor: se algum
 * evento já terminou e ainda não foi concluído, a primeira leitura depois disso conclui (grava,
 * recalculando insígnias e recompensas) e lê de novo. Se a gravação falhar, a leitura segue
 * com a base como estava — a próxima leitura ou gravação tenta outra vez.
 * Do mesmo jeito, dados pessoais ainda em texto puro (ou com chave antiga) são regravados
 * cifrados com a chave atual na primeira leitura em que aparecem.
 */
let recifraFalhouEm = 0;
async function lerBaseEmDia(): Promise<BaseLida> {
  const atual = await lerBase();
  const concluir = eventosParaConcluir(atual.base).length > 0;
  // Se a cifra falhou, espera 5 min antes de tentar de novo numa leitura (gravações sempre tentam).
  const recifrar = totalPendentes(atual.pendentes) > 0 && (await chaveiroDoAmbiente()).atual !== null &&
    Date.now() - recifraFalhouEm > 5 * 60_000;
  if (!concluir && !recifrar) return atual;
  try {
    await mutar(() => null, { exigirLogin: false }); // mutar aplica a conclusão e a cifra (veja abaixo)
    if (recifrar) console.info(`[cifra] ${totalPendentes(atual.pendentes)} registro(s) com dados pessoais cifrados com a chave atual.`);
    return await lerBase();
  } catch (e) {
    if (recifrar) recifraFalhouEm = Date.now();
    console.error(recifrar ? "[cifra] não foi possível cifrar os dados pessoais pendentes agora" : "[ciclo] não foi possível concluir eventos encerrados agora", e);
    return atual;
  }
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
    throw new Error(tr("servidor_nao_respondeu", { codigo }));
  }
  throw new Error(tr("erro_generico", { codigo }));
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
    const { base, versao } = await lerBaseEmDia();
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
  const { base } = await lerBaseEmDia();
  return { base, usuario: usuarioAtivo(base, id) };
}

/**
 * Consulta pontual (ex.: carregadores de rota): `fn` recebe só a visão da pessoa,
 * nunca a base completa — o que ela devolver já respeita as regras de leitura.
 */
export async function consultar<T>(fn: (visao: BaseDados, usuario: Usuario | null) => T): Promise<T> {
  try {
    const id = await idDaSessao();
    const { base } = await lerBaseEmDia();
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
      const { base, versao, pendentes } = await lerBase();
      const usuario = usuarioAtivo(base, id);
      if (opcoes.exigirLogin !== false && !usuario) {
        throw new ErroDominio("sem_sessao", tr("entre_na_sua_conta_para_continuar"));
      }
      const antes = structuredClone(base);
      // Ciclo do evento: toda gravação também conclui eventos já terminados (mesma transação;
      // a mudança em "eventos" dispara o recálculo de participação logo abaixo).
      concluirEventosEncerrados(base, new Date(), () => gerarId("aud"));
      const resultado = await armazenamento.run({ base }, () => fn({ base, usuario }));

      // Inscrições, eventos, check-ins (inclusive sincronização offline) e correções
      // mudam a participação: recalcula insígnias/recompensas (idempotente).
      if (AFETAM_PARTICIPACAO.some((c) => antes[c] !== base[c] && JSON.stringify(antes[c]) !== JSON.stringify(base[c]))) {
        recalcularProgressao(base);
      }
      await enviarMidia(supabaseAdmin(), objetosAlterados(antes, base));
      // O lote é calculado em texto puro; linhas pendentes de cifra vão junto, e só então cifra.
      const chaveiro = await chaveiroDoAmbiente();
      const diferencas = calcularMudancas(antes, base);
      const lote = chaveiro.atual && totalPendentes(pendentes) > 0
        ? incluirPendentes(diferencas, pendentes, linhasDaBase(base))
        : diferencas;
      if (Object.keys(lote).length > 0) {
        const { error, status } = await supabaseAdmin().rpc("apply_changes", { p_changes: await cifrarLote(lote, chaveiro), p_version: versao });
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
    throw new ErroDominio("concorrencia", tr("muitas_alteracoes_ao_mesmo_tempo_tente"));
  } catch (e) {
    tratarErro(e);
  }
}

/** Exige perfil admin (para operações administrativas). */
export function exigirAdmin(usuario: Usuario | null): Usuario {
  if (!usuario || usuario.perfil !== "admin") {
    throw new ErroDominio("sem_permissao", tr("apenas_administradores_podem_fazer_isso"));
  }
  return usuario;
}

export function exigirUsuario(usuario: Usuario | null): Usuario {
  if (!usuario) throw new ErroDominio("sem_sessao", tr("entre_na_sua_conta_para_continuar"));
  return usuario;
}
