// Textos de src/contexts/CheckinContext.tsx.
import { dicionario } from "@/i18n/dicionario";

export const tr = dicionario("contexts/CheckinContext", {
  "sem_conexao_os_registros_continuam_guard": { pt: "Sem conexão: os registros continuam guardados neste aparelho.", en: "No connection: records stay saved on this device." },
  "falha_simulada_falhas_registro_s_continu": { pt: "Falha simulada: {falhas} registro(s) continuam na fila.", en: "Simulated failure: {falhas} record(s) still in the queue." },
  "enviados_sincronizado_s_e_conflitos_conf": { pt: "{enviados} sincronizado(s) e {conflitos} conflito(s) preservado(s) para revisão.", en: "{enviados} synced and {conflitos} conflict(s) kept for review." },
  "enviados_registro_s_sincronizado_s": { pt: "{enviados} registro(s) sincronizado(s).", en: "{enviados} record(s) synced." },
  "conecte_se_a_internet_para_preparar": { pt: "Conecte-se à internet para preparar o aparelho.", en: "Connect to the internet to prepare the device." },
  "aparelho_preparado_ingressos_baixados_e": { pt: "Aparelho preparado: ingressos baixados e {arquivos} arquivos da aplicação guardados.", en: "Device ready: tickets downloaded and {arquivos} app files saved." },
  "ingressos_baixados_mas_este_navegador_pr": { pt: "Ingressos baixados, mas este navegador/prévia não permitiu guardar os arquivos da aplicação (Service Worker). Reabrir sem internet pode não funcionar aqui.", en: "Tickets downloaded, but this browser/preview did not allow saving the app files (Service Worker). Reopening without internet may not work here." },
  "falha_ao_preparar": { pt: "Falha ao preparar.", en: "Could not prepare." },
});
