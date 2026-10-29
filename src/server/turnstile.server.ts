// Cloudflare Turnstile. A verificação do token é feita pelo próprio Supabase Auth (Authentication →
// Bot and Abuse Protection, com a chave secreta do Turnstile): o servidor só repassa o token como
// `captchaToken` no login, no cadastro e no pedido de redefinição de senha. O navegador precisa da
// chave pública do widget, lida da variável do site TURNSTILE_SITE_KEY.
import "@tanstack/react-start/server-only";
import { tr } from "@/i18n/server/turnstile.server";

/** Chave pública (site key) do widget; sem ela o formulário não mostra o Turnstile. */
export function chaveSiteTurnstile(): string | null {
  return process.env["TURNSTILE_SITE_KEY"]?.trim() || null;
}

export const ERRO_CAPTCHA = () => tr("erro_captcha");

/** Erro do Supabase Auth por CAPTCHA ausente, inválido ou já usado. */
export function erroDeCaptcha(error: { code?: string | undefined; message?: string } | null | undefined): boolean {
  if (!error) return false;
  return error.code === "captcha_failed" || /captcha/i.test(error.message ?? "");
}
