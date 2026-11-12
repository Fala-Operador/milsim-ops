/** Separa "/caminho?a=1" em caminho e parâmetros para o Link do roteador. */
export function destinoDoLink(link: string): { to: string; search: Record<string, string> } {
  const [to, q] = link.split("?");
  return { to: to || "/", search: Object.fromEntries(new URLSearchParams(q ?? "")) };
}

/** Destino pós-login: só caminhos internos ("/..."), nunca outro site. */
export function redirectSeguro(r: string | undefined): string {
  // Espaços e caracteres de controle (TAB, quebra de linha) são removidos pelo navegador:
  // "/\t/site.com" viraria "//site.com" (outro site). Por isso são recusados.
  return r && r.startsWith("/") && !r.startsWith("//") && !r.includes("\\") && ![...r].some((c) => c.charCodeAt(0) <= 0x20 || c.charCodeAt(0) === 0x7f) ? r : "/app";
}
