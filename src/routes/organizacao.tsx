import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useAbaAtivaVisivel } from "@/hooks/useAbaAtivaVisivel";
import { useAuth } from "@/contexts/AuthContext";
import { useSuporte } from "@/contexts/SuporteContext";
import { ErroSecao, SkeletonPagina } from "@/components/ui";
import { reportLovableError } from "@/lib/lovable-error-reporting";
import type { ErrorComponentProps } from "@tanstack/react-router";

function ErroOrganizacao({ error, reset }: ErrorComponentProps) {
  console.error(error);
  useEffect(() => {
    reportLovableError(error, { boundary: "organizacao_error_component" });
  }, [error]);
  return <ErroSecao onTentar={() => reset()} />;
}
import { LayoutDashboard, Users, MessagesSquare, Wallet, Gift, Bell, LifeBuoy, BarChart3, QrCode } from "lucide-react";
import { useNotifications } from "@/contexts/NotificationContext";

export const Route = createFileRoute("/organizacao")({
  head: () => ({
    meta: [
      { title: "Minha organização — MilSim Ops" },
      { name: "description", content: "Painel do organizador: eventos, inscritos, comunidade e financeiro." },
      { property: "og:title", content: "Minha organização — MilSim Ops" },
      { property: "og:description", content: "Painel do organizador." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: LayoutOrganizacao,
  errorComponent: ErroOrganizacao,
});

const itens = [
  { to: "/organizacao", rotulo: "Painel", icone: LayoutDashboard, exato: true },
  { to: "/organizacao/inscritos", rotulo: "Inscritos", icone: Users },
  { to: "/organizacao/checkin", rotulo: "Check-in", icone: QrCode },
  { to: "/organizacao/comunidade", rotulo: "Comunidade", icone: MessagesSquare },
  { to: "/organizacao/financeiro", rotulo: "Financeiro", icone: Wallet },
  { to: "/organizacao/metricas", rotulo: "Métricas", icone: BarChart3 },
  { to: "/organizacao/recompensas", rotulo: "Recompensas", icone: Gift },
  { to: "/organizacao/suporte", rotulo: "Suporte", icone: LifeBuoy },
  { to: "/organizacao/notificacoes", rotulo: "Notificações", icone: Bell },
] as const;

function LayoutOrganizacao() {
  const { usuario } = useAuth();
  const { naoLidas } = useNotifications();
  const { atencaoEquipe } = useSuporte();
  const navigate = useNavigate();
  const [montado, setMontado] = useState(false);

  useEffect(() => setMontado(true), []);
  const endereco = useRouterState({ select: (s) => s.location.href });
  const navRef = useRef<HTMLElement>(null);
  useAbaAtivaVisivel(navRef, `${endereco}|${montado && !!usuario}`);
  // Sem sessão: pede login e volta ao mesmo endereço (permissão revalidada depois).
  useEffect(() => {
    if (montado && !usuario) navigate({ to: "/login", search: { redirect: endereco } });
  }, [montado, usuario, navigate, endereco]);
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
          ref={navRef}
          aria-label="Seções da organização"
          className="abas-rolaveis relative -mx-4 flex gap-1 border-b border-border px-4 md:mx-0 md:w-48 md:shrink-0 md:flex-col md:overflow-visible md:border-b-0 md:border-r md:px-0 md:pr-3"
        >
          {itens.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              activeOptions={{ exact: "exato" in item }}
              className="flex shrink-0 items-center gap-2 whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-secondary hover:text-foreground"
              activeProps={{ className: "bg-secondary !text-foreground shadow-[inset_3px_0_0_var(--color-primary)]", "aria-current": "page" }}
            >
              <item.icone className="h-4 w-4" />
              {item.rotulo}
              {item.rotulo === "Suporte" && atencaoEquipe > 0 && (
                <span className="ml-auto rounded-full bg-accent px-1.5 py-0.5 text-[10px] font-bold text-accent-foreground">{atencaoEquipe}</span>
              )}
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
