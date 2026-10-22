import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Check, Clock, TriangleAlert } from "lucide-react";
import { carregarBase } from "@/services/db";
import { configuracaoRepasse, definirTaxaPlataforma } from "@/api/repasses.functions";
import { useAuth } from "@/contexts/AuthContext";
import { useVersaoBase } from "@/hooks/useVersaoBase";
import { ROTULO_RECEBIMENTO, taxaDaPlataforma, taxaPlataforma } from "@/lib/repasses";
import { formatarBRL } from "@/lib/domain/money";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { CardTaxa } from "@/components/CardTaxa";
import type { StatusRecebimento } from "@/lib/domain/types";

export const Route = createFileRoute("/admin/pagamentos")({
  head: () => ({
    meta: [
      { title: "Pagamentos — Admin MilSim Ops" },
      { name: "description", content: "Taxa da plataforma e contas de recebimento das organizações." },
    ],
  }),
  component: Pagamentos,
});

const TOM: Record<StatusRecebimento, "success" | "warning" | "destructive"> = { ativa: "success", em_analise: "warning", pendente: "warning", restrita: "destructive" };
const ICONE: Record<StatusRecebimento, typeof Check> = { ativa: Check, em_analise: Clock, pendente: Clock, restrita: TriangleAlert };

function Pagamentos() {
  const { usuario } = useAuth();
  useVersaoBase();
  const base = carregarBase();
  const config = base.configuracoes.find((c) => c.id === "plataforma");
  const [pagamentoOnline, setPagamentoOnline] = useState<boolean | null>(null);
  const [avisoChaves, setAvisoChaves] = useState("");

  useEffect(() => {
    configuracaoRepasse()
      .then((c) => {
        setPagamentoOnline(c.pagamentoOnline);
        setAvisoChaves(c.avisoChaves ?? "");
      })
      .catch(() => setPagamentoOnline(null));
  }, [usuario?.id]);

  if (!usuario) return null;
  const organizacoes = [...base.organizacoes].sort((a, b) => a.nome.localeCompare(b.nome));
  return (
    <section className="space-y-4">
      <h2 className="font-display text-lg font-semibold uppercase">Pagamentos</h2>
      {pagamentoOnline === false && (
        <p role="status" className="rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-warning">
          Os pagamentos online estão desligados: falta configurar a chave secreta do Stripe no servidor. A taxa pode ser definida mesmo assim.
        </p>
      )}
      {avisoChaves && (
        <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          Os painéis do Stripe dentro do site estão desligados: {avisoChaves} Enquanto isso, o cadastro de recebimentos abre no site do Stripe.
        </p>
      )}

      <CardTaxa
        id="taxa"
        titulo="Taxa da plataforma (organização)"
        descricao="Percentual retido em cada ingresso vendido online e repassado à organização pelo Stripe Connect. Organizações sem conta de recebimento ativa não vendem ingressos pagos."
        atual={taxaDaPlataforma(base)}
        salvar={definirTaxaPlataforma}
        exemplo={(p) => `Exemplo: num ingresso de ${formatarBRL(15000)}, a plataforma retém ${formatarBRL(taxaPlataforma(15000, p))} e a organização recebe ${formatarBRL(15000 - taxaPlataforma(15000, p))}.`}
      />
      {config && <p className="text-xs text-muted-foreground">Última alteração da taxa: {new Date(config.atualizadoEm).toLocaleString("pt-BR")}. A taxa de serviço do comprador é definida por cada organização no Financeiro dela.</p>}

      <Card>
        <h3 className="font-medium">Contas de recebimento das organizações</h3>
        <ul className="mt-3 space-y-2">
          {organizacoes.map((o) => {
            const r = o.recebimento;
            const Icone = r ? ICONE[r.status] : Clock;
            return (
              <li key={o.id} className="flex flex-col gap-1 rounded-md border border-border px-3 py-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                <span className="min-w-0 break-words text-sm font-medium">
                  {o.nome}
                  {r && <span className="block font-mono text-xs font-normal text-muted-foreground">{r.contaId}</span>}
                </span>
                {r ? (
                  <Badge variant={TOM[r.status]} aria-label={`Recebimentos: ${ROTULO_RECEBIMENTO[r.status]}`}><Icone aria-hidden="true" />{ROTULO_RECEBIMENTO[r.status]}</Badge>
                ) : (
                  <Badge aria-label="Recebimentos: não configurado"><Icone aria-hidden="true" />Não configurado</Badge>
                )}
              </li>
            );
          })}
          {organizacoes.length === 0 && <li className="text-sm text-muted-foreground">Nenhuma organização cadastrada.</li>}
        </ul>
      </Card>
    </section>
  );
}
