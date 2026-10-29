import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { useAuth } from "@/contexts/AuthContext";
import { CentralSuporte } from "@/components/suporte/CentralSuporte";
import { tr } from "@/i18n/routes/admin.suporte";

export const Route = createFileRoute("/admin/suporte")({
  validateSearch: z.object({ c: z.string().max(100).optional() }),
  head: () => ({
    meta: [
      { title: tr("suporte_administracao_milsim_ops") },
      { name: "description", content: tr("central_de_atendimento_acompanhe_respond") },
      { property: "og:title", content: tr("suporte_administracao_milsim_ops") },
      { property: "og:description", content: tr("central_de_atendimento_da_administracao") },
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
  return (
    <div>
      <h2 className="titulo-pagina">{tr("central_de_suporte")}</h2>
      <p className="subtitulo-pagina">{tr("chamados_dos_participantes_sobre_as_oper")}</p>
      <div className="mt-4">
        <CentralSuporte modo="equipe" usuario={usuario} selecionado={c} onSelecionar={(id) => navigate({ search: id ? { c: id } : {}, replace: true })} />
      </div>
    </div>
  );
}
