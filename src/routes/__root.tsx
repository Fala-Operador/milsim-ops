import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
  type ErrorComponentProps,
} from "@tanstack/react-router";
import { Component, useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { ErroSecao, SkeletonPagina } from "@/components/ui";
import { definirEnvioAnalytics } from "@/services/analytics";
import { enviarRegistros } from "@/api/analytics.functions";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { ThemeProvider, SCRIPT_TEMA_INICIAL } from "@/contexts/ThemeContext";
import { NotificationProvider } from "@/contexts/NotificationContext";
import { LocalizacaoProvider } from "@/contexts/LocalizacaoContext";
import { PreferenciasProvider } from "@/contexts/PreferenciasContext";
import { PreferenciasModal } from "@/components/PreferenciasModalidade";
import { Header } from "@/components/Header";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="font-mono text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Página não encontrada</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          A página que você procura não existe ou foi movida.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
          >
            Voltar ao início
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: ErrorComponentProps) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          Esta página não carregou
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Algo deu errado. Tente novamente ou volte ao início.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            Tentar novamente
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-accent"
          >
            Voltar ao início
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "MilSim Ops — Eventos de Simulação Militar" },
      {
        name: "description",
        content:
          "Plataforma de divulgação e gestão de eventos de simulação militar, operações e comunidades de participantes.",
      },
      { property: "og:title", content: "MilSim Ops — Eventos de Simulação Militar" },
      {
        property: "og:description",
        content: "Descubra operações, inscreva-se e acompanhe sua comunidade.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@500;600;700&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@500;700&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    // O script de tema altera a classe do <html> antes da hidratação (intencional).
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <HeadContent />
        {/* Aplica o tema antes da primeira pintura para evitar flashes */}
        <script
          dangerouslySetInnerHTML={{
            __html: SCRIPT_TEMA_INICIAL,
          }}
        />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function Providers({ children }: { children: ReactNode }) {
  const { usuario, carga, recarregar } = useAuth();
  // Métricas anônimas são enviadas em lote para a API (só no navegador).
  useEffect(() => {
    definirEnvioAnalytics(enviarRegistros);
    return () => definirEnvioAnalytics(null);
  }, []);
  // As páginas leem a visão de forma síncrona: só renderizam depois da primeira carga.
  // No SSR e no primeiro desenho do navegador o esqueleto é o mesmo (sem divergência).
  const conteudo =
    carga === "pronto" ? children
    : carga === "erro" ? (
      <div className="mx-auto max-w-lg px-4 py-16">
        <ErroSecao titulo="Não foi possível carregar os dados" descricao="Verifique a conexão e tente novamente." onTentar={() => void recarregar()} />
      </div>
    )
    : <SkeletonPagina />;
  return (
    <NotificationProvider usuarioId={usuario?.id}>
      <Header />
      <main>{conteudo}</main>
      <footer className="border-t border-border py-6 text-center text-xs text-muted-foreground">
        MilSim Ops — eventos de simulação militar. Pagamentos não são processados pela plataforma.
      </footer>
    </NotificationProvider>
  );
}

// O errorComponent da rota só captura falhas abaixo do componente da rota;
// uma quebra dentro de AuthProvider/ThemeProvider derrubaria a árvore inteira
// e deixaria a tela em branco. Este limite envolve os provedores e a página.
class LimiteErroRaiz extends Component<{ children: ReactNode }, { quebrou: boolean }> {
  override state = { quebrou: false };

  static getDerivedStateFromError() {
    return { quebrou: true };
  }

  override componentDidCatch(error: unknown) {
    console.error(error);
    reportLovableError(error, { boundary: "root_providers_error_boundary" });
  }

  override render() {
    if (this.state.quebrou) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-background px-4">
          <div className="w-full max-w-lg">
            <ErroSecao
              titulo="O aplicativo não carregou"
              descricao="Algo deu errado ao iniciar. Recarregue a página ou volte ao início."
              onTentar={() => window.location.reload()}
            />
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <LimiteErroRaiz>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <ThemeProvider>
            <LocalizacaoProvider>
            <PreferenciasProvider>
            <Providers>
              <Outlet />
            </Providers>
            <PreferenciasModal />
            </PreferenciasProvider>
            </LocalizacaoProvider>
          </ThemeProvider>
        </AuthProvider>
      </QueryClientProvider>
    </LimiteErroRaiz>
  );
}
