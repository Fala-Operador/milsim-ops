import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { LayoutMenuLateral, type GrupoMenuLateral } from "@/components/MenuLateral";
import { useExigirLogin } from "@/hooks/useExigirLogin";
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
import { LayoutDashboard, Users, MessagesSquare, Wallet, Gift, LifeBuoy, BarChart3, QrCode, Target, Rocket } from "lucide-react";

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

function LayoutOrganizacao() {
  const { usuario } = useAuth();
  const { atencaoEquipe } = useSuporte();
  const navigate = useNavigate();
  const [montado, setMontado] = useState(false);

  useEffect(() => setMontado(true), []);
  // Sem sessão: pede login e volta ao mesmo endereço (permissão revalidada depois).
  useExigirLogin("/organizacao");
  useEffect(() => {
    if (usuario && usuario.perfil !== "organizador" && usuario.perfil !== "admin") {
      navigate({ to: "/app" });
    }
  }, [usuario, navigate]);

  if (!montado || !usuario) return <SkeletonPagina />;
  if (usuario.perfil !== "organizador" && usuario.perfil !== "admin") return null;

  const grupos: GrupoMenuLateral[] = [
    { titulo: "Evento", itens: [
      { to: "/organizacao", rotulo: "Painel", icone: LayoutDashboard, exato: true },
      { to: "/organizacao/inscritos", rotulo: "Inscritos", icone: Users },
      { to: "/organizacao/checkin", rotulo: "Check-in", icone: QrCode },
    ] },
    { titulo: "Engajamento", itens: [
      { to: "/organizacao/comunidade", rotulo: "Comunidade", icone: MessagesSquare },
      { to: "/organizacao/missoes", rotulo: "Missões", icone: Target },
      { to: "/organizacao/recompensas", rotulo: "Recompensas", icone: Gift },
    ] },
    { titulo: "Vendas", itens: [
      { to: "/organizacao/financeiro", rotulo: "Financeiro", icone: Wallet },
      { to: "/organizacao/metricas", rotulo: "Métricas", icone: BarChart3 },
      { to: "/organizacao/impulsos", rotulo: "Impulsionar", icone: Rocket },
    ] },
    { titulo: "Ajuda", itens: [
      { to: "/organizacao/suporte", rotulo: "Suporte", icone: LifeBuoy, contador: atencaoEquipe, rotuloContador: `${atencaoEquipe} chamados exigem atenção` },
    ] },
  ];

  return (
    <LayoutMenuLateral titulo="Minha organização" rotuloNav="Seções da organização" grupos={grupos}>
      <Outlet />
    </LayoutMenuLateral>
  );
}
