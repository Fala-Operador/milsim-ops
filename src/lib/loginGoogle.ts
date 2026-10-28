// Entrar com o Google: endereço de retorno e mensagens compartilhadas entre telas e servidor.

/** Página que recebe o retorno do Google (precisa estar nas Redirect URLs do Supabase Auth). */
export const CAMINHO_RETORNO_GOOGLE = "/entrar-google";

export const MSG_GOOGLE_FALHOU = "Não foi possível entrar com o Google. Tente de novo.";

/** Para onde voltar depois do Google (ex.: inscrição do evento), guardado no aparelho. */
export const CHAVE_DESTINO_GOOGLE = "milsim:destino-apos-google";
