// Edge Function "stripe-webhook": endpoint cadastrado no Stripe para os webhooks da conta da
// plataforma e de Connect. Confere a assinatura do Stripe (Stripe-Signature) com os segredos
// guardados só aqui e repassa o evento, intacto, para a API do site, assinado com o segredo
// compartilhado STRIPE_WEBHOOK_FORWARD_SECRET. As regras (confirmar inscrição, liberar vaga, reembolso,
// situação da conta da organização) rodam no site, em src/server/pagamentos.server.ts.
//
// Segredos (Supabase → Edge Functions → Secrets); o nome antigo, entre parênteses, ainda vale:
//   STRIPE_PAYMENTS_WEBHOOK_SIGNING_SECRET  whsec_... do endpoint "Events on your account"
//                                           (STRIPE_WEBHOOK_SECRET)
//   STRIPE_CONNECT_WEBHOOK_SIGNING_SECRET   whsec_... do endpoint "Events on Connected accounts"
//                                           (STRIPE_CONNECT_WEBHOOK_SECRET)
//   STRIPE_WEBHOOK_FORWARD_URL              https://<site>/api/stripe/webhook (MILSIM_WEBHOOK_URL)
//   STRIPE_WEBHOOK_FORWARD_SECRET           segredo aleatório, igual ao do site
//                                           (MILSIM_WEBHOOK_SECRET)
//
// Eventos a assinar no Stripe:
//   conta da plataforma: checkout.session.completed, checkout.session.async_payment_succeeded,
//     checkout.session.async_payment_failed, checkout.session.expired, charge.refunded,
//     charge.dispute.created, charge.dispute.updated, charge.dispute.closed
//   contas conectadas (Connect): account.updated
//
// Publicar sem exigir JWT (o Stripe não envia token do Supabase):
//   supabase functions deploy stripe-webhook --no-verify-jwt

const TOLERANCIA_S = 300; // mesma tolerância do SDK do Stripe (protege contra replay)
const CABECALHO_INTERNO = "x-milsim-assinatura";

const hex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");

async function hmac(segredo: string, mensagem: string): Promise<string> {
  const chave = await crypto.subtle.importKey("raw", new TextEncoder().encode(segredo), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return hex(await crypto.subtle.sign("HMAC", chave, new TextEncoder().encode(mensagem)));
}

function iguais(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let dif = 0;
  for (let i = 0; i < a.length; i++) dif |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return dif === 0;
}

/** Igual a stripe.webhooks.constructEvent: t=...,v1=... sobre "t.corpo", dentro da tolerância. */
async function assinaturaDoStripeValida(corpo: string, cabecalho: string | null, segredos: string[]): Promise<boolean> {
  if (!cabecalho) return false;
  let t = NaN;
  const v1: string[] = [];
  for (const parte of cabecalho.split(",")) {
    const [k, v] = parte.split("=", 2).map((x) => x.trim());
    if (k === "t") t = Number(v);
    else if (k === "v1" && v) v1.push(v);
  }
  if (!Number.isFinite(t) || !v1.length || Math.abs(Date.now() / 1000 - t) > TOLERANCIA_S) return false;
  for (const segredo of segredos) {
    const esperada = await hmac(segredo, `${t}.${corpo}`);
    if (v1.some((a) => iguais(a, esperada))) return true;
  }
  return false;
}

/** Lê o segredo pelo nome novo ou, enquanto não for recadastrado, pelo nome antigo. */
const lerSegredo = (nome: string, nomeAntigo: string) => Deno.env.get(nome)?.trim() || Deno.env.get(nomeAntigo)?.trim() || undefined;

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Método não permitido.", { status: 405 });
  const segredos = [
    lerSegredo("STRIPE_PAYMENTS_WEBHOOK_SIGNING_SECRET", "STRIPE_WEBHOOK_SECRET"),
    lerSegredo("STRIPE_CONNECT_WEBHOOK_SIGNING_SECRET", "STRIPE_CONNECT_WEBHOOK_SECRET"),
  ].filter((s): s is string => !!s);
  const destino = lerSegredo("STRIPE_WEBHOOK_FORWARD_URL", "MILSIM_WEBHOOK_URL");
  const segredoInterno = lerSegredo("STRIPE_WEBHOOK_FORWARD_SECRET", "MILSIM_WEBHOOK_SECRET");
  if (!segredos.length || !destino || !segredoInterno) {
    console.error("stripe-webhook: segredos ou URL do site não configurados");
    return new Response("Função não configurada.", { status: 500 }); // o Stripe tenta de novo depois
  }

  const corpo = await req.text();
  if (!(await assinaturaDoStripeValida(corpo, req.headers.get("stripe-signature"), segredos))) {
    return new Response("Assinatura inválida.", { status: 400 });
  }

  // Repassa o evento ao site com a assinatura interna (mesmo formato do Stripe).
  const t = Math.floor(Date.now() / 1000);
  try {
    const r = await fetch(destino, {
      method: "POST",
      headers: { "content-type": "application/json", [CABECALHO_INTERNO]: `t=${t},v1=${await hmac(segredoInterno, `${t}.${corpo}`)}` },
      body: corpo,
      signal: AbortSignal.timeout(25_000),
    });
    if (r.ok) return Response.json({ recebido: true });
    console.error("stripe-webhook: site respondeu", r.status, (await r.text()).slice(0, 300));
  } catch (e) {
    console.error("stripe-webhook: falha ao chamar o site", e);
  }
  // Erro devolvido ao Stripe = nova tentativa mais tarde (o tratamento no site é idempotente).
  return new Response("Falha ao repassar o evento.", { status: 502 });
});
