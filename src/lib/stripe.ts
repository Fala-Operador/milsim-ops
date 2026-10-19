// Partes puras da integração com o Stripe (sem segredos nem rede): codificação dos
// parâmetros da API, verificação da assinatura do webhook e leitura dos eventos.
// Chamadas HTTP ficam em src/server/stripe.server.ts.

type Valor = string | number | boolean | undefined | null | Valor[] | { [k: string]: Valor };

/** Codifica objetos aninhados no formato da API do Stripe: a[b][0][c]=valor. */
export function codificarFormulario(dados: Record<string, Valor>): string {
  const pares: string[] = [];
  const visitar = (chave: string, v: Valor) => {
    if (v === undefined || v === null) return;
    if (Array.isArray(v)) v.forEach((item, i) => visitar(`${chave}[${i}]`, item));
    else if (typeof v === "object") for (const [k, sub] of Object.entries(v)) visitar(`${chave}[${k}]`, sub);
    else pares.push(`${encodeURIComponent(chave)}=${encodeURIComponent(String(v))}`);
  };
  for (const [k, v] of Object.entries(dados)) visitar(k, v);
  return pares.join("&");
}

/** Tolerância padrão do Stripe para o horário da assinatura (protege contra replay). */
export const TOLERANCIA_ASSINATURA_S = 300;

function hex(buf: ArrayBuffer): string {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function iguaisEmTempoConstante(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let dif = 0;
  for (let i = 0; i < a.length; i++) dif |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return dif === 0;
}

export async function assinarPayload(segredo: string, timestamp: number, corpo: string): Promise<string> {
  const chave = await crypto.subtle.importKey("raw", new TextEncoder().encode(segredo), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return hex(await crypto.subtle.sign("HMAC", chave, new TextEncoder().encode(`${timestamp}.${corpo}`)));
}

/**
 * Confere o cabeçalho Stripe-Signature (t=...,v1=...) contra o corpo bruto da requisição.
 * Igual ao `stripe.webhooks.constructEvent` do SDK oficial.
 */
export async function assinaturaValida(
  corpo: string,
  cabecalho: string | null,
  segredo: string,
  agoraS = Math.floor(Date.now() / 1000),
  tolerancia = TOLERANCIA_ASSINATURA_S,
): Promise<boolean> {
  if (!cabecalho || !segredo) return false;
  let t = NaN;
  const assinaturas: string[] = [];
  for (const parte of cabecalho.split(",")) {
    const [k, v] = parte.split("=", 2).map((x) => x.trim());
    if (k === "t") t = Number(v);
    else if (k === "v1" && v) assinaturas.push(v);
  }
  if (!Number.isFinite(t) || assinaturas.length === 0) return false;
  if (Math.abs(agoraS - t) > tolerancia) return false;
  const esperada = await assinarPayload(segredo, t, corpo);
  return assinaturas.some((a) => iguaisEmTempoConstante(a, esperada));
}

/** Campos da Checkout Session usados pela aplicação. */
export interface SessaoCheckout {
  id: string;
  url?: string | null;
  status?: "open" | "complete" | "expired" | null;
  payment_status?: "paid" | "unpaid" | "no_payment_required" | null;
  payment_intent?: string | { id: string } | null;
  client_reference_id?: string | null;
  metadata?: Record<string, string> | null;
}

export interface CobrancaStripe {
  id: string;
  amount: number;
  amount_refunded: number;
  refunded?: boolean;
  payment_intent?: string | { id: string } | null;
  metadata?: Record<string, string> | null;
}

export interface EventoStripe {
  id: string;
  type: string;
  data: { object: unknown };
}

const idDe = (x: string | { id: string } | null | undefined) => (typeof x === "string" ? x : x?.id);

export const inscricaoDaSessao = (s: SessaoCheckout) => s.metadata?.["inscricaoId"] || s.client_reference_id || undefined;
export const intencaoDaSessao = (s: SessaoCheckout) => idDe(s.payment_intent);
export const intencaoDaCobranca = (c: CobrancaStripe) => idDe(c.payment_intent);

/** O que fazer com a inscrição a partir do estado de uma Checkout Session. */
export type AcaoSessao = "confirmar" | "processando" | "liberar_expirada" | "liberar_falha" | "nada";

export function acaoDoEvento(tipo: string, s: SessaoCheckout): AcaoSessao {
  switch (tipo) {
    case "checkout.session.completed":
      return s.payment_status === "paid" ? "confirmar" : "processando";
    case "checkout.session.async_payment_succeeded":
      return "confirmar";
    case "checkout.session.async_payment_failed":
      return "liberar_falha";
    case "checkout.session.expired":
      return "liberar_expirada";
    default:
      return "nada";
  }
}

/** Mesmo raciocínio para uma sessão consultada diretamente (retorno do checkout). */
export function acaoDaSessao(s: SessaoCheckout): AcaoSessao {
  if (s.payment_status === "paid") return "confirmar";
  if (s.status === "complete") return "processando";
  if (s.status === "expired") return "liberar_expirada";
  return "nada";
}
