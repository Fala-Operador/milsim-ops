// Idioma do site (textos fixos em public.site_texts). Funções puras: valem no servidor e no navegador.

export type Idioma = "pt" | "en";
export type Textos = Record<string, string>;

export const IDIOMAS: readonly Idioma[] = ["pt", "en"];
export const COOKIE_IDIOMA = "idioma";
export const LANG_HTML: Record<Idioma, string> = { pt: "pt-BR", en: "en" };

export function ehIdioma(v: unknown): v is Idioma {
  return v === "pt" || v === "en";
}

/** Documentos legais: sem nenhuma pista de idioma (robôs, verificadores), saem em inglês. */
const PAGINAS_EM_INGLES_POR_PADRAO = new Set(["/privacidade", "/termos"]);

/**
 * Ordem: ?lang= na URL › escolha guardada no cookie › idioma do navegador (português → pt,
 * qualquer outro → en) › sem cabeçalho: inglês nos documentos legais, português no resto.
 */
export function escolherIdioma(p: { pedido?: unknown; cookie?: unknown; acceptLanguage?: string | null | undefined; caminho?: string }): Idioma {
  if (ehIdioma(p.pedido)) return p.pedido;
  if (ehIdioma(p.cookie)) return p.cookie;
  const primeiro = p.acceptLanguage?.split(",")[0]?.trim().toLowerCase();
  if (primeiro && primeiro !== "*") return primeiro.startsWith("pt") ? "pt" : "en";
  return p.caminho && PAGINAS_EM_INGLES_POR_PADRAO.has(p.caminho) ? "en" : "pt";
}

/** Troca {nome} pelos valores dados; marcas sem valor ficam como estão. */
export function interpolar(texto: string, vars?: Record<string, string | number>): string {
  if (!vars) return texto;
  return texto.replace(/\{(\w+)\}/g, (m, nome: string) => (nome in vars ? String(vars[nome]) : m));
}

export type Traduzir = (chave: string, vars?: Record<string, string | number>) => string;

/** Texto ausente no banco aparece como a própria chave (fácil de achar e corrigir). */
export function criarTradutor(textos: Textos): Traduzir {
  return (chave, vars) => interpolar(textos[chave] ?? chave, vars);
}

/** Filtra as chaves que começam por algum dos prefixos ("rodape" pega "rodape.*"). */
export function filtrarPorPrefixo(textos: Textos, prefixos: readonly string[]): Textos {
  const saida: Textos = {};
  for (const [chave, valor] of Object.entries(textos)) {
    if (prefixos.some((p) => chave === p || chave.startsWith(`${p}.`))) saida[chave] = valor;
  }
  return saida;
}

/** Prefixos que toda página usa (cabeçalho, rodapé, página inicial); os documentos legais carregam os seus. */
export const PREFIXOS_COMUNS = ["comum", "meta", "nav", "cabecalho", "rodape", "inicio", "sobre"] as const;

/** Lê ?lang da busca crua (sem validar o resto dos parâmetros da rota). */
export function langDaBusca(busca: unknown): string | undefined {
  const v = (busca as { lang?: unknown } | undefined)?.lang;
  return typeof v === "string" ? v : undefined;
}

/** Textos comuns carregados pela rota raiz, para usar no head() de uma rota filha. */
export function textosDaRaiz(matches: readonly { loaderData?: unknown }[]): Textos {
  return (matches[0]?.loaderData as { textos?: Textos } | undefined)?.textos ?? {};
}
