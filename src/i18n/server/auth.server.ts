// Textos de src/server/auth.server.ts.
import { dicionario } from "@/i18n/dicionario";

export const tr = dicionario("server/auth.server", {
  "e_mail_ou_senha_incorretos": { pt: "E-mail ou senha incorretos.", en: "Incorrect email or password." },
  "conta_inativa": { pt: "Conta inativa.", en: "Inactive account." },
  "ja_existe_um_cadastro_com_este": { pt: "Já existe um cadastro com este e-mail.", en: "An account with this email already exists." },
  "ja_existe_um_cadastro_com_este_2": { pt: "Já existe um cadastro com este CPF.", en: "An account with this CPF already exists." },
  "muitos_cadastros_neste_momento_tente_de": { pt: "Muitos cadastros neste momento. Tente de novo em alguns minutos.", en: "Too many sign-ups right now. Try again in a few minutes." },
  "nao_foi_possivel_criar_a_conta": { pt: "Não foi possível criar a conta. Tente novamente.", en: "Could not create the account. Try again." },
  "link_de_recuperacao_invalido_ou_expirado": { pt: "Link de recuperação inválido ou expirado. Solicite um novo.", en: "Invalid or expired recovery link. Request a new one." },
  "a_nova_senha_precisa_ser_diferente": { pt: "A nova senha precisa ser diferente da atual.", en: "The new password must be different from the current one." },
  "sessao_de_recuperacao_expirada_solicite": { pt: "Sessão de recuperação expirada. Solicite um novo link.", en: "Recovery session expired. Request a new link." },
  "entrar_com_o_google_nao_esta": { pt: "Entrar com o Google não está disponível agora. Use e-mail e senha.", en: "Google sign-in is not available right now. Use email and password." },
  "sessao_expirada_entre_com_o_google": { pt: "Sessão expirada. Entre com o Google de novo.", en: "Session expired. Sign in with Google again." },
});
