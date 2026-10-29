import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Rocket } from "lucide-react";
import type { BaseDados } from "@/lib/domain/types";
import { carregarBase } from "@/services/db";
import { useVersaoBase } from "@/hooks/useVersaoBase";
import { PlanosImpulso } from "@/components/impulsos";
import { SkeletonPagina } from "@/components/ui";
import { tr } from "@/i18n/routes/admin.loja";

export const Route = createFileRoute("/admin/loja")({
  head: () => ({
    meta: [
      { title: tr("loja_da_plataforma_admin_milsim_ops") },
      { name: "description", content: tr("itens_que_a_propria_plataforma_vende") },
      { property: "og:title", content: tr("loja_da_plataforma_admin_milsim_ops") },
      { property: "og:description", content: tr("itens_vendidos_pela_plataforma") },
    ],
  }),
  component: LojaDaPlataforma,
});

/** Seções da loja; cada item novo vendido pela plataforma ganha a sua aqui. */
const SECOES = [
  { id: "impulsos", get rotulo() { return tr("impulsos_de_operacoes"); }, get descricao() { return tr("destaque_pago_das_operacoes_na_pagina"); }, icone: Rocket },
] as const;

function LojaDaPlataforma() {
  const versao = useVersaoBase();
  const [base, setBase] = useState<BaseDados | null>(null);
  useEffect(() => setBase(structuredClone(carregarBase())), [versao]);
  if (!base) return <SkeletonPagina />;
  return (
    <div>
      <h2 className="titulo-pagina">{tr("loja_da_plataforma")}</h2>
      <p className="subtitulo-pagina">{tr("itens_que_a_milsim_ops_vende")}</p>
      {SECOES.length > 1 && <nav aria-label={tr("secoes_da_loja")} className="mt-4 flex flex-wrap gap-2">
        {SECOES.map((s) => (
          <a key={s.id} href={`#${s.id}`} className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-1.5 text-sm hover:bg-secondary">
            <s.icone className="size-4" aria-hidden="true" />{s.rotulo}
          </a>
        ))}
      </nav>}
      <div className="mt-6 space-y-8">
        <section id="impulsos" aria-labelledby="loja-impulsos" className="scroll-mt-20">
          <div className="mb-4 flex items-center gap-3 border-b border-border pb-3">
            <span className="grid size-9 place-items-center rounded-md border border-border text-accent"><Rocket className="size-4" aria-hidden="true" /></span>
            <div>
              <h3 id="loja-impulsos" className="text-xl font-semibold">{SECOES[0].rotulo}</h3>
              <p className="text-sm text-muted-foreground">{SECOES[0].descricao}</p>
            </div>
          </div>
          <PlanosImpulso base={base} />
        </section>
      </div>
    </div>
  );
}
