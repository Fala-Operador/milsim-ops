// Marcação simples dos textos fixos do site (public.site_texts). Vira uma árvore tipada que a
// tela transforma em elementos React: nada é HTML, então um texto do banco nunca vira código.
//   parágrafos separados por linha em branco · linhas "- " formam uma lista
//   **negrito** · `código` · [rótulo](/caminho | #ancora | https://…) · [[bloco]] sozinho na linha

export type Trecho =
  | { tipo: "texto"; texto: string }
  | { tipo: "negrito"; filhos: Trecho[] }
  | { tipo: "codigo"; texto: string }
  | { tipo: "link"; href: string; filhos: Trecho[] };

export type Bloco =
  | { tipo: "paragrafo"; trechos: Trecho[] }
  | { tipo: "lista"; itens: Trecho[][] }
  | { tipo: "especial"; nome: string };

const MARCAS = /\*\*(?=\S)([\s\S]*?\S)\*\*|`([^`]+)`|\[([^\]]+)\]\(([^)\s]+)\)/g;

/** Só links do próprio site, âncoras, https e mailto; o resto vira texto. */
export function hrefSeguro(href: string): boolean {
  return /^(\/(?!\/)|#|https:\/\/|mailto:)/.test(href);
}

export function trechos(texto: string): Trecho[] {
  const saida: Trecho[] = [];
  let inicio = 0;
  for (const m of texto.matchAll(MARCAS)) {
    if (m.index > inicio) saida.push({ tipo: "texto", texto: texto.slice(inicio, m.index) });
    if (m[1] !== undefined) saida.push({ tipo: "negrito", filhos: trechos(m[1]) });
    else if (m[2] !== undefined) saida.push({ tipo: "codigo", texto: m[2] });
    else if (hrefSeguro(m[4]!)) saida.push({ tipo: "link", href: m[4]!, filhos: trechos(m[3]!) });
    else saida.push({ tipo: "texto", texto: m[0] });
    inicio = m.index + m[0].length;
  }
  if (inicio < texto.length) saida.push({ tipo: "texto", texto: texto.slice(inicio) });
  return saida;
}

export function blocos(texto: string): Bloco[] {
  const saida: Bloco[] = [];
  for (const parte of texto.replace(/\r\n/g, "\n").split(/\n\s*\n/)) {
    const linhas = parte.split("\n").map((l) => l.trim()).filter(Boolean);
    if (!linhas.length) continue;
    const especial = linhas.length === 1 ? /^\[\[([a-z0-9_-]+)\]\]$/.exec(linhas[0]!) : null;
    if (especial) saida.push({ tipo: "especial", nome: especial[1]! });
    else if (linhas.every((l) => l.startsWith("- "))) saida.push({ tipo: "lista", itens: linhas.map((l) => trechos(l.slice(2))) });
    else saida.push({ tipo: "paragrafo", trechos: trechos(linhas.join(" ")) });
  }
  return saida;
}
