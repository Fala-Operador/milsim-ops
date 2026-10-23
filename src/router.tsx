import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import { SkeletonPagina } from "@/components/ui";

export const getRouter = () => {
  const queryClient = new QueryClient();

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
    // Rota que demora a carregar mostra o esqueleto da página (nunca tela em branco).
    defaultPendingComponent: SkeletonPagina,
    defaultPendingMs: 200,
    // Transição suave só ao trocar de página; filtros e abas (?aba=…) mudam sem animar tudo.
    defaultViewTransition: { types: ({ pathChanged }) => (pathChanged ? ["pagina"] : false) },
  });

  return router;
};
