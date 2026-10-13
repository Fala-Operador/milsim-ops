import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { useAuth } from "@/contexts/AuthContext";
import { CentralSuporte } from "@/components/suporte/CentralSuporte";

export const Route = createFileRoute("/organizacao/suporte")({
  validateSearch: z.object({ c: z.string().max(100).optional() }),
  head: () => ({
    meta: [
      { title: "Suporte dos eventos — MilSim Ops" },
      { name: "description", content: "Atenda chamados dos participantes sobre os eventos da sua organização." },
      { property: "og:title", content: "Suporte dos eventos — MilSim Ops" },
      { property: "og:description", content: "Atendimento de chamados da organização." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SuporteOrganizacao,
});

function SuporteOrganizacao() {
  const { usuario } = useAuth();
  const { c } = Route.useSearch();
  const navigate = useNavigate({ from: "/organizacao/suporte" });
  if (!usuario) return null;
  return (
    <div>
      <h2 className="font-display text-xl font-semibold">Suporte dos eventos</h2>
      <p className="mb-4 mt-1 text-sm text-muted-foreground">Somente chamados dos eventos da sua organização. Chamados da plataforma ficam com a administração.</p>
      <CentralSuporte modo="equipe" usuario={usuario} selecionado={c} onSelecionar={(id) => navigate({ search: id ? { c: id } : {}, replace: true })} />
    </div>
  );
}
