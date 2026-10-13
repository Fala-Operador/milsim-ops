import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { useAuth } from "@/contexts/AuthContext";
import { CentralSuporte } from "@/components/suporte/CentralSuporte";

export const Route = createFileRoute("/admin/suporte")({
  validateSearch: z.object({ c: z.string().max(100).optional() }),
  head: () => ({
    meta: [
      { title: "Suporte — Administração MilSim Ops" },
      { name: "description", content: "Central de atendimento: acompanhe, responda e encerre chamados de eventos e da plataforma." },
      { property: "og:title", content: "Suporte — Administração MilSim Ops" },
      { property: "og:description", content: "Central de atendimento da administração." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SuporteAdmin,
});

function SuporteAdmin() {
  const { usuario } = useAuth();
  const { c } = Route.useSearch();
  const navigate = useNavigate({ from: "/admin/suporte" });
  if (!usuario) return null;
  return <CentralSuporte modo="equipe" usuario={usuario} selecionado={c} onSelecionar={(id) => navigate({ search: id ? { c: id } : {}, replace: true })} />;
}
