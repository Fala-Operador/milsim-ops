// Conversão entre a BaseDados (objetos camelCase) e as tabelas do Supabase
// (colunas snake_case), e cálculo do lote de mudanças de uma unidade de trabalho.
// Regras puras: sem rede, sem React — usadas pelo servidor, pelo seed e pelos testes.
import type { BaseDados } from "@/lib/domain/types";

/** Coleções da BaseDados que são listas de registros com chave própria. */
type ColecaoLista = Exclude<keyof BaseDados, "versao" | "visitasComunidade">;

interface DefinicaoTabela {
  tabela: string;
  chave: string[]; // campos camelCase que formam a chave primária
}

export const TABELAS: Record<ColecaoLista, DefinicaoTabela> = {
  usuarios: { tabela: "usuarios", chave: ["id"] },
  organizacoes: { tabela: "organizacoes", chave: ["id"] },
  solicitacoes: { tabela: "solicitacoes", chave: ["id"] },
  eventos: { tabela: "eventos", chave: ["id"] },
  inscricoes: { tabela: "inscricoes", chave: ["id"] },
  cupons: { tabela: "cupons", chave: ["id"] },
  cortesias: { tabela: "cortesias", chave: ["id"] },
  missoes: { tabela: "missoes", chave: ["id"] },
  entregas: { tabela: "entregas", chave: ["id"] },
  comunicados: { tabela: "comunicados", chave: ["id"] },
  comentarios: { tabela: "comentarios", chave: ["id"] },
  chamados: { tabela: "chamados", chave: ["id"] },
  notificacoes: { tabela: "notificacoes", chave: ["id"] },
  movimentacoes: { tabela: "movimentacoes", chave: ["id"] },
  auditoria: { tabela: "auditoria", chave: ["id"] },
  privacidade: { tabela: "privacidade", chave: ["id"] },
  foruns: { tabela: "foruns", chave: ["id"] },
  publicacoes: { tabela: "publicacoes", chave: ["id"] },
  respostas: { tabela: "respostas", chave: ["id"] },
  curtidas: { tabela: "curtidas", chave: ["id"] },
  denuncias: { tabela: "denuncias", chave: ["id"] },
  preferenciasForum: { tabela: "preferencias_forum", chave: ["usuarioId", "forumId"] },
  restricoesComunidade: { tabela: "restricoes_comunidade", chave: ["id"] },
  moderacao: { tabela: "moderacao", chave: ["id"] },
  parceiros: { tabela: "parceiros", chave: ["id"] },
  secoesInicio: { tabela: "secoes_inicio", chave: ["id"] },
  checkins: { tabela: "checkins", chave: ["id"] },
};

export const COLECOES = Object.keys(TABELAS) as ColecaoLista[];
const TABELA_VISITAS = "visitas_comunidade";

/** Versão do formato da base (mantida para compatibilidade com o código existente). */
export const VERSAO_FORMATO = 4;

export function baseVazia(): BaseDados {
  const base = { versao: VERSAO_FORMATO, visitasComunidade: {} } as BaseDados;
  for (const c of COLECOES) (base[c] as unknown[]) = [];
  return base;
}

// ---------- Nomes ----------
export const paraSnake = (s: string) => s.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
export const paraCamel = (s: string) => s.replace(/_([a-z0-9])/g, (_, c: string) => c.toUpperCase());

// Postgres devolve timestamptz como "2026-10-13T14:50:18.889+00:00"; a aplicação usa toISOString().
const TIMESTAMP_PG = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;

/** Linha do banco → objeto de domínio (null vira campo ausente). */
export function daLinha<T>(linha: Record<string, unknown>): T {
  const obj: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(linha)) {
    if (v === null || v === undefined) continue;
    obj[paraCamel(k)] = typeof v === "string" && TIMESTAMP_PG.test(v) ? new Date(v).toISOString() : v;
  }
  return obj as T;
}

/** Objeto de domínio → linha do banco (campos ausentes viram null no banco). */
export function paraLinha(obj: object): Record<string, unknown> {
  const linha: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined) continue;
    linha[paraSnake(k)] = v;
  }
  return linha;
}

// ---------- Base ↔ tabelas ----------
export type TabelasExportadas = Record<string, Record<string, unknown>[]>;

export function baseDasTabelas(tabelas: TabelasExportadas): BaseDados {
  const base = baseVazia();
  for (const c of COLECOES) {
    (base[c] as unknown[]) = (tabelas[TABELAS[c].tabela] ?? []).map((l) => daLinha(l));
  }
  for (const l of tabelas[TABELA_VISITAS] ?? []) {
    const v = daLinha<{ usuarioId: string; eventoId: string; vistoEm: string }>(l);
    base.visitasComunidade[`${v.usuarioId}:${v.eventoId}`] = v.vistoEm;
  }
  return base;
}

function linhasVisitas(base: BaseDados) {
  return Object.entries(base.visitasComunidade).map(([chave, vistoEm]) => {
    const i = chave.indexOf(":");
    return { usuarioId: chave.slice(0, i), eventoId: chave.slice(i + 1), vistoEm };
  });
}

// ---------- Diferenças ----------
export type Mudancas = Record<string, { gravar: Record<string, unknown>[]; excluir: Record<string, unknown>[] }>;

const chaveDe = (obj: Record<string, unknown>, campos: string[]) => campos.map((c) => String(obj[c])).join("\u0000");

function diferencas(antes: object[], depois: object[], campos: string[]) {
  const anteriores = new Map(antes.map((o) => [chaveDe(o as Record<string, unknown>, campos), JSON.stringify(o)]));
  const gravar: Record<string, unknown>[] = [];
  const vistos = new Set<string>();
  for (const o of depois) {
    const k = chaveDe(o as Record<string, unknown>, campos);
    vistos.add(k);
    if (anteriores.get(k) !== JSON.stringify(o)) gravar.push(paraLinha(o));
  }
  const excluir: Record<string, unknown>[] = [];
  for (const o of antes) {
    const r = o as Record<string, unknown>;
    if (!vistos.has(chaveDe(r, campos))) excluir.push(Object.fromEntries(campos.map((c) => [paraSnake(c), r[c]])));
  }
  return { gravar, excluir };
}

/** Lote mínimo de gravações/exclusões que leva o banco de `antes` para `depois`. */
export function calcularMudancas(antes: BaseDados, depois: BaseDados): Mudancas {
  const lote: Mudancas = {};
  for (const c of COLECOES) {
    const d = diferencas(antes[c] as object[], depois[c] as object[], TABELAS[c].chave);
    if (d.gravar.length || d.excluir.length) lote[TABELAS[c].tabela] = d;
  }
  const v = diferencas(linhasVisitas(antes), linhasVisitas(depois), ["usuarioId", "eventoId"]);
  if (v.gravar.length || v.excluir.length) lote[TABELA_VISITAS] = v;
  return lote;
}

/** Lote que insere a base inteira (usado pelo seed). */
export function mudancasDeInsercao(base: BaseDados): Mudancas {
  return calcularMudancas(baseVazia(), base);
}

/** Registros (objetos de domínio) gravados por um lote — usados para extrair mídia. */
export function objetosAlterados(antes: BaseDados, depois: BaseDados): object[] {
  const alterados: object[] = [];
  for (const c of COLECOES) {
    const campos = TABELAS[c].chave;
    const anteriores = new Map((antes[c] as object[]).map((o) => [chaveDe(o as Record<string, unknown>, campos), JSON.stringify(o)]));
    for (const o of depois[c] as object[]) {
      if (anteriores.get(chaveDe(o as Record<string, unknown>, campos)) !== JSON.stringify(o)) alterados.push(o);
    }
  }
  return alterados;
}
