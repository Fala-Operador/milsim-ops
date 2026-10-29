import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useEventosOrg } from "@/components/organizacao";
import { PainelMetricas } from "@/components/metricas";
import { SkeletonPagina } from "@/components/ui";
import { tr } from "@/i18n/routes/organizacao.metricas";

export const Route = createFileRoute("/organizacao/metricas")({
  head: () => ({
    meta: [
      { title: tr("metricas_dos_eventos_minha_organizacao_m") },
      { name: "description", content: tr("exibicoes_cliques_visitas_funil_de_inscr") },
      { property: "og:title", content: tr("metricas_dos_eventos_milsim_ops") },
      { property: "og:description", content: tr("desempenho_de_divulgacao_e_inscricoes_po") },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PaginaMetricasOrg,
});

function PaginaMetricasOrg() {
  const { base, eventos } = useEventosOrg();
  const [montado, setMontado] = useState(false);
  useEffect(() => setMontado(true), []);
  if (!montado) return <SkeletonPagina />;
  return (
    <div>
      <h2 className="titulo-pagina">{tr("metricas")}</h2>
      <p className="subtitulo-pagina">{tr("visitas_inscricoes_e_receita_das_operaco")}</p>
      <PainelMetricas base={base} eventos={eventos} modo="organizador" />
    </div>
  );
}
