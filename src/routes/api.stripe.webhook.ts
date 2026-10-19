// Webhook do Stripe (POST /api/stripe/webhook). Cadastre no painel do Stripe com os eventos:
// checkout.session.completed, checkout.session.async_payment_succeeded,
// checkout.session.async_payment_failed, checkout.session.expired e charge.refunded.
// Para o repasse às organizações, cadastre também um endpoint de Connect (mesma URL) com
// account.updated; o segredo dele vai em STRIPE_CONNECT_WEBHOOK_SECRET.
// A assinatura é conferida sobre o corpo bruto antes de qualquer leitura.
import { createFileRoute } from "@tanstack/react-router";
import { assinaturaValida, type EventoStripe } from "@/lib/stripe";
import { segredosWebhook } from "@/server/stripe.server";
import { tratarEventoStripe } from "@/server/pagamentos.server";

export const Route = createFileRoute("/api/stripe/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const corpo = await request.text();
        const assinatura = request.headers.get("stripe-signature");
        const valida = (await Promise.all(segredosWebhook().map((s) => assinaturaValida(corpo, assinatura, s)))).some(Boolean);
        if (!valida) {
          return new Response("Assinatura inválida.", { status: 400 });
        }
        let evento: EventoStripe;
        try {
          evento = JSON.parse(corpo) as EventoStripe;
        } catch {
          return new Response("Corpo inválido.", { status: 400 });
        }
        try {
          await tratarEventoStripe(evento);
        } catch (e) {
          // Resposta de erro faz o Stripe reenviar o evento depois (o tratamento é idempotente).
          console.error("Stripe webhook", evento.type, evento.id, e);
          return new Response("Falha ao processar.", { status: 500 });
        }
        return Response.json({ recebido: true });
      },
    },
  },
});
