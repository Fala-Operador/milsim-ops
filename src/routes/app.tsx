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
  void pathname; void useRef; void useAbaAtivaVisivel;

  useExigirLogin("/app");

  if (!montado || !usuario) return <SkeletonPagina />;

  return (
    <LayoutMenuLateral titulo="Minha área" rotuloNav="Área do participante" grupos={[
      { titulo: "Operações", itens: [
        { to: "/app", rotulo: "Visão geral", icone: LayoutDashboard, exato: true },
        { to: "/app/ingressos", rotulo: "Meus ingressos", icone: Ticket },
        { to: "/app/missoes", rotulo: "Missões", icone: Target },
        { to: "/app/comunidades", rotulo: "Comunidades", icone: MessagesSquare },
      ] },
      { titulo: "Conta", itens: [
        { to: "/app/perfil", rotulo: "Meu perfil", icone: UserRound },
        { to: "/app/suporte", rotulo: "Suporte", icone: LifeBuoy, contador: naoLidasParticipante },
        { to: "/app/privacidade", rotulo: "Privacidade", icone: Shield },
      ] },
    ]}>
      <Outlet />
    </LayoutMenuLateral>
  );
}
