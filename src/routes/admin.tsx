import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useSuporte } from "@/contexts/SuporteContext";
import { ErroSecao, SkeletonPagina } from "@/components/ui";
import { reportLovableError } from "@/lib/lovable-error-reporting";
import type { ErrorComponentProps } from "@tanstack/react-router";
import { NativeSelect } from "@/components/ui/native-select";
import { Label } from "@/components/ui/label";

function ErroAdmin({ error, reset }: ErrorComponentProps) {
  console.error(error);
  useEffect(() => {
    reportLovableError(error, { boundary: "admin_error_component" });
  }, [error]);
  return <ErroSecao onTentar={() => reset()} />;
}

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Administração — MilSim Ops" },
      { name: "description", content: "Administração global: dashboard, solicitações, usuários, privacidade, auditoria e insights com IA." },
      { property: "og:title", content: "Administração — MilSim Ops" },
      { property: "og:description", content: "Administração global." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: LayoutAdmin,
  errorComponent: ErroAdmin,
});

const abas = [
  { to: "/admin", rotulo: "Dashboard", exato: true },
  { to: "/admin/insights", rotulo: "Insights IA" },
  { to: "/admin/metricas", rotulo: "Métricas" },
  { to: "/admin/divulgacao", rotulo: "Página inicial e divulgação" },
  { to: "/admin/gamificacao", rotulo: "Gamificação e recompensas" },
  { to: "/admin/suporte", rotulo: "Suporte" },
  { to: "/admin/solicitacoes", rotulo: "Solicitações" },
  { to: "/admin/pagamentos", rotulo: "Pagamentos" },
  { to: "/admin/notificacoes", rotulo: "Notificações" },
  { to: "/admin/usuarios", rotulo: "Usuários" },
  { to: "/admin/privacidade", rotulo: "Privacidade" },
  { to: "/admin/auditoria", rotulo: "Auditoria" },
] as const;

function LayoutAdmin() {
  const { usuario } = useAuth();
  const { atencaoEquipe } = useSuporte();
  const navigate = useNavigate();
  const [montado, setMontado] = useState(false);
  const caminho = useRouterState({ select: (s) => s.location.pathname });
  const abaAtual = [...abas].reverse().find((a) => ("exato" in a ? caminho === a.to : caminho.startsWith(a.to))) ?? abas[0];

  useEffect(() => setMontado(true), []);
  const endereco = useRouterState({ select: (s) => s.location.href });
  // Sem sessão: pede login e volta ao mesmo endereço (permissão revalidada depois).
  useEffect(() => {
    if (montado && !usuario) navigate({ to: "/login", search: { redirect: endereco } });
  }, [montado, usuario, navigate, endereco]);
  useEffect(() => {
    if (usuario && usuario.perfil !== "admin") navigate({ to: "/app" });
  }, [usuario, navigate]);

  if (!montado || !usuario) return <SkeletonPagina />;
  if (usuario.perfil !== "admin") return null;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="font-display text-2xl font-semibold uppercase">Administração</h1>
      <p className="mt-1 text-sm text-muted-foreground" aria-label="Você está em">
        Administração / <span className="text-foreground">{abaAtual.rotulo}</span>
      </p>
      <Label className="mt-4 block md:hidden text-[length:inherit] font-normal text-inherit">
        <span className="sr-only">Seção da administração</span>
        <NativeSelect
          value={abaAtual.to}
          onChange={(e) => navigate({ to: e.target.value })}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-medium text-foreground"
        >
          {abas.map((a) => <option key={a.to} value={a.to}>{a.rotulo}{a.to === "/admin/suporte" && atencaoEquipe > 0 ? ` (${atencaoEquipe})` : ""}</option>)}
        </NativeSelect>
      </Label>
      <nav aria-label="Seções da administração" className="mt-4 hidden flex-wrap gap-1 border-b border-border md:flex">
        {abas.map((a) => (
          <Link
            key={a.to}
            to={a.to}
            activeOptions={{ exact: "exato" in a }}
            className="-mb-px whitespace-nowrap rounded-t-md border-b-2 border-transparent px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground"
            activeProps={{ className: "!border-primary bg-secondary !text-foreground", "aria-current": "page" }}
          >
            {a.rotulo}
            {a.to === "/admin/suporte" && atencaoEquipe > 0 && (
              <span className="ml-1.5 rounded-full bg-accent px-1.5 py-0.5 text-[10px] font-bold text-accent-foreground" aria-label={`${atencaoEquipe} chamados exigem atenção`}>{atencaoEquipe}</span>
            )}
          </Link>
        ))}
      </nav>
      <div className="mt-6">
        <Outlet />
      </div>

    </div>
  );
}
