import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Rocket } from "lucide-react";
import type { BaseDados } from "@/lib/domain/types";
import { carregarBase } from "@/services/db";
import { useVersaoBase } from "@/hooks/useVersaoBase";
import { PlanosImpulso } from "@/components/impulsos";
import { SkeletonPagina } from "@/components/ui";

export const Route = createFileRoute("/admin/loja")({
  head: () => ({
    meta: [
      { title: "Loja da plataforma — Admin MilSim Ops" },
      { name: "description", content: "Itens que a própria plataforma vende, como os impulsos de operações." },
      { property: "og:title", content: "Loja da plataforma — Admin MilSim Ops" },
      { property: "og:description", content: "Itens vendidos pela plataforma." },
    ],
  }),
  component: LojaDaPlataforma,
});

/** Seções da loja; cada item novo vendido pela plataforma ganha a sua aqui. */
const SECOES = [
  { id: "impulsos", rotulo: "Impulsos de operações", descricao: "Destaque pago das operações na página inicial e no topo da listagem.", icone: Rocket },
] as const;

function LojaDaPlataforma() {
  const versao = useVersaoBase();
  const [base, setBase] = useState<BaseDados | null>(null);
  useEffect(() => setBase(structuredClone(carregarBase())), [versao]);
  if (!base) return <SkeletonPagina />;
  return (
    <div>
      <h2 className="font-display text-xl font-semibold uppercase">Loja da plataforma</h2>
      <p className="text-sm text-muted-foreground">Itens que a MilSim Ops vende diretamente, pagos à plataforma pelo Stripe. Edite preço, validade, imagem e venda de cada item.</p>
      <nav aria-label="Seções da loja" className="mt-4 flex flex-wrap gap-2">
        {SECOES.map((s) => (
          <a key={s.id} href={`#${s.id}`} className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-1.5 text-sm hover:bg-secondary">
            <s.icone className="size-4" aria-hidden="true" />{s.rotulo}
          </a>
        ))}
      </nav>
      <div className="mt-6 space-y-8">
        <section id="impulsos" aria-labelledby="loja-impulsos" className="scroll-mt-20">
          <h3 id="loja-impulsos" className="font-display text-lg font-semibold uppercase">{SECOES[0].rotulo}</h3>
          <p className="mb-3 text-sm text-muted-foreground">{SECOES[0].descricao}</p>
          <PlanosImpulso base={base} />
        </section>
      </div>
    </div>
  );
}
