// Textos de src/lib/stripe.ts.
import { dicionario } from "@/i18n/dicionario";

export const tr = dicionario("lib/stripe", {
  "aguardando_resposta": { pt: "Aguardando resposta", en: "Awaiting response" },
  "em_analise_pelo_banco": { pt: "Em análise pelo banco", en: "Under review by the bank" },
  "ganha": { pt: "Ganha", en: "Won" },
  "perdida": { pt: "Perdida", en: "Lost" },
  "encerrada": { pt: "Encerrada", en: "Closed" },
  "de_teste": { pt: "de teste", en: "test" },
  "de_producao": { pt: "de produção", en: "live" },
  "stripe_browser_public_key_nao_e": { pt: "STRIPE_BROWSER_PUBLIC_KEY não é uma chave publicável do Stripe (deve começar com pk_test_ ou pk_live_).", en: "STRIPE_BROWSER_PUBLIC_KEY is not a Stripe publishable key (it must start with pk_test_ or pk_live_)." },
  "stripe_server_api_key_nao_e": { pt: "STRIPE_SERVER_API_KEY não é uma chave secreta do Stripe (deve começar com sk_test_, sk_live_ ou rk_).", en: "STRIPE_SERVER_API_KEY is not a Stripe secret key (it must start with sk_test_, sk_live_ or rk_)." },
  "a_chave_secreta_e_valor_e": { pt: "A chave secreta é {valor} e a publicável é {valor2}: use as duas do mesmo modo.", en: "The secret key is {valor} and the publishable key is {valor2}: use both from the same mode." },
  "stripe_server_api_key_e_stripe": { pt: "STRIPE_SERVER_API_KEY e STRIPE_BROWSER_PUBLIC_KEY são de contas Stripe diferentes (por exemplo, uma de uma sandbox e outra do modo de teste). Copie as duas da mesma tela de chaves de API.", en: "STRIPE_SERVER_API_KEY and STRIPE_BROWSER_PUBLIC_KEY belong to different Stripe accounts (for example, one from a sandbox and the other from test mode). Copy both from the same API keys screen." },
  "stripe_mensagem": { pt: "(Stripe: {mensagem})", en: "(Stripe: {mensagem})" },
  "o_stripe_nao_libera_a_criacao": { pt: "O Stripe não libera a criação de contas conectadas pela API Accounts v1 nesta conta. No painel do Stripe (modo de produção), ative \"Accounts v1 support\" nas configurações do Connect e tente de novo.{doStripe}", en: "Stripe does not allow creating connected accounts through the Accounts v1 API on this account. In the Stripe dashboard (live mode), enable \"Accounts v1 support\" in the Connect settings and try again.{doStripe}" },
  "o_stripe_recusou_a_chave_secreta": { pt: "O Stripe recusou a chave secreta da plataforma (STRIPE_SERVER_API_KEY). Confira se ela foi copiada inteira e se o site foi publicado de novo depois da troca.{doStripe}", en: "Stripe rejected the platform secret key (STRIPE_SERVER_API_KEY). Check that it was copied in full and that the site was republished after the change.{doStripe}" },
  "o_stripe_recusou_esta_operacao_de": { pt: "O Stripe recusou esta operação de contas conectadas.{doStripe}", en: "Stripe rejected this connected-accounts operation.{doStripe}" },
  "a_conta_stripe_da_plataforma_ainda": { pt: "A conta Stripe da plataforma ainda não está ativada em produção, e o Stripe só deixa criar contas conectadas depois disso. Quem administra o Stripe da plataforma precisa concluir a ativação em https://dashboard.stripe.com/account/onboarding e tentar de novo.{doStripe}", en: "The platform's Stripe account is not activated in live mode yet, and Stripe only allows creating connected accounts after that. Whoever manages the platform's Stripe must finish activation at https://dashboard.stripe.com/account/onboarding and try again.{doStripe}" },
  "o_stripe_connect_ainda_nao_esta": { pt: "O Stripe Connect ainda não está ativado na conta da plataforma neste modo. Ative o Connect no painel do Stripe (modo de produção) e tente de novo.", en: "Stripe Connect is not enabled on the platform account in this mode yet. Enable Connect in the Stripe dashboard (live mode) and try again." },
  "stripe_mensagem_2": { pt: "Stripe: {mensagem}", en: "Stripe: {mensagem}" },
  "nao_foi_possivel_falar_com_o_stripe": { pt: "Não foi possível falar com o Stripe agora. Tente novamente em instantes.", en: "Could not reach Stripe right now. Try again in a moment." },
});
