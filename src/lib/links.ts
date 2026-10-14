/** Separa "/caminho?a=1" em caminho e parâmetros para o Link do roteador. */
export function destinoDoLink(link: string): { to: string; search: Record<string, string> } {
  const [to, q] = link.split("?");
  return { to: to || "/", search: Object.fromEntries(new URLSearchParams(q ?? "")) };
}

/** Destino pós-login: só caminhos internos ("/..."), nunca outro site. */
export function redirectSeguro(r: string | undefined): string {
  return r && r.startsWith("/") && !r.startsWith("//") && !r.includes("\\") ? r : "/app";
}
