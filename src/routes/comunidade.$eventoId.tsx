import { createFileRoute, notFound, Outlet } from "@tanstack/react-router";
import { carregarBase } from "@/services/db";
import { SkeletonPagina } from "@/components/ui";

// Layout da comunidade do evento: Comunidade → Fórum → Publicação.
export const Route = createFileRoute("/comunidade/$eventoId")({
  loader: ({ params }) => {
    const base = carregarBase();
    const evento = base.eventos.find((e) => e.id === params.eventoId);
    if (!evento) throw notFound();
    return { eventoNome: evento.nome };
  },
  head: ({ loaderData }) => ({
    meta: loaderData
      ? [
          { title: `Comunidade — ${loaderData.eventoNome}` },
          { name: "description", content: "Comunidade privada do evento: fóruns, avisos e conversas entre participantes." },
          { property: "og:title", content: `Comunidade — ${loaderData.eventoNome}` },
          { property: "og:description", content: "Comunidade privada do evento." },
          { property: "og:type", content: "website" },
          { name: "twitter:card", content: "summary" },
        ]
      : [{ title: "Comunidade — MilSim Ops" }, { name: "robots", content: "noindex" }],
  }),
  pendingComponent: SkeletonPagina,
  component: () => <Outlet />,
});
