// Conversão entre a BaseDados (objetos camelCase em português) e as tabelas do Supabase
// (nomes em inglês, definidos em src/lib/esquemaBanco.ts), e cálculo do lote de mudanças de
// uma unidade de trabalho. Listas e objetos aninhados ficam em tabelas filhas: na gravação
// cada registro vira uma linha na tabela da coleção mais linhas nas filhas; na leitura as
// filhas são agrupadas pela chave do pai e remontadas.
// Regras puras: sem rede, sem React — usadas pelo servidor, pelo seed e pelos testes.
import type { BaseDados } from "@/lib/domain/types";
import { ESQUEMA, VISITAS_COMUNIDADE, type Campos, type Tabela } from "@/lib/esquemaBanco";

/** Coleções da BaseDados que são listas de registros com chave própria. */
type ColecaoLista = Exclude<keyof BaseDados, "versao" | "visitasComunidade">;

export const TABELAS: Record<ColecaoLista, Tabela> = ESQUEMA;
export const COLECOES = Object.keys(TABELAS) as ColecaoLista[];

/** Versão do formato da base (mantida para compatibilidade com o código existente). */
export const VERSAO_FORMATO = 4;

export function baseVazia(): BaseDados {
  const base = { versao: VERSAO_FORMATO, visitasComunidade: {} } as BaseDados;
  for (const c of COLECOES) (base[c] as unknown[]) = [];
  return base;
}

type Linha = Record<string, unknown>;
type Objeto = Record<string, unknown>;

// ---------- Tabelas do banco e suas chaves primárias ----------
interface DefinicaoBanco { colunasChave: string[]; filha?: { pai: string[] } | undefined }

function colunaDe(t: Tabela, campo: string): string {
  const c = t.campos[campo];
  if (typeof c !== "string") throw new Error(`Chave ${campo} de ${t.tabela} não é coluna.`);
  return c;
}

function registrarFilhas(campos: Campos, saida: Map<string, DefinicaoBanco>) {
  for (const def of Object.values(campos)) {
    if (typeof def === "string") continue;
    if (def.tipo === "embutido") { registrarFilhas(def.campos, saida); continue; }
    const chave = def.tipo === "lista" ? [...def.pai, "position"] : def.tipo === "mapa" ? [...def.pai, def.chave] : def.pai;
    saida.set(def.tabela, { colunasChave: chave, filha: { pai: def.pai } });
    if (def.tipo === "lista" && typeof def.itens !== "string") registrarFilhas(def.itens, saida);
    if (def.tipo === "objeto") registrarFilhas(def.campos, saida);
  }
}

/** Todas as tabelas da base transacional, na ordem pai → filhas (espelha base_tables() no banco). */
export const TABELAS_BANCO: ReadonlyMap<string, DefinicaoBanco> = (() => {
  const m = new Map<string, DefinicaoBanco>();
  for (const t of [...Object.values(TABELAS), VISITAS_COMUNIDADE]) {
    m.set(t.tabela, { colunasChave: t.chave.map((c) => colunaDe(t, c)) });
    registrarFilhas(t.campos, m);
  }
  return m;
})();

// ---------- Objeto → linhas ----------
export type TabelasExportadas = Record<string, Linha[]>;

const avisados = new Set<string>();
function campoDesconhecido(tabela: string, campo: string) {
  // Campo sem coluna seria perdido na gravação: avisa uma vez (o teste da seed falha com isso).
  if (avisados.has(`${tabela}.${campo}`)) return;
  avisados.add(`${tabela}.${campo}`);
  console.warn(`[persistencia] campo sem coluna ignorado: ${tabela}.${campo}`);
}

const ehObjeto = (v: unknown): v is Objeto => typeof v === "object" && v !== null && !Array.isArray(v);

function adicionar(saida: TabelasExportadas, tabela: string, linha: Linha) {
  (saida[tabela] ??= []).push(linha);
}

/** Preenche `linha` com os campos de `obj` e manda listas/objetos aninhados para as filhas. */
function preencher(tabela: string, campos: Campos, obj: Objeto, linha: Linha, chave: unknown[], saida: TabelasExportadas) {
  for (const [campo, v] of Object.entries(obj)) {
    if (v === undefined) continue;
    const def = campos[campo];
    if (def === undefined) { campoDesconhecido(tabela, campo); continue; }
    if (typeof def === "string") { linha[def] = v; continue; }
    const doPai = (pai: string[]) => Object.fromEntries(pai.map((c, i) => [c, chave[i]]));
    switch (def.tipo) {
      case "embutido":
        if (ehObjeto(v)) preencher(tabela, def.campos, v, linha, chave, saida);
        break;
      case "objeto":
        if (ehObjeto(v)) {
          const filha = doPai(def.pai);
          preencher(def.tabela, def.campos, v, filha, chave, saida);
          adicionar(saida, def.tabela, filha);
        }
        break;
      case "mapa":
        if (ehObjeto(v)) {
          for (const [k, valor] of Object.entries(v)) {
            if (valor !== undefined) adicionar(saida, def.tabela, { ...doPai(def.pai), [def.chave]: k, [def.valor]: valor });
          }
        }
        break;
      case "lista":
        if (Array.isArray(v)) {
          v.forEach((item, i) => {
            const filha: Linha = { ...doPai(def.pai), position: i };
            if (typeof def.itens === "string") filha[def.itens] = item;
            else if (ehObjeto(item)) preencher(def.tabela, def.itens, item, filha, [...chave, i], saida);
            adicionar(saida, def.tabela, filha);
          });
        }
        break;
    }
  }
}

function linhasDoRegistro(t: Tabela, obj: object, saida: TabelasExportadas) {
  const o = obj as Objeto;
  const linha: Linha = {};
  preencher(t.tabela, t.campos, o, linha, t.chave.map((c) => o[c]), saida);
  adicionar(saida, t.tabela, linha);
}

/** Objeto de domínio → linha de uma tabela sem filhas (campos ausentes não viram colunas). */
export function paraLinha(t: Tabela, obj: object): Linha {
  const saida: TabelasExportadas = {};
  linhasDoRegistro(t, obj, saida);
  return saida[t.tabela]![0]!;
}

function linhasVisitas(base: BaseDados): Objeto[] {
  return Object.entries(base.visitasComunidade).map(([chave, vistoEm]) => {
    const i = chave.indexOf(":");
    return { usuarioId: chave.slice(0, i), eventoId: chave.slice(i + 1), vistoEm };
  });
}

/** Base inteira → linhas de cada tabela do banco. */
export function linhasDaBase(base: BaseDados): TabelasExportadas {
  const saida: TabelasExportadas = {};
  for (const c of COLECOES) for (const o of base[c] as object[]) linhasDoRegistro(TABELAS[c], o, saida);
  for (const v of linhasVisitas(base)) linhasDoRegistro(VISITAS_COMUNIDADE, v, saida);
  return saida;
}

// ---------- Linhas → objeto ----------
// Postgres devolve timestamptz como "2026-10-13T14:50:18.889+00:00"; a aplicação usa toISOString().
const TIMESTAMP_PG = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;
const valorDe = (v: unknown) => (typeof v === "string" && TIMESTAMP_PG.test(v) ? new Date(v).toISOString() : v);
const chaveTexto = (valores: unknown[]) => valores.map(String).join("\u0000");

/** Linhas das tabelas filhas agrupadas pela chave do pai. */
type Indice = Map<string, Map<string, Linha[]>>;

function indexar(tabelas: TabelasExportadas): Indice {
  const indice: Indice = new Map();
  for (const [tabela, def] of TABELAS_BANCO) {
    if (!def.filha) continue;
    const grupos = new Map<string, Linha[]>();
    for (const l of tabelas[tabela] ?? []) {
      const k = chaveTexto(def.filha.pai.map((c) => l[c]));
      const g = grupos.get(k);
      if (g) g.push(l);
      else grupos.set(k, [l]);
    }
    for (const g of grupos.values()) g.sort((a, b) => Number(a["position"] ?? 0) - Number(b["position"] ?? 0));
    indice.set(tabela, grupos);
  }
  return indice;
}

function montar(campos: Campos, linha: Linha, chave: unknown[], indice: Indice): Objeto {
  const obj: Objeto = {};
  const filhas = (tabela: string) => indice.get(tabela)?.get(chaveTexto(chave)) ?? [];
  for (const [campo, def] of Object.entries(campos)) {
    if (typeof def === "string") {
      const v = linha[def];
      if (v !== null && v !== undefined) obj[campo] = valorDe(v);
      continue;
    }
    switch (def.tipo) {
      case "embutido":
        if (!def.presenca || (linha[def.presenca] !== null && linha[def.presenca] !== undefined)) {
          obj[campo] = montar(def.campos, linha, chave, indice);
        }
        break;
      case "objeto": {
        const l = filhas(def.tabela)[0];
        if (l) obj[campo] = montar(def.campos, l, chave, indice);
        break;
      }
      case "mapa": {
        const ls = filhas(def.tabela);
        if (ls.length) obj[campo] = Object.fromEntries(ls.map((l) => [String(l[def.chave]), valorDe(l[def.valor])]));
        break;
      }
      case "lista": {
        const itens = def.itens;
        obj[campo] = filhas(def.tabela).map((l) =>
          typeof itens === "string" ? valorDe(l[itens]) : montar(itens, l, [...chave, l["position"]], indice));
        break;
      }
    }
  }
  return obj;
}

function registroDaLinha<T>(t: Tabela, linha: Linha, indice: Indice): T {
  return montar(t.campos, linha, t.chave.map((c) => linha[colunaDe(t, c)]), indice) as T;
}

/** Linha de uma tabela sem filhas → objeto de domínio (null vira campo ausente). */
export function daLinha<T>(t: Tabela, linha: Linha): T {
  return registroDaLinha<T>(t, linha, new Map());
}

export function baseDasTabelas(tabelas: TabelasExportadas): BaseDados {
  const base = baseVazia();
  const indice = indexar(tabelas);
  for (const c of COLECOES) {
    const t = TABELAS[c];
    (base[c] as unknown[]) = (tabelas[t.tabela] ?? []).map((l) => registroDaLinha(t, l, indice));
  }
  for (const l of tabelas[VISITAS_COMUNIDADE.tabela] ?? []) {
    const v = daLinha<{ usuarioId: string; eventoId: string; vistoEm: string }>(VISITAS_COMUNIDADE, l);
    base.visitasComunidade[`${v.usuarioId}:${v.eventoId}`] = v.vistoEm;
  }
  return base;
}

// ---------- Diferenças ----------
export type Mudancas = Record<string, { gravar: Linha[]; excluir: Linha[] }>;

function diferencas(antes: Linha[], depois: Linha[], colunas: string[]) {
  const chaveDe = (l: Linha) => chaveTexto(colunas.map((c) => l[c]));
  const anteriores = new Map(antes.map((l) => [chaveDe(l), JSON.stringify(l)]));
  const gravar: Linha[] = [];
  const vistos = new Set<string>();
  for (const l of depois) {
    const k = chaveDe(l);
    vistos.add(k);
    if (anteriores.get(k) !== JSON.stringify(l)) gravar.push(l);
  }
  const excluir: Linha[] = [];
  for (const l of antes) {
    if (!vistos.has(chaveDe(l))) excluir.push(Object.fromEntries(colunas.map((c) => [c, l[c]])));
  }
  return { gravar, excluir };
}

/** Lote mínimo de gravações/exclusões que leva o banco de `antes` para `depois`. */
export function calcularMudancas(antes: BaseDados, depois: BaseDados): Mudancas {
  const la = linhasDaBase(antes);
  const ld = linhasDaBase(depois);
  const lote: Mudancas = {};
  for (const [tabela, def] of TABELAS_BANCO) {
    const d = diferencas(la[tabela] ?? [], ld[tabela] ?? [], def.colunasChave);
    if (d.gravar.length || d.excluir.length) lote[tabela] = d;
  }
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
    const chaveDe = (o: object) => chaveTexto(campos.map((k) => (o as Objeto)[k]));
    const anteriores = new Map((antes[c] as object[]).map((o) => [chaveDe(o), JSON.stringify(o)]));
    for (const o of depois[c] as object[]) {
      if (anteriores.get(chaveDe(o)) !== JSON.stringify(o)) alterados.push(o);
    }
  }
  return alterados;
}
