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
import { tr } from "@/i18n/routes/organizacao";

export const Route = createFileRoute("/organizacao")({
  head: () => ({
    meta: [
      { title: tr("minha_organizacao_milsim_ops") },
      { name: "description", content: tr("painel_do_organizador_eventos_inscritos") },
      { property: "og:title", content: tr("minha_organizacao_milsim_ops") },
      { property: "og:description", content: tr("painel_do_organizador") },
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
    { titulo: tr("evento"), itens: [
      { to: "/organizacao", rotulo: tr("painel"), icone: LayoutDashboard, exato: true },
      { to: "/organizacao/inscritos", rotulo: tr("inscritos"), icone: Users },
      { to: "/organizacao/checkin", rotulo: tr("check_in"), icone: QrCode },
    ] },
    { titulo: tr("engajamento"), itens: [
      { to: "/organizacao/comunidade", rotulo: tr("comunidade"), icone: MessagesSquare },
      { to: "/organizacao/missoes", rotulo: tr("missoes"), icone: Target },
      { to: "/organizacao/recompensas", rotulo: tr("recompensas"), icone: Gift },
    ] },
    { titulo: tr("vendas"), itens: [
      { to: "/organizacao/financeiro", rotulo: tr("financeiro"), icone: Wallet },
      { to: "/organizacao/metricas", rotulo: tr("metricas"), icone: BarChart3 },
      { to: "/organizacao/impulsos", rotulo: tr("impulsionar"), icone: Rocket },
    ] },
    { titulo: tr("ajuda"), itens: [
      { to: "/organizacao/suporte", rotulo: tr("suporte"), icone: LifeBuoy, contador: atencaoEquipe, rotuloContador: tr("atencaoequipe_chamados_exigem_atencao", { atencaoEquipe }) },
    ] },
  ];

  return (
    <LayoutMenuLateral titulo={tr("minha_organizacao")} rotuloNav={tr("secoes_da_organizacao")} grupos={grupos}>
      <Outlet />
    </LayoutMenuLateral>
  );
}
