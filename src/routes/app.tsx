import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { SkeletonPagina } from "@/components/ui";

export const Route = createFileRoute("/app")({
  component: LayoutApp,
});

const ITENS = [
  { to: "/app", rotulo: "Visão geral" },
  { to: "/app/ingressos", rotulo: "Meus ingressos" },
  { to: "/app/missoes", rotulo: "Missões" },
  { to: "/app/notificacoes", rotulo: "Notificações" },
  { to: "/app/suporte", rotulo: "Suporte" },
  { to: "/app/perfil", rotulo: "Perfil" },
  { to: "/app/privacidade", rotulo: "Privacidade" },
] as const;

function LayoutApp() {
  const { usuario, autenticado } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    if (!autenticado) {
      navigate({ to: "/login", search: { redirect: pathname } });
    }
  }, [autenticado, navigate, pathname]);

  if (!usuario) return <Spinner texto="Verificando sessão..." />;

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
