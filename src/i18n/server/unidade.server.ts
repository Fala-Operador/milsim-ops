// Textos de src/server/unidade.server.ts.
import { dicionario } from "@/i18n/dicionario";

export const tr = dicionario("server/unidade.server", {
  "servidor_nao_respondeu": { pt: "O servidor de dados não respondeu. Tente novamente em instantes. (código {codigo})", en: "The data server did not respond. Try again in a moment. (code {codigo})" },
  "erro_generico": { pt: "Não foi possível concluir a operação. Tente novamente. (código {codigo})", en: "Could not complete the operation. Try again. (code {codigo})" },
  "entre_na_sua_conta_para_continuar": { pt: "Entre na sua conta para continuar.", en: "Sign in to continue." },
  "muitas_alteracoes_ao_mesmo_tempo_tente": { pt: "Muitas alterações ao mesmo tempo. Tente novamente.", en: "Too many changes at once. Try again." },
  "apenas_administradores_podem_fazer_isso": { pt: "Apenas administradores podem fazer isso.", en: "Only administrators can do this." },
});
