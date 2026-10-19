// Cliente mínimo da API do Stripe (REST + fetch, sem SDK). Nunca importar no navegador.
// Segredos: STRIPE_SECRET_KEY (sk_...) e STRIPE_WEBHOOK_SECRET (whsec_...).
// Sem STRIPE_SECRET_KEY a plataforma confirma inscrições sem cobrança, como antes.
import "@tanstack/react-start/server-only";
import { codificarFormulario, type CobrancaStripe, type SessaoCheckout } from "@/lib/stripe";

const API = "https://api.stripe.com/v1";

export function stripeConfigurado(): boolean {
  return !!process.env["STRIPE_SECRET_KEY"];
}

export function segredoWebhook(): string {
  return process.env["STRIPE_WEBHOOK_SECRET"] ?? "";
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
      payment_intent_data: { metadata: { inscricaoId: d.inscricaoId } },
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

/** Reembolso integral do PaymentIntent; a chave de idempotência evita reembolsar duas vezes. */
export function criarReembolso(inscricaoId: string, intencaoId: string): Promise<{ id: string; status?: string }> {
  return chamarStripe("POST", "/refunds", { payment_intent: intencaoId, metadata: { inscricaoId } }, `estorno-${inscricaoId}`);
}

export type { CobrancaStripe };
