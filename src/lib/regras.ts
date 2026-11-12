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

// ---------- Manual de regras recebido do navegador ----------

/** Endereço aceito para o PDF/arquivo do manual: PDF enviado agora (data URL) ou URL https já gravada. */
function arquivoAceito(url: string | undefined, tiposDataUrl: readonly string[]): string | undefined {
  if (!url) return undefined;
  if (/^https:\/\//i.test(url)) return url;
  return tiposDataUrl.some((t) => url.startsWith(`data:${t};base64,`)) ? url : undefined;
}

const TIPOS_ARQUIVO_REGRAS = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
] as const;

/**
 * Manual de regras vindo do editor (servidor): o HTML livre (`conteudoHtml`) nunca é aceito,
 * porque seria mostrado como código na página pública (XSS). Só ficam o PDF e o arquivo,
 * com endereço https ou data URL de tipo conhecido.
 */
export function regrasRecebidas<T extends { conteudoHtml?: string | undefined; pdfDataUrl?: string | undefined; arquivoUrl?: string | undefined; formato?: string }>(
  regras: T | undefined,
): T | undefined {
  if (!regras || typeof regras !== "object") return undefined;
  const { conteudoHtml: _html, ...resto } = regras;
  const limpo = { ...resto } as T;
  limpo.pdfDataUrl = arquivoAceito(regras.pdfDataUrl, ["application/pdf"]);
  limpo.arquivoUrl = arquivoAceito(regras.arquivoUrl, TIPOS_ARQUIVO_REGRAS);
  if (limpo.formato === "html") limpo.formato = "pdf";
  return limpo;
}
