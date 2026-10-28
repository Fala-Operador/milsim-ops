// Textos de src/contexts/LocalizacaoContext.tsx.
import { dicionario } from "@/i18n/dicionario";

export const tr = dicionario("contexts/LocalizacaoContext", {
  "obtendo_sua_localizacao": { pt: "Obtendo sua localização…", en: "Getting your location…" },
  "permissao_de_localizacao_negada_escolha": { pt: "Permissão de localização negada. Escolha o estado manualmente.", en: "Location permission denied. Choose the state manually." },
  "localizacao_indisponivel_neste_aparelho": { pt: "Localização indisponível neste aparelho. Escolha o estado manualmente.", en: "Location is unavailable on this device. Choose the state manually." },
  "a_localizacao_demorou_demais_tente_de": { pt: "A localização demorou demais. Tente de novo ou escolha o estado.", en: "Getting your location took too long. Try again or choose the state." },
  "este_navegador_nao_informa_a_localizacao": { pt: "Este navegador não informa a localização. Escolha o estado manualmente.", en: "This browser does not share your location. Choose the state manually." },
  "nao_conseguimos_identificar_seu_estado_e": { pt: "Não conseguimos identificar seu estado. Escolha manualmente.", en: "We could not identify your state. Choose it manually." },
});
