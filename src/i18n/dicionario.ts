// Dicionários de textos de tela: cada área declara os seus com pt e en lado a lado.
// O TypeScript confere as chaves; src/test/i18n-dicionarios.test.ts confere as traduções.
import { LOCALE, textoDoPar, type Dicionario, type Idioma, type Vars } from "@/lib/i18n";
import { idiomaAtual } from "@/lib/idiomaAtual";

export interface Tradutor<K extends string> {
  /** Texto no idioma da página. */
  (chave: K, vars?: Vars): string;
  /** Texto num idioma dado (ex.: head() das rotas, que recebe o idioma da rota raiz). */
  em: (idioma: Idioma) => (chave: K, vars?: Vars) => string;
  /** Escolhe entre a forma singular e a plural pela quantidade em {n}. */
  plural: (n: number, um: K, varios: K, vars?: Vars) => string;
  readonly dicionario: Dicionario;
}

const registrados: Record<string, Dicionario> = {};

/** Todos os dicionários já carregados (para os testes de paridade). */
export function dicionariosRegistrados(): Readonly<Record<string, Dicionario>> {
  return registrados;
}

export function dicionario<const D extends Dicionario>(area: string, d: D): Tradutor<keyof D & string> {
  registrados[area] = d;
  const em = (idioma: Idioma) => (chave: keyof D & string, vars?: Vars) => textoDoPar(d[chave], idioma, chave, vars);
  const t = ((chave: keyof D & string, vars?: Vars) => textoDoPar(d[chave], idiomaAtual(), chave, vars)) as Tradutor<keyof D & string>;
  t.em = em;
  t.plural = (n, um, varios, vars) => t(n === 1 ? um : varios, { n, ...vars });
  Object.defineProperty(t, "dicionario", { value: d });
  return t;
}

/** Locale do idioma da página, para datas, números e moeda. */
export function localeAtual(): string {
  return LOCALE[idiomaAtual()];
}
