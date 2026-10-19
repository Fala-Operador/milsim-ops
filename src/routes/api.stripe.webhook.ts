// Webhook do Stripe (POST /api/stripe/webhook). Cadastre no painel do Stripe com os eventos:
// checkout.session.completed, checkout.session.async_payment_succeeded,
// checkout.session.async_payment_failed, checkout.session.expired e charge.refunded.
// A assinatura (STRIPE_WEBHOOK_SECRET) é conferida sobre o corpo bruto antes de qualquer leitura.
import { createFileRoute } from "@tanstack/react-router";
import { assinaturaValida, type EventoStripe } from "@/lib/stripe";
import { segredoWebhook } from "@/server/stripe.server";
import { tratarEventoStripe } from "@/server/pagamentos.server";

export const Route = createFileRoute("/api/stripe/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const corpo = await request.text();
        if (!(await assinaturaValida(corpo, request.headers.get("stripe-signature"), segredoWebhook()))) {
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
