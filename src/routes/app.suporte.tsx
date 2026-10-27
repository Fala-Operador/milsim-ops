import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { useAuth } from "@/contexts/AuthContext";
import { CentralSuporte } from "@/components/suporte/CentralSuporte";

export const Route = createFileRoute("/app/suporte")({
  validateSearch: z.object({ c: z.string().max(100).optional(), evento: z.string().max(100).optional() }),
  head: () => ({
    meta: [
      { title: "Meus chamados — MilSim Ops" },
      { name: "description", content: "Acompanhe suas solicitações e converse com a administração." },
      { property: "og:title", content: "Meus chamados — MilSim Ops" },
      { property: "og:description", content: "Central de suporte do participante." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PaginaSuporte,
});

function PaginaSuporte() {
  const { usuario } = useAuth();
  const { c, evento } = Route.useSearch();
  const navigate = useNavigate({ from: "/app/suporte" });
  if (!usuario) return null;
  return (
    <div>
      <h1 className="titulo-pagina">Meus chamados</h1>
      <p className="subtitulo-pagina">Acompanhe suas solicitações e converse com a administração. Quando necessário, a equipe consultará a organização do evento.</p>
      <div className="mt-4">
        <CentralSuporte modo="participante" usuario={usuario} selecionado={c} eventoInicial={evento}
          onSelecionar={(id) => navigate({ search: id ? { c: id } : {}, replace: true })} />
      </div>
    </div>
  );
}
