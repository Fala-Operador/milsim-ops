// Formatação mínima para texto livre (enredo, descrições): **negrito** e *itálico*, no estilo
// do WhatsApp/Markdown. Devolve trechos tipados que a tela transforma em elementos React:
// nada vira HTML, então o que a pessoa digita nunca é interpretado como código.

export type Trecho = { tipo: "texto" | "negrito" | "italico"; texto: string };

// Negrito: **…** com algo que não seja espaço logo depois de abrir e logo antes de fechar.
// Itálico: *…* nas mesmas condições, sem colar em outro asterisco nem em letra/número
// (evita "5*3*2" ou "**" soltos virarem itálico).
const MARCAS = /\*\*(?=\S)([\s\S]*?\S)\*\*|(?<![*\p{L}\p{N}])\*(?=[^\s*])([^*\n]*?[^\s*])\*(?![*\p{L}\p{N}])/gu;

export function formatarTexto(texto: string): Trecho[] {
  const trechos: Trecho[] = [];
  let inicio = 0;
  for (const m of texto.matchAll(MARCAS)) {
    if (m.index > inicio) trechos.push({ tipo: "texto", texto: texto.slice(inicio, m.index) });
    trechos.push(m[1] !== undefined ? { tipo: "negrito", texto: m[1] } : { tipo: "italico", texto: m[2]! });
    inicio = m.index + m[0].length;
  }
  if (inicio < texto.length) trechos.push({ tipo: "texto", texto: texto.slice(inicio) });
  return trechos;
}
