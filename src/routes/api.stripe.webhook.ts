// Eventos do Stripe (POST /api/stripe/webhook). Quem chama é a Edge Function do Supabase
// `stripe-webhook` (supabase/functions/stripe-webhook): ela recebe os webhooks do Stripe,
// confere a assinatura do Stripe com STRIPE_WEBHOOK_SECRET / STRIPE_CONNECT_WEBHOOK_SECRET
// (guardados só no Supabase) e repassa o evento para cá assinado com MILSIM_WEBHOOK_SECRET,
// o segredo compartilhado entre a função e o site. A assinatura é conferida sobre o corpo
// bruto antes de qualquer leitura.
import { createFileRoute } from "@tanstack/react-router";
import { assinaturaValida, CABECALHO_ASSINATURA_INTERNA, type EventoStripe } from "@/lib/stripe";
import { segredoWebhookInterno } from "@/server/stripe.server";
import { tratarEventoStripe } from "@/server/pagamentos.server";

export const Route = createFileRoute("/api/stripe/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const corpo = await request.text();
        if (!(await assinaturaValida(corpo, request.headers.get(CABECALHO_ASSINATURA_INTERNA), segredoWebhookInterno()))) {
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
