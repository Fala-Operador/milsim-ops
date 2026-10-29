import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useAbaAtivaVisivel } from "@/hooks/useAbaAtivaVisivel";
import { useAuth } from "@/contexts/AuthContext";
import { useExigirLogin } from "@/hooks/useExigirLogin";
import { useSuporte } from "@/contexts/SuporteContext";
import { ErroSecao, SkeletonPagina } from "@/components/ui";
import { LayoutMenuLateral } from "@/components/MenuLateral";
import { LayoutDashboard, LifeBuoy, MessagesSquare, Shield, Target, Ticket, UserRound } from "lucide-react";
import { reportLovableError } from "@/lib/lovable-error-reporting";
import type { ErrorComponentProps } from "@tanstack/react-router";
import { tr } from "@/i18n/routes/app";

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
  { to: "/app", get rotulo() { return tr("visao_geral"); } },
  { to: "/app/ingressos", get rotulo() { return tr("meus_ingressos"); } },
  { to: "/app/comunidades", get rotulo() { return tr("comunidades"); } },
  { to: "/app/missoes", get rotulo() { return tr("missoes"); } },
  { to: "/app/suporte", get rotulo() { return tr("suporte"); } },
  { to: "/app/perfil", get rotulo() { return tr("meu_perfil"); } },
  { to: "/app/privacidade", get rotulo() { return tr("privacidade"); } },
] as const;

function LayoutApp() {
  const { usuario } = useAuth();
  const { naoLidasParticipante } = useSuporte();
  const pathname = useRouterState({ select: (s) => s.location.href });
  // O servidor não conhece a sessão guardada no navegador: mantém o esqueleto até
  // montar, para que o primeiro desenho do navegador coincida com o HTML recebido.
  const [montado, setMontado] = useState(false);
  useEffect(() => setMontado(true), []);
  void pathname; void useRef; void useAbaAtivaVisivel;

  useExigirLogin("/app");

  if (!montado || !usuario) return <SkeletonPagina />;

  return (
    <LayoutMenuLateral titulo={tr("minha_area")} rotuloNav={tr("area_do_participante")} grupos={[
      { titulo: tr("operacoes"), itens: [
        { to: "/app", rotulo: tr("visao_geral"), icone: LayoutDashboard, exato: true },
        { to: "/app/ingressos", rotulo: tr("meus_ingressos"), icone: Ticket },
        { to: "/app/missoes", rotulo: tr("missoes"), icone: Target },
        { to: "/app/comunidades", rotulo: tr("comunidades"), icone: MessagesSquare },
      ] },
      { titulo: tr("conta"), itens: [
        { to: "/app/perfil", rotulo: tr("meu_perfil"), icone: UserRound },
        { to: "/app/suporte", rotulo: tr("suporte"), icone: LifeBuoy, contador: naoLidasParticipante },
        { to: "/app/privacidade", rotulo: tr("privacidade"), icone: Shield },
      ] },
    ]}>
      <Outlet />
    </LayoutMenuLateral>
  );
}
