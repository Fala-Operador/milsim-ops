import { createFileRoute, notFound, Outlet } from "@tanstack/react-router";
import { obterEventoFn } from "@/api/sessao.functions";
import { SkeletonPagina } from "@/components/ui";
import { tr } from "@/i18n/routes/comunidade.$eventoId";

// Layout da comunidade do evento: Comunidade → Fórum → Publicação.
export const Route = createFileRoute("/comunidade/$eventoId")({
  loader: async ({ params }) => {
    const { evento } = await obterEventoFn({ data: { eventoId: params.eventoId } });
    if (!evento) throw notFound();
    return { eventoNome: evento.nome };
  },
  head: ({ loaderData }) => ({
    meta: loaderData
      ? [
          { title: tr("comunidade_eventonome", { eventoNome: loaderData.eventoNome }) },
          { name: "description", content: tr("comunidade_privada_do_evento_foruns_avis") },
          { property: "og:title", content: tr("comunidade_eventonome", { eventoNome: loaderData.eventoNome }) },
          { property: "og:description", content: tr("comunidade_privada_do_evento") },
          { property: "og:type", content: "website" },
          { name: "twitter:card", content: "summary" },
        ]
      : [{ title: tr("comunidade_milsim_ops") }, { name: "robots", content: "noindex" }],
  }),
  pendingComponent: SkeletonPagina,
  component: () => <Outlet />,
});
