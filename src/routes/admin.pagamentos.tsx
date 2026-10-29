import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Check, Clock, TriangleAlert } from "lucide-react";
import { carregarBase } from "@/services/db";
import { configuracaoRepasse, definirTaxaPlataforma } from "@/api/repasses.functions";
import { useAuth } from "@/contexts/AuthContext";
import { useVersaoBase } from "@/hooks/useVersaoBase";
import { ROTULO_RECEBIMENTO, taxaDaPlataforma, taxaPlataforma } from "@/lib/repasses";
import { formatarBRL, formatarDataHoraBR } from "@/lib/domain/money";
import { FaixaIndicadores } from "@/components/FaixaIndicadores";
import { Badge } from "@/components/ui/badge";
import { CardTaxa } from "@/components/CardTaxa";
import type { StatusRecebimento } from "@/lib/domain/types";
import { tr } from "@/i18n/routes/admin.pagamentos";

export const Route = createFileRoute("/admin/pagamentos")({
  head: () => ({
    meta: [
      { title: tr("pagamentos_admin_milsim_ops") },
      { name: "description", content: tr("taxa_da_plataforma_e_contas_de") },
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
        <h2 className="titulo-pagina">{tr("pagamentos")}</h2>
        <p className="subtitulo-pagina">{tr("taxa_da_plataforma_e_situacao_das")}</p>
      </div>
      <FaixaIndicadores className="lg:grid-cols-3" itens={[
        { rotulo: tr("taxa_da_plataforma"), valor: `${String(taxaDaPlataforma(base)).replace(".", ",")}%` },
        { rotulo: tr("contas_ativas"), valor: tr("x_de_y", { x: organizacoes.filter((o) => o.recebimento?.status === "ativa").length, y: organizacoes.length }) },
        { rotulo: tr("pagamentos_online"), valor: pagamentoOnline === null ? "—" : pagamentoOnline ? tr("ligados") : tr("desligados") },
      ]} />
      {pagamentoOnline === false && (
        <p role="status" className="border-l-2 border-warning bg-warning/10 px-4 py-3 text-sm">{tr("os_pagamentos_online_estao_desligados_fa")}</p>
      )}
      {avisoChaves && (
        <p role="alert" className="border-l-2 border-destructive bg-destructive/10 px-4 py-3 text-sm">{tr("os_paineis_do_stripe_dentro_do", { avisoChaves })}</p>
      )}

      <CardTaxa
        id="taxa"
        titulo={tr("taxa_da_plataforma_organizacao")}
        descricao={tr("percentual_retido_em_cada_ingresso_vendi")}
        atual={taxaDaPlataforma(base)}
        salvar={definirTaxaPlataforma}
        exemplo={(p) => tr("exemplo_num_ingresso_de_valor_a", { valor: formatarBRL(15000), valor2: formatarBRL(taxaPlataforma(15000, p)), valor3: formatarBRL(15000 - taxaPlataforma(15000, p)) })}
      />
      {config && <p className="text-xs text-muted-foreground">{tr("ultima_alteracao_da_taxa")}{" "}{formatarDataHoraBR(config.atualizadoEm)}{tr("a_taxa_de_servico_do_comprador")}</p>}

      <section aria-labelledby="t-contas" className="border-t border-border pt-6">
        <h3 id="t-contas" className="text-lg font-semibold">{tr("contas_de_recebimento_das_organizacoes")}</h3>
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
                  <Badge variant={TOM[r.status]} aria-label={tr("recebimentos_valor", { valor: ROTULO_RECEBIMENTO[r.status] })}><Icone aria-hidden="true" />{ROTULO_RECEBIMENTO[r.status]}</Badge>
                ) : (
                  <Badge aria-label={tr("recebimentos_nao_configurado")}><Icone aria-hidden="true" />{tr("nao_configurado")}</Badge>
                )}
              </li>
            );
          })}
          {organizacoes.length === 0 && <li className="py-3 text-sm text-muted-foreground">{tr("nenhuma_organizacao_cadastrada")}</li>}
        </ul>
      </section>
    </section>
  );
}
