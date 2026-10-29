// Textos de src/server/documentos.server.ts.
import { dicionario } from "@/i18n/dicionario";

export const tr = dicionario("server/documentos.server", {
  "formato_nao_aceito_envie_pdf_jpeg": { pt: "Formato não aceito. Envie PDF, JPEG, PNG ou WebP.", en: "Format not accepted. Upload PDF, JPEG, PNG or WebP." },
  "arquivo_acima_de_5_mb": { pt: "Arquivo acima de 5 MB.", en: "File larger than 5 MB." },
  "o_conteudo_do_arquivo_nao_corresponde": { pt: "O conteúdo do arquivo não corresponde ao formato informado.", en: "The file content does not match the stated format." },
  "falha_ao_enviar_documento_message": { pt: "Falha ao enviar documento: {message}", en: "Could not upload document: {message}" },
  "documento_nao_encontrado": { pt: "Documento não encontrado.", en: "Document not found." },
  "falha_ao_gerar_link": { pt: "Falha ao gerar link.", en: "Could not generate the link." },
});
