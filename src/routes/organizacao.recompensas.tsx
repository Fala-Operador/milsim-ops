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
import { tr } from "@/i18n/routes/organizacao.recompensas";

export const Route = createFileRoute("/organizacao/recompensas")({
  head: () => ({
    meta: [
      { title: tr("recompensas_organizacao_milsim_ops") },
      { name: "description", content: tr("ofereca_beneficios_para_quem_conquistou") },
      { property: "og:title", content: tr("recompensas_organizacao_milsim_ops") },
      { property: "og:description", content: tr("campanhas_de_recompensa_da_organizacao") },
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
          <h1 className="titulo-pagina">{tr("recompensas")}</h1>
          <p className="subtitulo-pagina">{tr("de_um_beneficio_a_quem_conquistou")}</p>
        </div>
        <Button onClick={() => setEditando("nova")}><Plus className="size-4" aria-hidden />{tr("nova_campanha")}</Button>
      </div>

      <ol className="grid overflow-hidden rounded-lg border border-border sm:grid-cols-3 sm:divide-x sm:divide-border" aria-label={tr("como_funciona")}>
        {[
          [tr("escolha_a_insignia"), tr("quem_conquistar_a_insignia_ganha_o")],
          [tr("defina_o_beneficio"), tr("desconto_em_percentual_valor_fixo_ou")],
          [tr("o_operador_usa_na_inscricao"), tr("o_beneficio_aparece_na_tela_de")],
        ].map(([t, d], k) => (
          <li key={t} className="flex gap-3 p-4">
            <span className="font-display text-3xl font-bold leading-none text-accent">{String(k + 1).padStart(2, "0")}</span>
            <span><span className="block font-semibold">{t}</span><span className="text-sm text-muted-foreground">{d}</span></span>
          </li>
        ))}
      </ol>

      {minhas.length > 0 && (
        <FaixaIndicadores className="lg:grid-cols-4" itens={[
          { rotulo: tr("campanhas_ativas"), valor: String(minhas.filter((c) => c.ativa).length) },
          { rotulo: tr("beneficios_emitidos"), valor: String(vouchers.length) },
          { rotulo: tr("disponiveis"), valor: String(vouchers.filter((v) => statusVoucher(v) === "disponivel").length) },
          { rotulo: tr("usados"), valor: String(vouchers.filter((v) => v.status === "utilizada").length) },
        ]} />
      )}

      <div>
        <h2 className="mb-3 text-lg font-semibold">{tr("campanhas")}</h2>
        <ListaCampanhas base={base} campanhas={minhas} onEditar={setEditando} onNova={() => setEditando("nova")} />
      </div>
      {editando && (
        <FormCampanha base={base} usuario={usuario} organizacaoFixa={usuario.organizacaoId}
          inicial={editando === "nova" ? null : editando} onFechar={() => setEditando(null)} />
      )}
    </section>
  );
}
