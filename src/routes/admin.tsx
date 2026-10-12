import { createFileRoute, Link, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { restaurarBaseDemonstrativa } from "@/services/admin";
import { useAuth } from "@/contexts/AuthContext";
import { Botao, Modal, SkeletonPagina } from "@/components/ui";

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
});

const abas = [
  { to: "/admin", rotulo: "Dashboard", exato: true },
  { to: "/admin/insights", rotulo: "Insights IA" },
  { to: "/admin/solicitacoes", rotulo: "Solicitações" },
  { to: "/admin/usuarios", rotulo: "Usuários" },
  { to: "/admin/privacidade", rotulo: "Privacidade" },
  { to: "/admin/auditoria", rotulo: "Auditoria" },
] as const;

function LayoutAdmin() {
  const { usuario } = useAuth();
  const navigate = useNavigate();
  const [montado, setMontado] = useState(false);
  const [confirmar, setConfirmar] = useState(false);

  useEffect(() => setMontado(true), []);
  useEffect(() => {
    if (usuario && usuario.perfil !== "admin") navigate({ to: "/app" });
  }, [usuario, navigate]);

  if (!montado || !usuario) return <SkeletonPagina />;
  if (usuario.perfil !== "admin") return null;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-semibold uppercase">Administração</h1>
        <Botao variante="perigo" onClick={() => setConfirmar(true)}>Restaurar base demonstrativa</Botao>
      </div>
      <nav aria-label="Seções da administração" className="mt-4 flex gap-1 overflow-x-auto border-b border-border">
        {abas.map((a) => (
          <Link
            key={a.to}
            to={a.to}
            activeOptions={{ exact: "exato" in a }}
            className="whitespace-nowrap border-b-2 border-transparent px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground"
            activeProps={{ className: "!border-primary !text-foreground" }}
          >
            {a.rotulo}
          </Link>
        ))}
      </nav>
      <div className="mt-6">
        <Outlet />
      </div>

      <Modal aberto={confirmar} titulo="Restaurar base demonstrativa" onFechar={() => setConfirmar(false)}>
        <p className="text-sm text-muted-foreground">
          Isso apaga todos os dados desta aplicação (somente desta aplicação) e recria os registros iniciais. Ação irreversível.
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <Botao variante="fantasma" onClick={() => setConfirmar(false)}>Voltar</Botao>
          <Botao
            variante="perigo"
            onClick={async () => {
              await restaurarBaseDemonstrativa();
              window.location.href = "/";
            }}
          >
            Confirmar restauração
          </Botao>
        </div>
      </Modal>
    </div>
  );
}
