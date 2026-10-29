// Textos de src/components/SaldoRecebimento.tsx.
import { dicionario } from "@/i18n/dicionario";

export const tr = dicionario("components/SaldoRecebimento", {
  "nao_foi_possivel_consultar_o_saldo": { pt: "Não foi possível consultar o saldo no Stripe.", en: "Could not check the balance on Stripe." },
  "saldo_e_saques": { pt: "Saldo e saques", en: "Balance and payouts" },
  "atualizar": { pt: "Atualizar", en: "Refresh" },
  "consultando_o_stripe": { pt: "Consultando o Stripe...", en: "Checking Stripe..." },
  "disponivel_para_saque": { pt: "Disponível para saque", en: "Available for payout" },
  "a_liberar": { pt: "A liberar", en: "Pending" },
  "proximo_saque": { pt: "Próximo saque", en: "Next payout" },
  "previsto_para_chegada": { pt: "previsto para {chegada}", en: "expected on {chegada}" },
  "cronograma_de_saque": { pt: "Cronograma de saque", en: "Payout schedule" },
  "conta_bancaria": { pt: "Conta bancária", en: "Bank account" },
  "nao_informada": { pt: "Não informada", en: "Not provided" },
  "ultimos_saques": { pt: "Últimos saques", en: "Latest payouts" },
  "nenhum_saque_ainda": { pt: "Nenhum saque ainda.", en: "No payouts yet." },
});
