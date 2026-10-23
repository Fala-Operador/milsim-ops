// Confirmação de e-mail no cadastro. Contas criadas antes da confirmação obrigatória já nasceram
// confirmadas e continuam entrando normalmente; as novas só entram depois de abrir o link do
// e-mail (Supabase Auth com "Confirm email" ligado e SMTP próprio). As mensagens ficam aqui
// porque a tela de login reconhece a de "não confirmado" para oferecer o reenvio.

export const CAMINHO_CONFIRMACAO = "/confirmar-email";

export const MSG_EMAIL_NAO_CONFIRMADO = "Confirme seu e-mail para entrar. Abra o link que enviamos ou peça um novo.";
export const MSG_LINK_CONFIRMACAO_INVALIDO = "Link de confirmação inválido ou expirado. Peça um novo.";
export const MSG_AGUARDE_REENVIO = "Aguarde um minuto para pedir outro e-mail.";

/** Link do e-mail: token_hash (modelo próprio; vale em qualquer aparelho) ou code (modelo padrão, PKCE). */
export type LinkConfirmacao = { tokenHash: string } | { codigo: string };

export function linkDaUrl(p: { token_hash?: string | undefined; code?: string | undefined; type?: string | undefined }): LinkConfirmacao | null {
  if (p.token_hash && (!p.type || p.type === "email" || p.type === "signup")) return { tokenHash: p.token_hash };
  if (p.code) return { codigo: p.code };
  return null;
}

/** Destino guardado no aparelho em que a pessoa se cadastrou (ex.: voltar à inscrição do evento). */
export const CHAVE_DESTINO_CONFIRMACAO = "milsim:destino-apos-confirmar";
