// Conversão segura entre o texto do manual de regras (digitado pela organização)
// e o HTML exibido no leitor interno da página do evento.
// O texto de entrada nunca vira HTML cru: tudo é escapado antes de montar as tags.

const ESCAPAS: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

export function escaparHtml(texto: string): string {
  return texto.replace(/[&<>"']/g, (c) => ESCAPAS[c] ?? c);
}

function limparTags(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&");
}

/**
 * Texto simples → HTML.
 * Regras: linha iniciada por "## " vira título, linhas iniciadas por "- " viram
 * lista, linha em branco separa blocos e quebra de linha vira <br/>.
 */
export function textoParaHtml(texto: string): string {
  const blocos = texto.replace(/\r\n/g, "\n").split(/\n{2,}/);
  const saida: string[] = [];
  for (const bloco of blocos) {
    const linhas = bloco.split("\n").map((l) => l.trim()).filter(Boolean);
    if (linhas.length === 0) continue;
    if (linhas[0]!.startsWith("## ")) {
      saida.push(`<h2>${escaparHtml(linhas[0]!.slice(3).trim())}</h2>`);
      const resto = linhas.slice(1);
      if (resto.length > 0) saida.push(`<p>${resto.map(escaparHtml).join("<br/>")}</p>`);
      continue;
    }
    if (linhas.every((l) => l.startsWith("- "))) {
      saida.push(`<ul>${linhas.map((l) => `<li>${escaparHtml(l.slice(2).trim())}</li>`).join("")}</ul>`);
      continue;
    }
    saida.push(`<p>${linhas.map(escaparHtml).join("<br/>")}</p>`);
  }
  return saida.join("");
}

/** HTML do leitor → texto simples editável (usado ao reabrir o formulário). */
export function htmlParaTexto(html: string): string {
  let t = html.replace(/\s+/g, " ");
  t = t.replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, (_m, c: string) => `\n\n## ${limparTags(c).trim()}\n\n`);
  t = t.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (_m, c: string) => `\n- ${limparTags(c).trim()}`);
  t = t.replace(/<\/(p|ul|ol|div|blockquote)>/gi, "\n\n");
  t = t.replace(/<(ul|ol)[^>]*>/gi, "\n");
  t = limparTags(t);
  return t.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}
