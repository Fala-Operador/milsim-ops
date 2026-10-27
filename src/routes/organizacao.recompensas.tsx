import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { carregarBase } from "@/services/db";
import { useVersaoBase } from "@/hooks/useVersaoBase";
import { FormCampanha, ListaCampanhas } from "@/components/perfil/campanhas";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { FaixaIndicadores } from "@/components/FaixaIndicadores";
import { statusVoucher } from "@/lib/participacao";
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
  const ids = new Set(minhas.map((c) => c.id));
  const vouchers = base.vouchers.filter((v) => ids.has(v.campanhaId));
  return (
    <section className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="titulo-pagina">Recompensas</h1>
          <p className="subtitulo-pagina">Dê um benefício a quem conquistou uma insígnia. Vale só nos eventos da sua organização, não reserva vaga e não acumula com cupom.</p>
        </div>
        <Button onClick={() => setEditando("nova")}><Plus className="size-4" aria-hidden />Nova campanha</Button>
      </div>

      <ol className="grid overflow-hidden rounded-lg border border-border sm:grid-cols-3 sm:divide-x sm:divide-border" aria-label="Como funciona">
        {[
          ["Escolha a insígnia", "Quem conquistar a insígnia ganha o benefício."],
          ["Defina o benefício", "Desconto em percentual, valor fixo ou cortesia."],
          ["O operador usa na inscrição", "O benefício aparece na tela de inscrição."],
        ].map(([t, d], k) => (
          <li key={t} className="flex gap-3 p-4">
            <span className="font-display text-3xl font-bold leading-none text-accent">{String(k + 1).padStart(2, "0")}</span>
            <span><span className="block font-semibold">{t}</span><span className="text-sm text-muted-foreground">{d}</span></span>
          </li>
        ))}
      </ol>

      {minhas.length > 0 && (
        <FaixaIndicadores className="lg:grid-cols-4" itens={[
          { rotulo: "Campanhas ativas", valor: String(minhas.filter((c) => c.ativa).length) },
          { rotulo: "Benefícios emitidos", valor: String(vouchers.length) },
          { rotulo: "Disponíveis", valor: String(vouchers.filter((v) => statusVoucher(v) === "disponivel").length) },
          { rotulo: "Usados", valor: String(vouchers.filter((v) => v.status === "utilizada").length) },
        ]} />
      )}

      <div>
        <h2 className="mb-3 text-lg font-semibold">Campanhas</h2>
        <ListaCampanhas base={base} campanhas={minhas} onEditar={setEditando} onNova={() => setEditando("nova")} />
      </div>
      {editando && (
        <FormCampanha base={base} usuario={usuario} organizacaoFixa={usuario.organizacaoId}
          inicial={editando === "nova" ? null : editando} onFechar={() => setEditando(null)} />
      )}
    </section>
  );
}
