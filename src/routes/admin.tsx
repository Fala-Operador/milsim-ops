import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import {
  BarChart3, Bell, CreditCard, Inbox, LayoutDashboard, LifeBuoy, Megaphone, MessagesSquare, ScrollText, ShieldCheck, Store, Trophy, Users,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useExigirLogin } from "@/hooks/useExigirLogin";
import { useSuporte } from "@/contexts/SuporteContext";
import { lerDenunciasPendentes } from "@/api/social.functions";
import { ErroSecao, SkeletonPagina } from "@/components/ui";
import { LayoutMenuLateral, type GrupoMenuLateral } from "@/components/MenuLateral";
import { reportLovableError } from "@/lib/lovable-error-reporting";
import type { ErrorComponentProps } from "@tanstack/react-router";

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
      { name: "description", content: "Administração global: dashboard, suporte, comunidade, solicitações, usuários, privacidade e auditoria." },
      { property: "og:title", content: "Administração — MilSim Ops" },
      { property: "og:description", content: "Administração global." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: LayoutAdmin,
  errorComponent: ErroAdmin,
});

function LayoutAdmin() {
  const { usuario } = useAuth();
  const { atencaoEquipe } = useSuporte();
  const navigate = useNavigate();
  const [montado, setMontado] = useState(false);
  const ehAdmin = usuario?.perfil === "admin";
  // Mesma chave da página Comunidade: o contador e a fila compartilham a leitura.
  const denuncias = useQuery({ queryKey: ["social", "denuncias"], queryFn: lerDenunciasPendentes, enabled: montado && ehAdmin });

  useEffect(() => setMontado(true), []);
  // Sem sessão: pede login e volta ao mesmo endereço (permissão revalidada depois).
  useExigirLogin("/admin");
  useEffect(() => {
    if (usuario && usuario.perfil !== "admin") navigate({ to: "/app" });
  }, [usuario, navigate]);

  if (!montado || !usuario) return <SkeletonPagina />;
  if (!ehAdmin) return null;

  const nDenuncias = denuncias.data?.length ?? 0;
  const grupos: GrupoMenuLateral[] = [
    { titulo: "Visão geral", itens: [
      { to: "/admin", rotulo: "Dashboard", icone: LayoutDashboard, exato: true },
      { to: "/admin/metricas", rotulo: "Métricas", icone: BarChart3 },
    ] },
    { titulo: "Atendimento", itens: [
      { to: "/admin/suporte", rotulo: "Suporte", icone: LifeBuoy, contador: atencaoEquipe, rotuloContador: `${atencaoEquipe} chamados exigem atenção` },
      { to: "/admin/comunidade", rotulo: "Comunidade", icone: MessagesSquare, contador: nDenuncias, rotuloContador: `${nDenuncias} denúncias pendentes` },
      { to: "/admin/solicitacoes", rotulo: "Solicitações", icone: Inbox },
    ] },
    { titulo: "Conteúdo", itens: [
      { to: "/admin/divulgacao", rotulo: "Página inicial e divulgação", icone: Megaphone },
      { to: "/admin/gamificacao", rotulo: "Gamificação e recompensas", icone: Trophy },
      { to: "/admin/notificacoes", rotulo: "Notificações", icone: Bell },
    ] },
    { titulo: "Financeiro", itens: [
      { to: "/admin/pagamentos", rotulo: "Pagamentos", icone: CreditCard },
      { to: "/admin/loja", rotulo: "Loja da plataforma", icone: Store },
    ] },
    { titulo: "Contas e segurança", itens: [
      { to: "/admin/usuarios", rotulo: "Usuários", icone: Users },
      { to: "/admin/privacidade", rotulo: "Privacidade", icone: ShieldCheck },
      { to: "/admin/auditoria", rotulo: "Auditoria", icone: ScrollText },
    ] },
  ];

  return (
    <LayoutMenuLateral titulo="Administração" rotuloNav="Seções da administração" grupos={grupos}>
      <Outlet />
    </LayoutMenuLateral>
  );
}
