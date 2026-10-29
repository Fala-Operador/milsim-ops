import { tr } from "@/i18n/lib/loginGoogle";
// Entrar com o Google: endereço de retorno e avisos compartilhados entre telas e servidor.

/** Rota do servidor que recebe o retorno do Google (precisa estar nas Redirect URLs do Supabase Auth). */
export const CAMINHO_RETORNO_GOOGLE = "/entrar-google";

/** Aviso mostrado no login quando a volta do Google não abre a sessão (?google=…). */
export type AvisoLoginGoogle = "cancelado" | "falhou" | "inativa" | "sem_vinculo";

export const AVISOS_LOGIN_GOOGLE: Record<AvisoLoginGoogle, string> = {
  get cancelado() { return tr("login_com_o_google_cancelado"); },
  get falhou() { return tr("nao_foi_possivel_entrar_com_o"); },
  get inativa() { return tr("conta_inativa"); },
  get sem_vinculo() { return tr("ja_existe_uma_conta_com_este"); },
};
