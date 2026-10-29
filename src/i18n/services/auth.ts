// Textos de src/services/auth.ts.
import { dicionario } from "@/i18n/dicionario";

export const tr = dicionario("services/auth", {
  "a_confirmacao_de_senha_nao_confere": { pt: "A confirmação de senha não confere.", en: "The password confirmation does not match." },
  "e_obrigatorio_aceitar_os_termos_e": { pt: "É obrigatório aceitar os termos e o aviso de privacidade.", en: "You must accept the terms and the privacy notice." },
  "informe_um_e_mail_valido": { pt: "Informe um e-mail válido.", en: "Enter a valid email." },
  "cpf_invalido": { pt: "CPF inválido.", en: "Invalid CPF." },
  "telefone_whatsapp_invalido": { pt: "Telefone/WhatsApp inválido.", en: "Invalid phone/WhatsApp number." },
  "e_necessario_ter_ao_menos_idade": { pt: "É necessário ter ao menos {IDADE_MINIMA} anos.", en: "You must be at least {IDADE_MINIMA} years old." },
  "ja_existe_um_cadastro_com_este": { pt: "Já existe um cadastro com este CPF.", en: "An account with this CPF already exists." },
  "ja_existe_um_cadastro_com_este_2": { pt: "Já existe um cadastro com este e-mail.", en: "An account with this email already exists." },
});
