import { createFileRoute, Link, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { SkeletonPagina } from "@/components/ui";
import { LayoutDashboard, Users, MessagesSquare, Wallet, Bell, BarChart3 } from "lucide-react";
import { useNotifications } from "@/contexts/NotificationContext";

export const Route = createFileRoute("/organizacao")({
  head: () => ({
    meta: [
      { title: "Minha organização — MilSim Ops" },
      { name: "description", content: "Painel do organizador: eventos, inscritos, comunidade e financeiro simulado." },
      { property: "og:title", content: "Minha organização — MilSim Ops" },
      { property: "og:description", content: "Painel do organizador." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: LayoutOrganizacao,
});

const itens = [
  { to: "/organizacao", rotulo: "Painel", icone: LayoutDashboard, exato: true },
  { to: "/organizacao/inscritos", rotulo: "Inscritos", icone: Users },
  { to: "/organizacao/comunidade", rotulo: "Comunidade", icone: MessagesSquare },
  { to: "/organizacao/financeiro", rotulo: "Financeiro", icone: Wallet },
  { to: "/organizacao/metricas", rotulo: "Métricas", icone: BarChart3 },
  { to: "/organizacao/notificacoes", rotulo: "Notificações", icone: Bell },
] as const;

function LayoutOrganizacao() {
  const { usuario } = useAuth();
  const { naoLidas } = useNotifications();
  const navigate = useNavigate();
  const [montado, setMontado] = useState(false);

  useEffect(() => setMontado(true), []);
  useEffect(() => {
    if (usuario && usuario.perfil !== "organizador" && usuario.perfil !== "admin") {
      navigate({ to: "/app" });
    }
  }, [usuario, navigate]);

  if (!montado || !usuario) return <SkeletonPagina />;
  if (usuario.perfil !== "organizador" && usuario.perfil !== "admin") return null;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="font-display text-2xl font-semibold uppercase">Minha organização</h1>
      <div className="mt-4 flex flex-col gap-6 md:flex-row">
        <nav
          aria-label="Seções da organização"
          className="flex gap-1 overflow-x-auto border-b border-border md:w-48 md:shrink-0 md:flex-col md:border-b-0 md:border-r md:pr-3"
        >
          {itens.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              activeOptions={{ exact: "exato" in item }}
              className="flex items-center gap-2 whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-secondary hover:text-foreground"
              activeProps={{ className: "bg-secondary !text-foreground" }}
            >
              <item.icone className="h-4 w-4" />
              {item.rotulo}
              {item.rotulo === "Notificações" && naoLidas > 0 && (
                <span className="ml-auto rounded-full bg-accent px-1.5 py-0.5 text-[10px] font-bold text-accent-foreground">
                  {naoLidas}
                </span>
              )}
            </Link>
          ))}
        </nav>
        <div className="min-w-0 flex-1">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
