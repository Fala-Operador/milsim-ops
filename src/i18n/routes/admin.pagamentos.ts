// Textos de src/routes/admin.pagamentos.tsx.
import { dicionario } from "@/i18n/dicionario";

export const tr = dicionario("routes/admin.pagamentos", {
  "pagamentos_admin_milsim_ops": { pt: "Pagamentos — Admin MilSim Ops", en: "Payments — MilSim Ops Admin" },
  "taxa_da_plataforma_e_contas_de": { pt: "Taxa da plataforma e contas de recebimento das organizações.", en: "Platform fee and organizations' payout accounts." },
  "pagamentos": { pt: "Pagamentos", en: "Payments" },
  "taxa_da_plataforma_e_situacao_das": { pt: "Taxa da plataforma e situação das contas de recebimento das organizações no Stripe Connect.", en: "Platform fee and status of the organizations' payout accounts on Stripe Connect." },
  "taxa_da_plataforma": { pt: "Taxa da plataforma", en: "Platform fee" },
  "contas_ativas": { pt: "Contas ativas", en: "Active accounts" },
  "pagamentos_online": { pt: "Pagamentos online", en: "Online payments" },
  "ligados": { pt: "Ligados", en: "On" },
  "desligados": { pt: "Desligados", en: "Off" },
  "os_pagamentos_online_estao_desligados_fa": { pt: "Os pagamentos online estão desligados: falta configurar a chave secreta do Stripe no servidor. A taxa pode ser definida mesmo assim.", en: "Online payments are off: the Stripe secret key is not configured on the server. The fee can be set anyway." },
  "os_paineis_do_stripe_dentro_do": { pt: "Os painéis do Stripe dentro do site estão desligados: {avisoChaves} Enquanto isso, o cadastro de recebimentos abre no site do Stripe.", en: "The Stripe panels inside the site are off: {avisoChaves} Meanwhile, payout setup opens on the Stripe site." },
  "taxa_da_plataforma_organizacao": { pt: "Taxa da plataforma (organização)", en: "Platform fee (organization)" },
  "percentual_retido_em_cada_ingresso_vendi": { pt: "Percentual retido em cada ingresso vendido online e repassado à organização pelo Stripe Connect. Organizações sem conta de recebimento ativa não vendem ingressos pagos.", en: "Percentage kept on each ticket sold online, with the rest passed to the organization through Stripe Connect. Organizations without an active payout account do not sell paid tickets." },
  "exemplo_num_ingresso_de_valor_a": { pt: "Exemplo: num ingresso de {valor}, a plataforma retém {valor2} e a organização recebe {valor3}.", en: "Example: on a {valor} ticket, the platform keeps {valor2} and the organization receives {valor3}." },
  "ultima_alteracao_da_taxa": { pt: "Última alteração da taxa:", en: "Last fee change:" },
  "a_taxa_de_servico_do_comprador": { pt: ". A taxa de serviço do comprador é definida por cada organização no Financeiro dela.", en: ". The buyer service fee is set by each organization in its Finance page." },
  "contas_de_recebimento_das_organizacoes": { pt: "Contas de recebimento das organizações", en: "Organizations' payout accounts" },
  "recebimentos_valor": { pt: "Recebimentos: {valor}", en: "Payouts: {valor}" },
  "recebimentos_nao_configurado": { pt: "Recebimentos: não configurado", en: "Payouts: not set up" },
  "nao_configurado": { pt: "Não configurado", en: "Not set up" },
  "nenhuma_organizacao_cadastrada": { pt: "Nenhuma organização cadastrada.", en: "No organizations registered." },
  "x_de_y": { pt: "{x} de {y}", en: "{x} of {y}" },
});
