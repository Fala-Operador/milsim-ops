// Cliente mínimo da API do Stripe (REST + fetch, sem SDK). Nunca importar no navegador.
// Variáveis do site: STRIPE_SERVER_API_KEY (sk_...), STRIPE_BROWSER_PUBLIC_KEY (pk_..., opcional)
// e STRIPE_WEBHOOK_FORWARD_SECRET (compartilhado com a Edge Function stripe-webhook, que guarda
// os segredos de assinatura do Stripe). Sem a chave da API, inscrições confirmam sem cobrança.
import "@tanstack/react-start/server-only";
import { codificarFormulario, problemaDasChaves, type CobrancaStripe, type SessaoCheckout } from "@/lib/stripe";
import type { ContaStripe, PerfilComercial, SaldoStripe, SaqueStripe } from "@/lib/repasses";

const API = "https://api.stripe.com/v1";

/** Lê a variável pelo nome novo ou, enquanto não for recadastrada, pelo nome antigo. */
function variavel(nome: string, nomeAntigo: string): string | undefined {
  return process.env[nome]?.trim() || process.env[nomeAntigo]?.trim() || undefined;
}

/** Chave secreta (sk_... ou rk_...) com que o servidor chama a API do Stripe. */
const chaveApi = () => variavel("STRIPE_SERVER_API_KEY", "STRIPE_SECRET_KEY");

export function stripeConfigurado(): boolean {
  return !!chaveApi();
}

/** Chave publicável (pk_...), só para os componentes embutidos do Stripe Connect. */
export function chavePublicavel(): string | undefined {
  return variavel("STRIPE_BROWSER_PUBLIC_KEY", "STRIPE_PUBLISHABLE_KEY");
}

/** Chave publicável que não combina com a secreta (modo ou conta diferentes); "" quando ok. */
export function problemaChavesStripe(): string {
  return problemaDasChaves(chaveApi(), chavePublicavel());
}

/** Segredo com que a Edge Function stripe-webhook assina os eventos repassados ao site. */
export function segredoWebhookInterno(): string {
  return variavel("STRIPE_WEBHOOK_FORWARD_SECRET", "MILSIM_WEBHOOK_SECRET") ?? "";
}

export class ErroStripe extends Error {
  constructor(public status: number, public codigo: string | undefined, mensagem: string) {
    super(mensagem);
  }
}

async function chamarStripe<T>(
  metodo: "GET" | "POST",
  caminho: string,
  dados?: Parameters<typeof codificarFormulario>[0],
  idempotencia?: string,
  /** Conta conectada (acct_...): a chamada age em nome dela (cabeçalho Stripe-Account). */
  contaConectada?: string,
): Promise<T> {
  const chave = chaveApi();
  if (!chave) throw new ErroStripe(0, "nao_configurado", "Stripe não configurado.");
  const cabecalhos: Record<string, string> = { Authorization: `Bearer ${chave}` };
  if (dados) cabecalhos["Content-Type"] = "application/x-www-form-urlencoded";
  if (idempotencia) cabecalhos["Idempotency-Key"] = idempotencia;
  if (contaConectada) cabecalhos["Stripe-Account"] = contaConectada;
  const r = await fetch(`${API}${caminho}`, { method: metodo, headers: cabecalhos, body: dados ? codificarFormulario(dados) : null });
  const corpo = (await r.json().catch(() => ({}))) as { error?: { code?: string; message?: string } } & T;
  if (!r.ok) throw new ErroStripe(r.status, corpo.error?.code, corpo.error?.message ?? `Stripe respondeu ${r.status}.`);
  return corpo;
}

export interface DadosCheckout {
  inscricaoId: string;
  descricao: string;
  valorCentavos: number;
  expiraEm: string;
  email?: string | undefined;
  urlSucesso: string;
  urlCancelamento: string;
  /** Conta conectada (acct_...) que recebe a venda; sem ela o valor fica na plataforma. */
  contaDestino?: string | undefined;
  /** Taxa da plataforma retida no repasse, em centavos. */
  taxaCentavos?: number | undefined;
}

/** Abre uma Checkout Session em BRL; a inscrição vai em metadata e client_reference_id. */
export function criarSessaoCheckout(d: DadosCheckout): Promise<SessaoCheckout> {
  return chamarStripe<SessaoCheckout>(
    "POST",
    "/checkout/sessions",
    {
      mode: "payment",
      locale: "pt-BR",
      client_reference_id: d.inscricaoId,
      customer_email: d.email,
      expires_at: Math.floor(new Date(d.expiraEm).getTime() / 1000),
      success_url: d.urlSucesso,
      cancel_url: d.urlCancelamento,
      metadata: { inscricaoId: d.inscricaoId },
      // Cobrança com destino: o Stripe transfere à organização o valor menos a taxa.
      payment_intent_data: {
        metadata: { inscricaoId: d.inscricaoId },
        transfer_data: d.contaDestino ? { destination: d.contaDestino } : undefined,
        application_fee_amount: d.contaDestino && d.taxaCentavos ? d.taxaCentavos : undefined,
      },
      line_items: [{ quantity: 1, price_data: { currency: "brl", unit_amount: d.valorCentavos, product_data: { name: d.descricao } } }],
    },
    // Uma sessão por reserva: repetir a chamada devolve a mesma sessão.
    `checkout-${d.inscricaoId}`,
  );
}

export function obterSessaoCheckout(id: string): Promise<SessaoCheckout> {
  return chamarStripe<SessaoCheckout>("GET", `/checkout/sessions/${encodeURIComponent(id)}`);
}

/** Expira uma sessão aberta para que não possa mais ser paga (ignora sessões já encerradas). */
export async function expirarSessaoCheckout(id: string): Promise<void> {
  try {
    await chamarStripe("POST", `/checkout/sessions/${encodeURIComponent(id)}/expire`, {});
  } catch (e) {
    if (e instanceof ErroStripe && e.status >= 400 && e.status < 500) return; // já concluída ou expirada
    throw e;
  }
}

/**
 * Reembolso integral do PaymentIntent; a chave de idempotência evita reembolsar duas vezes.
 * Venda repassada: o valor volta da conta da organização e a taxa da plataforma é devolvida.
 */
export function criarReembolso(inscricaoId: string, intencaoId: string, repassada = false): Promise<{ id: string; status?: string }> {
  return chamarStripe(
    "POST",
    "/refunds",
    { payment_intent: intencaoId, metadata: { inscricaoId }, reverse_transfer: repassada || undefined, refund_application_fee: repassada || undefined },
    `estorno-${inscricaoId}`,
  );
}

// ---------- Stripe Connect (contas das organizações, painel Express) ----------

/** Versão da API v2 do Stripe (Accounts v2); a v1 segue a versão padrão da conta. */
const VERSAO_API_V2 = "2026-09-30.endive";

/** Chamada à API v2 do Stripe (corpo JSON). */
async function chamarStripeV2<T>(caminho: string, corpo: unknown, idempotencia?: string): Promise<T> {
  const chave = chaveApi();
  if (!chave) throw new ErroStripe(0, "nao_configurado", "Stripe não configurado.");
  const cabecalhos: Record<string, string> = {
    Authorization: `Bearer ${chave}`,
    "Stripe-Version": VERSAO_API_V2,
    "Content-Type": "application/json",
  };
  if (idempotencia) cabecalhos["Idempotency-Key"] = idempotencia;
  const r = await fetch(`https://api.stripe.com/v2${caminho}`, { method: "POST", headers: cabecalhos, body: JSON.stringify(corpo) });
  const resposta = (await r.json().catch(() => ({}))) as { error?: { code?: string; message?: string } } & T;
  if (!r.ok) throw new ErroStripe(r.status, resposta.error?.code, resposta.error?.message ?? `Stripe respondeu ${r.status}.`);
  return resposta;
}

/**
 * Cria a conta da organização pela Accounts v2 (o Stripe não libera a criação pela v1 em
 * produção para plataformas novas): conta recebedora (`recipient` com `stripe_transfers`) para
 * as cobranças com destino, painel Express e perdas e taxas com a plataforma, como nas contas
 * Express da v1. Uma por organização, pela chave de idempotência. O resto da integração
 * (cadastro, sessões, saldo, saques, cobranças com destino) segue na v1, que aceita contas da v2;
 * por isso a conta criada é relida pela v1.
 */
export async function criarContaConectada(d: {
  organizacaoId: string;
  perfil: PerfilComercial;
  email?: string | undefined;
  /** Conta descartada que esta substitui: muda a chave de idempotência para não repetir a criação anterior. */
  substituida?: string | undefined;
}): Promise<ContaStripe> {
  const { id } = await chamarStripeV2<{ id: string }>(
    "/core/accounts",
    {
      contact_email: d.email,
      display_name: d.perfil.name,
      dashboard: "express",
      identity: { country: "br" },
      defaults: { responsibilities: { fees_collector: "application", losses_collector: "application" } },
      configuration: { recipient: { capabilities: { stripe_balance: { stripe_transfers: { requested: true } } } } },
      metadata: { organizacaoId: d.organizacaoId },
    },
    `conta-v2-${d.organizacaoId}${d.substituida ? `-${d.substituida}` : ""}`,
  );
  return obterContaConectada(id);
}

/** Preenche site, ramo e descrição de uma conta criada antes desse preenchimento automático. */
export function completarPerfilComercial(contaId: string, perfil: PerfilComercial): Promise<ContaStripe> {
  return chamarStripe<ContaStripe>("POST", `/accounts/${encodeURIComponent(contaId)}`, { business_profile: perfil });
}

export function obterContaConectada(id: string): Promise<ContaStripe> {
  return chamarStripe<ContaStripe>("GET", `/accounts/${encodeURIComponent(id)}`);
}

/** Link de uso único para o cadastro (onboarding) hospedado pelo Stripe. */
export function linkDeCadastro(contaId: string, urlRetorno: string, urlRenovar: string): Promise<{ url: string }> {
  return chamarStripe("POST", "/account_links", { account: contaId, type: "account_onboarding", return_url: urlRetorno, refresh_url: urlRenovar });
}

/** Link de acesso ao painel Express (saldo, repasses e conta bancária da organização). */
export function linkDoPainel(contaId: string): Promise<{ url: string }> {
  return chamarStripe("POST", `/accounts/${encodeURIComponent(contaId)}/login_links`, {});
}

/** Saldo da conta conectada (disponível e a liberar, por moeda). */
export function saldoDaConta(contaId: string): Promise<SaldoStripe> {
  return chamarStripe<SaldoStripe>("GET", "/balance", undefined, undefined, contaId);
}

/** Últimos saques da conta conectada para o banco dela. */
export async function saquesDaConta(contaId: string, limite = 10): Promise<SaqueStripe[]> {
  const r = await chamarStripe<{ data?: SaqueStripe[] }>("GET", `/payouts?limit=${limite}`, undefined, undefined, contaId);
  return r.data ?? [];
}

/**
 * Account Session para os componentes embutidos: cadastro, avisos e dados da conta. Saldo e
 * saques são lidos pelo servidor (saldoDaConta, saquesDaConta) e mostrados no Financeiro.
 */
export function criarSessaoDeConta(contaId: string): Promise<{ client_secret: string; expires_at?: number }> {
  return chamarStripe("POST", "/account_sessions", {
    account: contaId,
    components: {
      account_onboarding: { enabled: true, features: { external_account_collection: true } },
      account_management: { enabled: true, features: { external_account_collection: true } },
      notification_banner: { enabled: true, features: { external_account_collection: true } },
    },
  });
}

export type { CobrancaStripe };
