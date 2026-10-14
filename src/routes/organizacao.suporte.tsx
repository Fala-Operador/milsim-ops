import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { useAuth } from "@/contexts/AuthContext";
import { EncaminhamentosOrganizacao } from "@/components/suporte/EncaminhamentosOrganizacao";
import { carregarBase } from "@/services/db";
import { encaminhamentos } from "@/lib/suporte";

export const Route = createFileRoute("/organizacao/suporte")({
  validateSearch: z.object({ e: z.string().max(100).optional(), c: z.string().max(100).optional() }),
  head: () => ({
    meta: [
      { title: "Suporte dos eventos — MilSim Ops" },
      { name: "description", content: "Responda às demandas que a administração encaminhou à sua organização." },
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
      <h2 className="font-display text-xl font-semibold">Demandas da administração</h2>
      <p className="mb-4 mt-1 text-sm text-muted-foreground">Todo chamado é atendido pela administração. Aqui aparecem só as demandas que ela encaminhou à sua organização.</p>
      <EncaminhamentosOrganizacao usuario={usuario} selecionado={selecionado} onSelecionar={(id) => navigate({ search: id ? { e: id } : {}, replace: true })} />
    </div>
  );
}
