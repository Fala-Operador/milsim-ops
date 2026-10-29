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
import { tr } from "@/i18n/routes/admin";

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
      { title: tr("administracao_milsim_ops") },
      { name: "description", content: tr("administracao_global_dashboard_suporte_c") },
      { property: "og:title", content: tr("administracao_milsim_ops") },
      { property: "og:description", content: tr("administracao_global") },
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
    { titulo: tr("visao_geral"), itens: [
      { to: "/admin", rotulo: tr("dashboard"), icone: LayoutDashboard, exato: true },
      { to: "/admin/metricas", rotulo: tr("metricas"), icone: BarChart3 },
    ] },
    { titulo: tr("atendimento"), itens: [
      { to: "/admin/suporte", rotulo: tr("suporte"), icone: LifeBuoy, contador: atencaoEquipe, rotuloContador: tr("atencaoequipe_chamados_exigem_atencao", { atencaoEquipe }) },
      { to: "/admin/comunidade", rotulo: tr("comunidade"), icone: MessagesSquare, contador: nDenuncias, rotuloContador: tr("ndenuncias_denuncias_pendentes", { nDenuncias }) },
      { to: "/admin/solicitacoes", rotulo: tr("solicitacoes"), icone: Inbox },
    ] },
    { titulo: tr("conteudo"), itens: [
      { to: "/admin/divulgacao", rotulo: tr("pagina_inicial_e_divulgacao"), icone: Megaphone },
      { to: "/admin/gamificacao", rotulo: tr("gamificacao_e_recompensas"), icone: Trophy },
      { to: "/admin/notificacoes", rotulo: tr("notificacoes"), icone: Bell },
    ] },
    { titulo: tr("financeiro"), itens: [
      { to: "/admin/pagamentos", rotulo: tr("pagamentos"), icone: CreditCard },
      { to: "/admin/loja", rotulo: tr("loja_da_plataforma"), icone: Store },
    ] },
    { titulo: tr("contas_e_seguranca"), itens: [
      { to: "/admin/usuarios", rotulo: tr("usuarios"), icone: Users },
      { to: "/admin/privacidade", rotulo: tr("privacidade"), icone: ShieldCheck },
      { to: "/admin/auditoria", rotulo: tr("auditoria"), icone: ScrollText },
    ] },
  ];

  return (
    <LayoutMenuLateral titulo={tr("administracao")} rotuloNav={tr("secoes_da_administracao")} grupos={grupos}>
      <Outlet />
    </LayoutMenuLateral>
  );
}
