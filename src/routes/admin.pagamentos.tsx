import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Check, Clock, TriangleAlert } from "lucide-react";
import { carregarBase } from "@/services/db";
import { configuracaoRepasse, definirTaxaPlataforma } from "@/api/repasses.functions";
import { useAuth } from "@/contexts/AuthContext";
import { useVersaoBase } from "@/hooks/useVersaoBase";
import { ROTULO_RECEBIMENTO, taxaDaPlataforma, taxaPlataforma } from "@/lib/repasses";
import { formatarBRL } from "@/lib/domain/money";
import { FaixaIndicadores } from "@/components/FaixaIndicadores";
import { Badge } from "@/components/ui/badge";
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
    <section className="space-y-6">
      <div>
        <h2 className="titulo-pagina">Pagamentos</h2>
        <p className="subtitulo-pagina">Taxa da plataforma e situação das contas de recebimento das organizações no Stripe Connect.</p>
      </div>
      <FaixaIndicadores className="lg:grid-cols-3" itens={[
        { rotulo: "Taxa da plataforma", valor: `${String(taxaDaPlataforma(base)).replace(".", ",")}%` },
        { rotulo: "Contas ativas", valor: `${organizacoes.filter((o) => o.recebimento?.status === "ativa").length} de ${organizacoes.length}` },
        { rotulo: "Pagamentos online", valor: pagamentoOnline === null ? "—" : pagamentoOnline ? "Ligados" : "Desligados" },
      ]} />
      {pagamentoOnline === false && (
        <p role="status" className="border-l-2 border-warning bg-warning/10 px-4 py-3 text-sm">
          Os pagamentos online estão desligados: falta configurar a chave secreta do Stripe no servidor. A taxa pode ser definida mesmo assim.
        </p>
      )}
      {avisoChaves && (
        <p role="alert" className="border-l-2 border-destructive bg-destructive/10 px-4 py-3 text-sm">
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

      <section aria-labelledby="t-contas" className="border-t border-border pt-6">
        <h3 id="t-contas" className="text-lg font-semibold">Contas de recebimento das organizações</h3>
        <ul className="mt-3 divide-y divide-border border-y border-border">
          {organizacoes.map((o) => {
            const r = o.recebimento;
            const Icone = r ? ICONE[r.status] : Clock;
            return (
              <li key={o.id} className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
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
          {organizacoes.length === 0 && <li className="py-3 text-sm text-muted-foreground">Nenhuma organização cadastrada.</li>}
        </ul>
      </section>
    </section>
  );
}
