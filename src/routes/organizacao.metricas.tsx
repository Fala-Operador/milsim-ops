import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useEventosOrg } from "@/components/organizacao";
import { PainelMetricas } from "@/components/metricas";
import { SkeletonPagina } from "@/components/ui";

export const Route = createFileRoute("/organizacao/metricas")({
  head: () => ({
    meta: [
      { title: "Métricas dos eventos — Minha organização — MilSim Ops" },
      { name: "description", content: "Exibições, cliques, visitas, funil de inscrição e campanhas dos seus eventos." },
      { property: "og:title", content: "Métricas dos eventos — MilSim Ops" },
      { property: "og:description", content: "Desempenho de divulgação e inscrições por evento." },
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
      <h2 className="titulo-pagina">Métricas</h2>
      <p className="subtitulo-pagina">Visitas, inscrições e receita das operações da sua organização.</p>
      <PainelMetricas base={base} eventos={eventos} modo="organizador" />
    </div>
  );
}
