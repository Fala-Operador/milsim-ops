import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { carregarBase } from "@/services/db";
import { useVersaoBase } from "@/hooks/useVersaoBase";
import type { BaseDados } from "@/lib/domain/types";
import { PainelMetricas } from "@/components/metricas";
import { SkeletonPagina } from "@/components/ui";

export const Route = createFileRoute("/admin/metricas")({
  head: () => ({
    meta: [
      { title: "Métricas consolidadas — MilSim Ops" },
      { name: "description", content: "Compare eventos, organizações, regiões e seções de divulgação." },
      { property: "og:title", content: "Métricas consolidadas — MilSim Ops" },
      { property: "og:description", content: "Painel consolidado de divulgação e inscrições." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PaginaMetricasAdmin,
});

function PaginaMetricasAdmin() {
  const versao = useVersaoBase();
  const [base, setBase] = useState<BaseDados | null>(null);
  useEffect(() => setBase(carregarBase()), [versao]);
  if (!base) return <SkeletonPagina />;
  return <PainelMetricas base={base} eventos={base.eventos.filter((e) => e.status !== "rascunho")} modo="admin" />;
}
