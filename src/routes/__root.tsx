import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  useRouterState,
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
import { SuporteProvider } from "@/contexts/SuporteContext";
import { LocalizacaoProvider } from "@/contexts/LocalizacaoContext";
import { PreferenciasProvider } from "@/contexts/PreferenciasContext";
import { ConfirmacaoProvider } from "@/contexts/ConfirmacaoContext";
import { PreferenciasModal } from "@/components/PreferenciasModalidade";
import { Header } from "@/components/Header";
import { MenuInferior } from "@/components/MenuInferior";
import { ChamadaPlataforma, SobrePlataforma } from "@/components/SobrePlataforma";
import { IdiomaProvider, useIdioma } from "@/contexts/IdiomaContext";
import { obterTextosFn } from "@/api/textos.functions";
import { definirIdiomaLocal } from "@/lib/idiomaAtual";
import { criarTradutor, IDIOMAS, LANG_HTML, langDaBusca, PREFIXOS_COMUNS, type Idioma } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Languages } from "lucide-react";
import { tr } from "@/i18n/routes/__root";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="font-mono text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">{tr("pagina_nao_encontrada")}</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {tr("a_pagina_que_voce_procura_nao")}</p>
        <div className="mt-6">
          <Button asChild>
            <Link to="/">{tr("voltar_ao_inicio")}</Link>
          </Button>
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
          {tr("esta_pagina_nao_carregou")}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {tr("algo_deu_errado_tente_novamente_ou")}</p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Button
            onClick={() => {
              router.invalidate();
              reset();
            }}
          >
            {tr("tentar_novamente")}</Button>
          <Button variant="outline" className="border-input bg-background hover:bg-accent" asChild>
            <a href="/">{tr("voltar_ao_inicio")}</a>
          </Button>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  // Idioma e textos fixos (public.site_texts) entram no HTML do servidor; ?lang=en|pt troca o idioma.
  loaderDeps: ({ search }) => ({ lang: langDaBusca(search) }),
  loader: async ({ deps, location }) => {
    try {
      return await obterTextosFn({ data: { lang: deps.lang, caminho: location.pathname, prefixos: [...PREFIXOS_COMUNS] } });
    } catch (e) {
      console.error("[textos do site]", e);
      return { idioma: "pt" as Idioma, textos: {} };
    }
  },
  staleTime: Infinity,
  head: ({ loaderData }) => {
    // No navegador, o idioma vale para os dicionários antes de qualquer head() ou componente filho.
    if (typeof window !== "undefined" && loaderData) definirIdiomaLocal(loaderData.idioma);
    const t = criarTradutor(loaderData?.textos ?? {});
    return {
      meta: [
        { charSet: "utf-8" },
        { name: "viewport", content: "width=device-width, initial-scale=1" },
        { title: t("meta.titulo") },
        { name: "description", content: t("meta.descricao") },
        { property: "og:title", content: t("meta.titulo") },
        { property: "og:description", content: t("meta.og_descricao") },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary_large_image" },
        // Prévia de links (WhatsApp, redes): precisa de URL absoluta; rotas filhas (ex.: evento) sobrescrevem.
        { property: "og:image", content: "https://milsimops.falaoperador.com.br/og-image.png" },
        { name: "twitter:image", content: "https://milsimops.falaoperador.com.br/og-image.png" },
      ],
      links: [
        { rel: "stylesheet", href: appCss },
        { rel: "icon", href: "/favicon.svg", type: "image/svg+xml" },
        { rel: "icon", href: "/favicon.ico", sizes: "48x48" },
        { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
        { rel: "manifest", href: "/site.webmanifest" },
        { rel: "preconnect", href: "https://fonts.googleapis.com" },
        { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
        {
          rel: "stylesheet",
          href: "https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@500;600;700&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@500;700&display=swap",
        },
      ],
    };
  },
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  const idioma = useRouterState({ select: (s) => (s.matches[0]?.loaderData as { idioma?: Idioma } | undefined)?.idioma }) ?? "pt";
  return (
    // O script de tema altera a classe do <html> antes da hidratação (intencional).
    <html lang={LANG_HTML[idioma]} suppressHydrationWarning>
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

/** Rotas que não dependem da visão do servidor. */
const PAGINAS_ESTATICAS = new Set(["/privacidade", "/termos"]);

function Providers({ children }: { children: ReactNode }) {
  const { usuario, carga, recarregar } = useAuth();
  const { t } = useIdioma();
  // Métricas anônimas são enviadas em lote para a API (só no navegador).
  useEffect(() => {
    definirEnvioAnalytics(enviarRegistros);
    return () => definirEnvioAnalytics(null);
  }, []);
  const caminho = useRouterState({ select: (s) => s.location.pathname });
  // As páginas leem a visão de forma síncrona: só renderizam depois da primeira carga.
  // No SSR e no primeiro desenho do navegador o esqueleto é o mesmo (sem divergência).
  // Exceções: documentos legais não leem a visão e saem completos no HTML do servidor;
  // a página inicial mostra a apresentação estática mesmo antes da carga (verificação do Google).
  const conteudo =
    carga === "pronto" || PAGINAS_ESTATICAS.has(caminho) ? children
    : carga === "erro" ? (
      <div className="mx-auto max-w-lg px-4 py-16">
        <ErroSecao titulo={tr("nao_foi_possivel_carregar_os_dados")} descricao={tr("verifique_a_conexao_e_tente_novamente")} onTentar={() => void recarregar()} />
      </div>
    )
    : <SkeletonPagina />;
  // Na página inicial, o título e a finalidade do app vêm antes do esqueleto (verificação do Google).
  const corpo = carga !== "pronto" && caminho === "/" ? (
    <>
      <section className="border-b border-border">
        <div className="mx-auto max-w-6xl px-4 pb-8 pt-12 sm:pt-16"><ChamadaPlataforma /></div>
      </section>
      {conteudo}
      <SobrePlataforma />
    </>
  ) : conteudo;
  return (
    <NotificationProvider usuarioId={usuario?.id}>
     <SuporteProvider usuarioId={usuario?.id}>
     <ConfirmacaoProvider>
      <Header />
      <main>{corpo}</main>
      <footer className="mt-12 border-t border-border">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 text-sm sm:grid-cols-[1.4fr_1fr_1fr]">
          <div>
            <p className="font-display text-xl font-bold uppercase tracking-[0.04em]">Milsim<span className="text-accent">Ops</span></p>
            <p className="mt-2 max-w-xs text-muted-foreground">{t("rodape.descricao")}</p>
          </div>
          <nav aria-label={t("rodape.links_aria")} className="flex flex-col gap-2">
            <p className="rotulo-tecnico">{t("rodape.plataforma")}</p>
            <Link to="/" className="text-muted-foreground hover:text-foreground">{t("nav.eventos")}</Link>
            <Link to="/modalidades" className="text-muted-foreground hover:text-foreground">{t("nav.modalidades")}</Link>
            <Link to="/comunidades" className="text-muted-foreground hover:text-foreground">{t("nav.comunidades")}</Link>
          </nav>
          <div className="flex flex-col gap-2">
            <p className="rotulo-tecnico">{t("rodape.legal")}</p>
            <Link to="/termos" className="text-muted-foreground hover:text-foreground">{t("rodape.termos")}</Link>
            <Link to="/privacidade" className="text-muted-foreground hover:text-foreground">{t("rodape.privacidade")}</Link>
            <p className="text-xs text-muted-foreground">{t("rodape.stripe")}</p>
            <SeletorIdioma />
          </div>
        </div>
      </footer>
      <MenuInferior />
     </ConfirmacaoProvider>
     </SuporteProvider>
    </NotificationProvider>
  );
}

/** Troca entre português e inglês. Sem JavaScript, o link ?lang= faz o mesmo pelo servidor. */
function SeletorIdioma() {
  const { idioma, t, trocarIdioma } = useIdioma();
  return (
    <div role="group" aria-label={t("comum.idioma.rotulo")} className="mt-2 flex items-center gap-1 text-xs">
      <Languages className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
      {IDIOMAS.map((i, n) => (
        <span key={i} className="flex items-center gap-1">
          {n > 0 && <span aria-hidden="true" className="text-muted-foreground">·</span>}
          <a href={`?lang=${i}`} hrefLang={LANG_HTML[i]} lang={LANG_HTML[i]} aria-current={i === idioma ? "true" : undefined}
            onClick={(e) => { e.preventDefault(); if (i !== idioma) void trocarIdioma(i); }}
            className={i === idioma ? "font-semibold text-foreground" : "text-muted-foreground hover:text-foreground"}>
            {t(`comum.idioma.${i}`)}
          </a>
        </span>
      ))}
    </div>
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
              titulo={tr("o_aplicativo_nao_carregou")}
              descricao={tr("algo_deu_errado_ao_iniciar_recarregue")}
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
  const { idioma, textos } = Route.useLoaderData();

  return (
    <LimiteErroRaiz>
      <IdiomaProvider idioma={idioma} textos={textos}>
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
      </IdiomaProvider>
    </LimiteErroRaiz>
  );
}
