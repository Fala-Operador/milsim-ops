import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { carregarBase } from "@/services/db";
import { useVersaoBase } from "@/hooks/useVersaoBase";
import { FormCampanha, ListaCampanhas } from "@/components/perfil/campanhas";
import { Botao } from "@/components/ui";
import type { CampanhaRecompensa } from "@/lib/domain/types";

export const Route = createFileRoute("/organizacao/recompensas")({
  head: () => ({
    meta: [
      { title: "Recompensas — Organização MilSim Ops" },
      { name: "description", content: "Ofereça benefícios para quem conquistou insígnias, nos eventos da sua organização." },
      { property: "og:title", content: "Recompensas — Organização MilSim Ops" },
      { property: "og:description", content: "Campanhas de recompensa da organização." },
    ],
  }),
  component: RecompensasOrganizacao,
});

function RecompensasOrganizacao() {
  useVersaoBase();
  const { usuario } = useAuth();
  const [editando, setEditando] = useState<CampanhaRecompensa | null | "nova">(null);
  if (!usuario?.organizacaoId) return null;
  const base = carregarBase();
  const minhas = base.campanhasRecompensa.filter((c) => c.organizacaoId === usuario.organizacaoId);
  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="font-display text-2xl font-semibold uppercase">Recompensas</h1>
          <p className="text-sm text-muted-foreground">Benefícios valem só para eventos da sua organização. Um benefício não reserva vaga e não acumula com cupom.</p>
        </div>
        <Botao onClick={() => setEditando("nova")}>Nova campanha</Botao>
      </div>
      <ListaCampanhas base={base} campanhas={minhas} onEditar={setEditando} />
      {editando && (
        <FormCampanha base={base} usuario={usuario} organizacaoFixa={usuario.organizacaoId}
          inicial={editando === "nova" ? null : editando} onFechar={() => setEditando(null)} />
      )}
    </section>
  );
}
