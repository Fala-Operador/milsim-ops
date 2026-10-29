import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { carregarBase } from "@/services/db";
import { useVersaoBase } from "@/hooks/useVersaoBase";
import type { BaseDados } from "@/lib/domain/types";
import { PainelMetricas } from "@/components/metricas";
import { SkeletonPagina } from "@/components/ui";
import { tr } from "@/i18n/routes/admin.metricas";

export const Route = createFileRoute("/admin/metricas")({
  head: () => ({
    meta: [
      { title: tr("metricas_consolidadas_milsim_ops") },
      { name: "description", content: tr("compare_eventos_organizacoes_regioes_e_s") },
      { property: "og:title", content: tr("metricas_consolidadas_milsim_ops") },
      { property: "og:description", content: tr("painel_consolidado_de_divulgacao_e_inscr") },
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
