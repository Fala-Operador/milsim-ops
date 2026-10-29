import { FaixaIndicadores } from "@/components/FaixaIndicadores";
import { nomeModalidade } from "@/lib/modalidades";
import { createFileRoute, Link } from "@tanstack/react-router";
import { carregarBase } from "@/services/db";
import { formatarBRL, formatarDataBR } from "@/lib/domain/money";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { tr } from "@/i18n/routes/admin.index";

export const Route = createFileRoute("/admin/")({
  head: () => ({
    meta: [
      { title: tr("dashboard_admin_milsim_ops") },
      { name: "description", content: tr("visao_geral_de_eventos_inscricoes_e") },
      { property: "og:title", content: tr("dashboard_admin_milsim_ops") },
      { property: "og:description", content: tr("visao_geral_de_eventos_e_inscricoes") },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const base = carregarBase();
  const cards = [
    [tr("eventos"), base.eventos.length],
    [tr("inscricoes_ativas"), base.inscricoes.filter((i) => i.status === "confirmada").length],
    [tr("receita_registrada"), formatarBRL(base.movimentacoes.reduce((s, m) => s + m.valorCentavos, 0))],
    [tr("usuarios_ativos"), base.usuarios.filter((u) => u.ativo).length],
  ] as const;

  return (
    <div className="space-y-8">
      <div>
        <h2 className="titulo-pagina">{tr("visao_geral")}</h2>
        <FaixaIndicadores className="mt-4 lg:grid-cols-4" itens={cards.map(([r, v]) => ({ rotulo: r, valor: String(v) }))} />
      </div>

      <section>
        <h2 className="font-display text-lg font-semibold uppercase">{tr("eventos")}</h2>
        {base.eventos.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">{tr("nenhum_evento_cadastrado")}</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <Table className="tabela-cards w-full text-sm">
              <TableHeader>
                <TableRow className="border-b border-border text-left text-xs uppercase text-muted-foreground">
                  <TableHead className="py-2 pr-3">{tr("evento")}</TableHead>
                  <TableHead className="py-2 pr-3">{tr("data")}</TableHead>
                  <TableHead className="py-2 pr-3">{tr("status")}</TableHead>
                  <TableHead className="py-2 pr-3">{tr("ocupacao")}</TableHead>
                  <TableHead className="py-2 pr-3">{tr("receita")}</TableHead>
                  <TableHead className="py-2">{tr("acoes")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {base.eventos.map((ev) => {
                  const inscritas = base.inscricoes.filter((i) => i.eventoId === ev.id && i.status === "confirmada").length;
                  const receita = base.movimentacoes.filter((m) => m.eventoId === ev.id).reduce((s, m) => s + m.valorCentavos, 0);
                  const org = base.organizacoes.find((o) => o.id === ev.organizacaoId);
                  const tom =
                    ev.status === "publicado" ? "success" : ev.status === "cancelado" ? "destructive" : ev.status === "rascunho" ? "warning" : "secondary";
                  return (
                    <TableRow key={ev.id} className="border-b border-border/50">
                      <TableCell className="py-2 pr-3">
                        <p className="font-medium">{ev.nome}</p>
                        <p className="text-xs text-muted-foreground">{org?.nome ?? "—"} · {ev.cidade}/{ev.uf} · {nomeModalidade(ev.modalidade)}</p>
                      </TableCell>
                      <TableCell data-rotulo={tr("data")} className="py-2 pr-3">{formatarDataBR(ev.inicioEm)}</TableCell>
                      <TableCell data-rotulo={tr("status")} className="py-2 pr-3"><Badge variant={tom}>{ev.status.replace("_", " ")}</Badge></TableCell>
                      <TableCell data-rotulo={tr("ocupacao")} className="py-2 pr-3">{inscritas}/{ev.capacidadeTotal}</TableCell>
                      <TableCell data-rotulo={tr("receita")} className="py-2 pr-3">{formatarBRL(receita)}</TableCell>
                      <TableCell className="celula-acoes py-2">
                        <div className="flex flex-wrap gap-2">
                          <Link to="/admin/eventos/$eventoId" params={{ eventoId: ev.id }}>
                            <Button variant="outline">{tr("ver")}</Button>
                          </Link>
                          {ev.status === "publicado" && (
                            <Link to="/admin/divulgacao" search={{ aba: "impulsionamentos", evento: ev.id }}>
                              <Button variant="outline">{tr("impulsionar_operacao")}</Button>
                            </Link>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </section>
    </div>
  );
}
