// Entrar com o Google: endereço de retorno e avisos compartilhados entre telas e servidor.

/** Rota do servidor que recebe o retorno do Google (precisa estar nas Redirect URLs do Supabase Auth). */
export const CAMINHO_RETORNO_GOOGLE = "/entrar-google";

/** Aviso mostrado no login quando a volta do Google não abre a sessão (?google=…). */
export type AvisoLoginGoogle = "cancelado" | "falhou" | "inativa" | "sem_vinculo";

export const AVISOS_LOGIN_GOOGLE: Record<AvisoLoginGoogle, string> = {
  cancelado: "Login com o Google cancelado.",
  falhou: "Não foi possível entrar com o Google. Tente de novo.",
  inativa: "Conta inativa.",
  sem_vinculo:
    "Já existe uma conta com este e-mail que ainda não foi confirmada. Abra o link de confirmação do e-mail (ou entre com e-mail e senha para pedir outro) e depois use o Google.",
};
