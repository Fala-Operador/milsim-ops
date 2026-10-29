import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { useAuth } from "@/contexts/AuthContext";
import { EncaminhamentosOrganizacao } from "@/components/suporte/EncaminhamentosOrganizacao";
import { carregarBase } from "@/services/db";
import { encaminhamentos } from "@/lib/suporte";
import { tr } from "@/i18n/routes/organizacao.suporte";

export const Route = createFileRoute("/organizacao/suporte")({
  validateSearch: z.object({ e: z.string().max(100).optional(), c: z.string().max(100).optional() }),
  head: () => ({
    meta: [
      { title: tr("suporte_dos_eventos_milsim_ops") },
      { name: "description", content: tr("responda_as_demandas_que_a_administracao") },
      { property: "og:title", content: tr("suporte_dos_eventos_milsim_ops") },
      { property: "og:description", content: tr("atendimento_de_chamados_da_organizacao") },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SuporteOrganizacao,
});

function SuporteOrganizacao() {
  const { usuario } = useAuth();
  const { e, c } = Route.useSearch();
  const navigate = useNavigate({ from: "/organizacao/suporte" });
  if (!usuario) return null;
  // Link antigo (?c=chamado): abre o encaminhamento da organização para esse chamado, se houver.
  let selecionado = e;
  if (!selecionado && c) {
    const ch = carregarBase().chamados.find((x) => x.id === c);
    selecionado = (ch && [...encaminhamentos(carregarBase(), ch)].reverse().find((x) => x.organizacaoId === usuario.organizacaoId)?.id) ?? c;
  }
  return (
    <div>
      <h2 className="titulo-pagina">{tr("demandas_da_administracao")}</h2>
      <p className="mb-4 mt-1 text-sm text-muted-foreground">{tr("todo_chamado_e_atendido_pela_administrac")}</p>
      <EncaminhamentosOrganizacao usuario={usuario} selecionado={selecionado} onSelecionar={(id) => navigate({ search: id ? { e: id } : {}, replace: true })} />
    </div>
  );
}
