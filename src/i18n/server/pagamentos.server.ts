// Textos de src/server/pagamentos.server.ts.
import { dicionario } from "@/i18n/dicionario";

export const tr = dicionario("server/pagamentos.server", {
  "reserva_nao_encontrada": { pt: "Reserva não encontrada.", en: "Reservation not found." },
  "esta_reserva_nao_esta_mais_aguardando": { pt: "Esta reserva não está mais aguardando pagamento.", en: "This reservation is no longer awaiting payment." },
  "o_prazo_desta_reserva_terminou_faca": { pt: "O prazo desta reserva terminou. Faça uma nova inscrição.", en: "This reservation has expired. Register again." },
  "esta_reserva_ja_foi_concluida_ou": { pt: "Esta reserva já foi concluída ou expirou. Confira em Meus ingressos.", en: "This reservation is already completed or expired. Check My tickets." },
  "nao_foi_possivel_consultar_o_pagamento": { pt: "Não foi possível consultar o pagamento agora.", en: "Could not check the payment right now." },
  "pagamento_nao_encontrado": { pt: "Pagamento não encontrado.", en: "Payment not found." },
  "pagamento_sem_identificador_no_stripe_re": { pt: "Pagamento sem identificador no Stripe; reembolse pelo painel.", en: "Payment has no Stripe identifier; refund it from the dashboard." },
  "falha_no_reembolso": { pt: "Falha no reembolso.", en: "Refund failed." },
  "impulso_nao_encontrado": { pt: "Impulso não encontrado.", en: "Boost not found." },
  "este_impulso_nao_esta_mais_aguardando": { pt: "Este impulso não está mais aguardando pagamento.", en: "This boost is no longer awaiting payment." },
  "este_pagamento_ja_foi_concluido_ou": { pt: "Este pagamento já foi concluído ou expirou. Confira em Impulsionar.", en: "This payment is already completed or expired. Check Boost." },
  "somente_a_administracao_sincroniza_os_im": { pt: "Somente a administração sincroniza os impulsos com o Stripe.", en: "Only the administration syncs boosts with Stripe." },
  "os_pagamentos_online_ainda_nao_estao": { pt: "Os pagamentos online ainda não estão ativados na plataforma.", en: "Online payments are not enabled on the platform yet." },
  "voce_so_pode_configurar_os_recebimentos": { pt: "Você só pode configurar os recebimentos da sua organização.", en: "You can only set up payouts for your own organization." },
  "sem_nome": { pt: "sem nome", en: "no name" },
  "nao": { pt: "não", en: "no" },
  "a_conta_stripe_da_plataforma_id": { pt: "A conta Stripe da plataforma ({id}, {nome}) já recebe pagamentos, mas o Stripe ainda não liberou a criação de contas conectadas em produção. No painel do Stripe, em modo de produção, conclua o perfil da plataforma do Connect em https://dashboard.stripe.com/connect/registration e confira nome, cor e ícone em Configurações → Connect; depois tente de novo. Se continuar, peça ao suporte do Stripe para liberar o Connect na conta.", en: "The platform's Stripe account ({id}, {nome}) already accepts payments, but Stripe has not yet allowed creating connected accounts in live mode. In the Stripe dashboard, in live mode, finish the Connect platform profile at https://dashboard.stripe.com/connect/registration and check the name, color and icon under Settings → Connect; then try again. If it persists, ask Stripe support to enable Connect on the account." },
  "message_conta_do_stripe_usada_pela": { pt: "{message} Conta do Stripe usada pela chave do site: {id} ({nome}; pagamentos ativos: {charges_enabled}; repasses ativos: {payouts_enabled}).", en: "{message} Stripe account used by the site key: {id} ({nome}; payments enabled: {charges_enabled}; payouts enabled: {payouts_enabled})." },
  "a_organizacao_ainda_nao_tem_conta": { pt: "A organização ainda não tem conta de recebimento.", en: "The organization does not have a payout account yet." },
  "os_paineis_do_stripe_ainda_nao": { pt: "Os painéis do Stripe ainda não foram ativados na plataforma.", en: "Stripe panels are not enabled on the platform yet." },
  "os_paineis_do_stripe_estao_mal": { pt: "Os painéis do Stripe estão mal configurados: {problema}", en: "Stripe panels are misconfigured: {problema}" },
  "nao_foi_possivel_abrir_o_pagamento_agora": { pt: "Não foi possível abrir o pagamento agora. Tente novamente em instantes.", en: "Could not open the payment right now. Try again in a moment." },
  "sim": { pt: "sim", en: "yes" },
});
