import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { useAuth } from "@/contexts/AuthContext";
import { CentralSuporte } from "@/components/suporte/CentralSuporte";
import { tr } from "@/i18n/routes/app.suporte";

export const Route = createFileRoute("/app/suporte")({
  validateSearch: z.object({ c: z.string().max(100).optional(), evento: z.string().max(100).optional() }),
  head: () => ({
    meta: [
      { title: tr("meus_chamados_milsim_ops") },
      { name: "description", content: tr("acompanhe_suas_solicitacoes_e_converse_c") },
      { property: "og:title", content: tr("meus_chamados_milsim_ops") },
      { property: "og:description", content: tr("central_de_suporte_do_participante") },
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
      <h1 className="titulo-pagina">{tr("meus_chamados")}</h1>
      <p className="subtitulo-pagina">{tr("acompanhe_suas_solicitacoes_e_converse_c_2")}</p>
      <div className="mt-4">
        <CentralSuporte modo="participante" usuario={usuario} selecionado={c} eventoInicial={evento}
          onSelecionar={(id) => navigate({ search: id ? { c: id } : {}, replace: true })} />
      </div>
    </div>
  );
}
