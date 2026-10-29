// Textos de src/lib/checkin.ts.
import { dicionario } from "@/i18n/dicionario";

export const tr = dicionario("lib/checkin", {
  "qr_code": { pt: "QR Code", en: "QR code" },
  "busca_manual": { pt: "Busca manual", en: "Manual search" },
  "sincronizacao_pendente": { pt: "Sincronização pendente", en: "Sync pending" },
  "sincronizado": { pt: "Sincronizado", en: "Synced" },
  "conflito": { pt: "Conflito", en: "Conflict" },
  "falha_tentara_de_novo": { pt: "Falha — tentará de novo", en: "Failed — will retry" },
  "a_inscricao_foi_cancelada_ou_estornada": { pt: "A inscrição foi cancelada ou estornada antes da sincronização.", en: "The registration was cancelled or refunded before syncing." },
  "ja_havia_entrada_registrada": { pt: "Já havia entrada registrada às {hora} por {nome}.", en: "An entry was already recorded at {hora} by {nome}." },
});
