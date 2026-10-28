// Volta do Google (?code=… ou ?error=…). Rota só do servidor: troca o código pela sessão e
// responde com um redirecionamento, sem carregar a página nem a base (src/server/auth.server.ts).
import { createFileRoute } from "@tanstack/react-router";
import { concluirLoginGoogle } from "@/server/auth.server";

export const Route = createFileRoute("/entrar-google")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const busca = new URL(request.url).searchParams;
        const destino = await concluirLoginGoogle(busca.get("code") ?? undefined, busca.get("error") ?? undefined);
        return new Response(null, { status: 302, headers: { Location: destino, "Cache-Control": "no-store" } });
      },
    },
  },
});
