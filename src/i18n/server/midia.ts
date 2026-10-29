// Textos de src/server/midia.ts.
import { dicionario } from "@/i18n/dicionario";

export const tr = dicionario("server/midia", {
  "tipo_de_arquivo_nao_permitido_valor": { pt: "Tipo de arquivo não permitido: {valor}.", en: "File type not allowed: {valor}." },
  "arquivo_acima_do_tamanho_permitido": { pt: "Arquivo acima do tamanho permitido.", en: "File over the allowed size." },
  "falha_ao_enviar_arquivo_message": { pt: "Falha ao enviar arquivo: {message}", en: "Could not upload file: {message}" },
});
