// Partes puras da integração com o Stripe (sem segredos nem rede): codificação dos
// parâmetros da API, verificação da assinatura do webhook e leitura dos eventos.
// Chamadas HTTP ficam em src/server/stripe.server.ts.

import type { DisputaPagamento, StatusDisputa } from "@/lib/domain/types";
import { tr } from "@/i18n/lib/stripe";

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

/**
 * Cabeçalho com que a Edge Function milsim-stripe-webhook assina o evento repassado ao site, no
 * mesmo formato do Stripe-Signature (t=...,v1=HMAC-SHA256 de "t.corpo").
 */
export const CABECALHO_ASSINATURA_INTERNA = "x-milsim-assinatura";

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

/** Contestação (charge.dispute.*): só os campos usados aqui. */
export interface DisputaStripe {
  id: string;
  amount: number;
  status: string;
  reason?: string | null;
  created: number;
  charge?: string | { id: string } | null;
  payment_intent?: string | { id: string } | null;
}

export interface EventoStripe {
  id: string;
  type: string;
  data: { object: unknown };
}

const idDe = (x: string | { id: string } | null | undefined) => (typeof x === "string" ? x : x?.id);

/** Compra de impulso (metadata.impulsoId); sessões de ingresso não têm esse campo. */
export const impulsoDaSessao = (s: SessaoCheckout) => s.metadata?.["impulsoId"] || undefined;
export const inscricaoDaSessao = (s: SessaoCheckout) =>
  impulsoDaSessao(s) ? undefined : s.metadata?.["inscricaoId"] || s.client_reference_id || undefined;
export const intencaoDaSessao = (s: SessaoCheckout) => idDe(s.payment_intent);
export const intencaoDaCobranca = (c: CobrancaStripe) => idDe(c.payment_intent);
export const intencaoDaDisputa = (d: DisputaStripe) => idDe(d.payment_intent);

/** Situação da contestação no Stripe → situação guardada no pagamento. */
export function statusDaDisputa(status: string): StatusDisputa {
  switch (status) {
    case "won":
      return "ganha";
    case "lost":
      return "perdida";
    case "warning_closed":
    case "prevented":
      return "encerrada";
    case "under_review":
    case "warning_under_review":
      return "em_analise";
    default:
      return "aberta"; // needs_response, warning_needs_response
  }
}

export function disputaDoStripe(d: DisputaStripe, agora = new Date()): DisputaPagamento {
  return {
    status: statusDaDisputa(d.status),
    valorCentavos: d.amount,
    motivo: d.reason ?? undefined,
    abertaEm: new Date(d.created * 1000).toISOString(),
    atualizadaEm: agora.toISOString(),
  };
}

export const ROTULO_DISPUTA: Record<StatusDisputa, string> = {
  get aberta() { return tr("aguardando_resposta"); },
  get em_analise() { return tr("em_analise_pelo_banco"); },
  get ganha() { return tr("ganha"); },
  get perdida() { return tr("perdida"); },
  get encerrada() { return tr("encerrada"); },
};

/** Contestação ainda sem decisão. */
export const disputaEmAberto = (d: DisputaPagamento | undefined) => d?.status === "aberta" || d?.status === "em_analise";

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

const CHAVE_SECRETA = /^(sk|rk)_(test|live)_(.+)$/;
const CHAVE_PUBLICAVEL = /^pk_(test|live)_(.+)$/;
const MODO = { get test() { return tr("de_teste"); }, get live() { return tr("de_producao"); } } as const;

/**
 * Confere se a chave publicável combina com a secreta (mesmo modo e mesma conta Stripe). Uma
 * Account Session criada com a chave secreta de uma conta não abre com a publicável de outra
 * (erro "No account session with that client secret was found"). As chaves de uma conta
 * começam pelo mesmo trecho derivado do id dela. Devolve "" quando está tudo certo.
 */
export function problemaDasChaves(secreta: string | undefined, publicavel: string | undefined): string {
  if (!secreta || !publicavel) return "";
  const s = CHAVE_SECRETA.exec(secreta.trim());
  const p = CHAVE_PUBLICAVEL.exec(publicavel.trim());
  if (!p) return tr("stripe_browser_public_key_nao_e");
  if (!s) return tr("stripe_server_api_key_nao_e");
  const modoS = s[2] as keyof typeof MODO, corpoS = s[3]!;
  const modoP = p[1] as keyof typeof MODO, corpoP = p[2]!;
  if (modoS !== modoP) return tr("a_chave_secreta_e_valor_e", { valor: MODO[modoS], valor2: MODO[modoP] });
  if (corpoS.slice(0, 12) !== corpoP.slice(0, 12)) {
    return tr("stripe_server_api_key_e_stripe");
  }
  return "";
}

/**
 * Conta conectada que existe só no outro modo do Stripe: com a chave de produção, uma conta
 * criada no modo de teste responde 404 "a similar object exists in test mode" (e vice-versa).
 */
export function contaDeOutroModo(status: number, mensagem: string): boolean {
  return status === 404 && /similar object exists in (test|live) mode/i.test(mensagem);
}

/** 403 do Stripe quando a conta guardada não pertence à plataforma desta chave (ex.: criada numa sandbox). */
const SEM_ACESSO_A_CONTA = /does not have access to account|application access may have been revoked/i;

/**
 * Conta conectada guardada que esta chave não alcança: de outro modo do Stripe ou de outra
 * conta de plataforma (sandbox). Nos dois casos a organização precisa de uma conta nova.
 */
export function contaInacessivel(status: number, mensagem: string): boolean {
  return contaDeOutroModo(status, mensagem) || (status === 403 && SEM_ACESSO_A_CONTA.test(mensagem));
}

/** Tira chaves de API (mesmo mascaradas, como "sk_live_***...gelA") de uma mensagem do Stripe. */
export function ocultarChaves(mensagem: string): string {
  return mensagem.replace(/'?\b(?:sk|rk|pk)_(?:test|live)_[\w*.…]+'?/g, "[chave oculta]");
}

export const MSG_FALHA_STRIPE = () => tr("nao_foi_possivel_falar_com_o_stripe");

/**
 * Mensagem para quem gere a organização quando uma chamada de Connect falha. Erros de
 * configuração da plataforma (chave recusada ou sem permissão, Connect desligado) dizem o que
 * conferir, em vez do genérico "tente novamente", que só vale para falha de rede ou do Stripe.
 */
export function mensagemDeFalhaStripe(status: number, original: string): string {
  const mensagem = ocultarChaves(original);
  const doStripe = mensagem ? ` ${tr("stripe_mensagem", { mensagem })}` : "";
  if (/accounts v1/i.test(mensagem)) return tr("o_stripe_nao_libera_a_criacao", { doStripe });
  if (status === 401) return tr("o_stripe_recusou_a_chave_secreta", { doStripe });
  if (status === 403) return tr("o_stripe_recusou_esta_operacao_de", { doStripe });
  if (/must be activated in order to create accounts/i.test(mensagem)) return tr("a_conta_stripe_da_plataforma_ainda", { doStripe });
  if (status === 400 && /signed up for connect/i.test(mensagem)) return tr("o_stripe_connect_ainda_nao_esta");
  if (status === 400 || status === 404) return tr("stripe_mensagem_2", { mensagem });
  return MSG_FALHA_STRIPE();
}

/** Checkout recusado porque a conta de destino não existe neste modo do Stripe ou não é desta plataforma. */
export function destinoInvalido(status: number, mensagem: string): boolean {
  return ((status === 400 || status === 404) && /no such destination|similar object exists in (test|live) mode/i.test(mensagem))
    || (status === 403 && SEM_ACESSO_A_CONTA.test(mensagem));
}
