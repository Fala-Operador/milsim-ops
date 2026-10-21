// Identifica o papel de uma chave do Supabase, para avisar quando a chave errada foi configurada.

/**
 * Papel de uma chave do Supabase: "service_role" (sb_secret_… ou JWT legado service_role),
 * "anon" (sb_publishable_… ou JWT legado anon) ou null quando não dá para saber.
 */
export function papelDaChave(chave: string): string | null {
  if (chave.startsWith("sb_secret_")) return "service_role";
  if (chave.startsWith("sb_publishable_")) return "anon";
  const [, carga64, ...resto] = chave.split(".");
  if (!carga64 || resto.length !== 1) return null;
  try {
    const carga = JSON.parse(atob(carga64.replace(/-/g, "+").replace(/_/g, "/"))) as { role?: unknown };
    return typeof carga.role === "string" ? carga.role : null;
  } catch {
    return null;
  }
}
