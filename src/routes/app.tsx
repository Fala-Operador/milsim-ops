import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNotifications } from "@/contexts/NotificationContext";
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
  { to: "/app/notificacoes", rotulo: "Notificações" },
  { to: "/app/suporte", rotulo: "Suporte" },
  { to: "/app/perfil", rotulo: "Perfil" },
  { to: "/app/privacidade", rotulo: "Privacidade" },
] as const;

function LayoutApp() {
  const { usuario, autenticado } = useAuth();
  const { naoLidas } = useNotifications();
  const { naoLidasParticipante } = useSuporte();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.href });
  // O servidor não conhece a sessão guardada no navegador: mantém o esqueleto até
  // montar, para que o primeiro desenho do navegador coincida com o HTML recebido.
  const [montado, setMontado] = useState(false);
  useEffect(() => setMontado(true), []);

  useEffect(() => {
    if (!autenticado) {
      navigate({ to: "/login", search: { redirect: pathname } });
    }
  }, [autenticado, navigate, pathname]);

  if (!montado || !usuario) return <SkeletonPagina />;

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8 lg:flex-row">
      <aside className="lg:w-56">
        <nav aria-label="Área do participante" className="flex flex-wrap gap-1 lg:flex-col">
          {ITENS.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-secondary hover:text-foreground"
              activeOptions={{ exact: item.to === "/app" }}
              activeProps={{ className: "bg-secondary text-foreground font-medium" }}
            >
              {item.rotulo}
              {item.to === "/app/notificacoes" && naoLidas > 0 && (
                <span className="ml-2 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
                  {naoLidas}
                </span>
              )}
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
