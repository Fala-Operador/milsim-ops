// Textos de src/components/RecebimentosOrganizacao.tsx.
import { dicionario } from "@/i18n/dicionario";

export const tr = dicionario("components/RecebimentosOrganizacao", {
  "nao_foi_possivel_atualizar_a_situacao": { pt: "Não foi possível atualizar a situação da conta.", en: "Could not update the account status." },
  "nao_foi_possivel_abrir_o_cadastro": { pt: "Não foi possível abrir o cadastro.", en: "Could not open onboarding." },
  "nao_foi_possivel_abrir_o_painel": { pt: "Não foi possível abrir o painel do Stripe.", en: "Could not open the Stripe dashboard." },
  "recebimentos_das_vendas": { pt: "Recebimentos das vendas", en: "Sales payouts" },
  "recebimentos_valor": { pt: "Recebimentos: {valor}", en: "Payouts: {valor}" },
  "o_stripe_ainda_pede_length_informacao": { pt: "O Stripe ainda pede {length} informação(ões). Continue o cadastro para concluir.", en: "Stripe still needs {length} item(s) of information. Continue onboarding to finish." },
  "abrindo_o_stripe": { pt: "Abrindo o Stripe...", en: "Opening Stripe..." },
  "continuar_cadastro": { pt: "Continuar cadastro", en: "Continue onboarding" },
  "continuar_cadastro_no_stripe": { pt: "Continuar cadastro no Stripe", en: "Continue onboarding on Stripe" },
  "configurar_recebimentos": { pt: "Configurar recebimentos", en: "Set up payouts" },
  "fechar_cadastro": { pt: "Fechar cadastro", en: "Close onboarding" },
  "abrir_painel_do_stripe": { pt: "Abrir painel do Stripe", en: "Open Stripe dashboard" },
  "repasse_ativo_com_taxa": { pt: "As vendas pagas online são repassadas automaticamente para a conta da organização, descontada a taxa da plataforma de {taxa}. O Stripe deposita o saldo na conta bancária cadastrada.", en: "Sales paid online are transferred automatically to the organization's account, minus the platform fee of {taxa}. Stripe deposits the balance into the registered bank account." },
  "repasse_ativo_sem_taxa": { pt: "As vendas pagas online são repassadas automaticamente para a conta da organização. O Stripe deposita o saldo na conta bancária cadastrada.", en: "Sales paid online are transferred automatically to the organization's account. Stripe deposits the balance into the registered bank account." },
  "conecte_conta_com_taxa": { pt: "Conecte uma conta Stripe para receber as vendas automaticamente (taxa da plataforma: {taxa}). Enquanto ela não estiver ativa, os ingressos pagos não são vendidos; inscrições gratuitas e cortesias seguem normalmente.", en: "Connect a Stripe account to receive sales automatically (platform fee: {taxa}). Until it is active, paid tickets are not sold; free registrations and complimentary tickets work as usual." },
  "conecte_conta_sem_taxa": { pt: "Conecte uma conta Stripe para receber as vendas automaticamente. Enquanto ela não estiver ativa, os ingressos pagos não são vendidos; inscrições gratuitas e cortesias seguem normalmente.", en: "Connect a Stripe account to receive sales automatically. Until it is active, paid tickets are not sold; free registrations and complimentary tickets work as usual." },
});
