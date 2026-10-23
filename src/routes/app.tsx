import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useAbaAtivaVisivel } from "@/hooks/useAbaAtivaVisivel";
import { useAuth } from "@/contexts/AuthContext";
import { useExigirLogin } from "@/hooks/useExigirLogin";
import { useSuporte } from "@/contexts/SuporteContext";
import { ErroSecao, SkeletonPagina } from "@/components/ui";
import { reportLovableError } from "@/lib/lovable-error-reporting";
import type { ErrorComponentProps } from "@tanstack/react-router";

function ErroApp({ error, reset }: ErrorComponentProps) {
  console.error(error);
  useEffect(() => {
    reportLovableError(error, { boundary: "app_error_component" });
  }, [error]);
  return <ErroSecao onTentar={() => reset()} />;
}

export const Route = createFileRoute("/app")({
  component: LayoutApp,
  errorComponent: ErroApp,
});

const ITENS = [
  { to: "/app", rotulo: "Visão geral" },
  { to: "/app/ingressos", rotulo: "Meus ingressos" },
  { to: "/app/comunidades", rotulo: "Comunidades" },
  { to: "/app/missoes", rotulo: "Missões" },
  { to: "/app/suporte", rotulo: "Suporte" },
  { to: "/app/perfil", rotulo: "Meu perfil" },
  { to: "/app/privacidade", rotulo: "Privacidade" },
] as const;

function LayoutApp() {
  const { usuario } = useAuth();
  const { naoLidasParticipante } = useSuporte();
  const pathname = useRouterState({ select: (s) => s.location.href });
  // O servidor não conhece a sessão guardada no navegador: mantém o esqueleto até
  // montar, para que o primeiro desenho do navegador coincida com o HTML recebido.
  const [montado, setMontado] = useState(false);
  useEffect(() => setMontado(true), []);
  const navRef = useRef<HTMLElement>(null);
  useAbaAtivaVisivel(navRef, `${pathname}|${montado && !!usuario}`);

  useExigirLogin("/app");

  if (!montado || !usuario) return <SkeletonPagina />;

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8 lg:flex-row">
      <aside className="min-w-0 lg:w-56 lg:shrink-0">
        <nav
          ref={navRef}
          aria-label="Área do participante"
          className="abas-rolaveis relative -mx-4 flex gap-1 border-b border-border px-4 pb-2 lg:mx-0 lg:flex-col lg:overflow-visible lg:border-b-0 lg:px-0 lg:pb-0"
        >
          {ITENS.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="inline-flex shrink-0 items-center whitespace-nowrap rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-secondary hover:text-foreground"
              activeOptions={{ exact: item.to === "/app" }}
              activeProps={{ className: "bg-secondary text-foreground font-medium" }}
            >
              {item.rotulo}
              {item.to === "/app/suporte" && naoLidasParticipante > 0 && (
                <span data-testid="contador-suporte" aria-label={`${naoLidasParticipante} chamados com resposta não lida`} className="ml-2 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
                  {naoLidasParticipante}
                </span>
              )}
            </Link>
          ))}
        </nav>
      </aside>
      <div className="min-w-0 flex-1">
        <Outlet />
      </div>
    </div>
  );
}
