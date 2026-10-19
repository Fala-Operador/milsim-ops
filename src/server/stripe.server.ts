// Cliente mínimo da API do Stripe (REST + fetch, sem SDK). Nunca importar no navegador.
// Segredos: STRIPE_SECRET_KEY (sk_...) e STRIPE_WEBHOOK_SECRET (whsec_...).
// Sem STRIPE_SECRET_KEY a plataforma confirma inscrições sem cobrança, como antes.
import "@tanstack/react-start/server-only";
import { codificarFormulario, type CobrancaStripe, type SessaoCheckout } from "@/lib/stripe";
import type { ContaStripe } from "@/lib/repasses";

const API = "https://api.stripe.com/v1";

export function stripeConfigurado(): boolean {
  return !!process.env["STRIPE_SECRET_KEY"];
}

/**
 * Segredos de assinatura aceitos no webhook: o do endpoint da conta da plataforma e, se
 * houver, o do endpoint de Connect (eventos das contas das organizações, ex. account.updated).
 */
export function segredosWebhook(): string[] {
  return [process.env["STRIPE_WEBHOOK_SECRET"], process.env["STRIPE_CONNECT_WEBHOOK_SECRET"]].filter((s): s is string => !!s);
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
): Promise<T> {
  const chave = process.env["STRIPE_SECRET_KEY"];
  if (!chave) throw new ErroStripe(0, "nao_configurado", "Stripe não configurado.");
  const cabecalhos: Record<string, string> = { Authorization: `Bearer ${chave}` };
  if (dados) cabecalhos["Content-Type"] = "application/x-www-form-urlencoded";
  if (idempotencia) cabecalhos["Idempotency-Key"] = idempotencia;
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

// ---------- Stripe Connect (contas Express das organizações) ----------

/** Taxa da plataforma sobre as vendas repassadas (%), de STRIPE_TAXA_PLATAFORMA_PERCENTUAL. */
export function taxaPlataformaPercentual(): number {
  const v = Number(String(process.env["STRIPE_TAXA_PLATAFORMA_PERCENTUAL"] ?? "0").replace(",", "."));
  return Number.isFinite(v) && v > 0 ? Math.min(v, 100) : 0;
}

/** Cria a conta Express da organização (uma por organização, pela chave de idempotência). */
export function criarContaConectada(d: { organizacaoId: string; nome: string; email?: string | undefined }): Promise<ContaStripe> {
  return chamarStripe<ContaStripe>(
    "POST",
    "/accounts",
    {
      type: "express",
      country: "BR",
      email: d.email,
      business_profile: { name: d.nome },
      capabilities: { card_payments: { requested: true }, transfers: { requested: true } },
      metadata: { organizacaoId: d.organizacaoId },
    },
    `conta-${d.organizacaoId}`,
  );
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

export type { CobrancaStripe };
