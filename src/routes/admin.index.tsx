import { FaixaIndicadores } from "@/components/FaixaIndicadores";
import { nomeModalidade } from "@/lib/modalidades";
import { createFileRoute, Link } from "@tanstack/react-router";
import { carregarBase } from "@/services/db";
import { formatarBRL, formatarDataBR } from "@/lib/domain/money";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const Route = createFileRoute("/admin/")({
  head: () => ({
    meta: [
      { title: "Dashboard admin — MilSim Ops" },
      { name: "description", content: "Visão geral de eventos, inscrições e receita registrada." },
      { property: "og:title", content: "Dashboard admin — MilSim Ops" },
      { property: "og:description", content: "Visão geral de eventos e inscrições." },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const base = carregarBase();
  const cards = [
    ["Eventos", base.eventos.length],
    ["Inscrições ativas", base.inscricoes.filter((i) => i.status === "confirmada").length],
    ["Receita registrada", formatarBRL(base.movimentacoes.reduce((s, m) => s + m.valorCentavos, 0))],
    ["Usuários ativos", base.usuarios.filter((u) => u.ativo).length],
  ] as const;

  return (
    <div className="space-y-8">
      <div>
        <h2 className="titulo-pagina">Visão geral</h2>
        <FaixaIndicadores className="mt-4 lg:grid-cols-4" itens={cards.map(([r, v]) => ({ rotulo: r, valor: String(v) }))} />
      </div>

      <section>
        <h2 className="font-display text-lg font-semibold uppercase">Eventos</h2>
        {base.eventos.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">Nenhum evento cadastrado.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <Table className="tabela-cards w-full text-sm">
              <TableHeader>
                <TableRow className="border-b border-border text-left text-xs uppercase text-muted-foreground">
                  <TableHead className="py-2 pr-3">Evento</TableHead>
                  <TableHead className="py-2 pr-3">Data</TableHead>
                  <TableHead className="py-2 pr-3">Status</TableHead>
                  <TableHead className="py-2 pr-3">Ocupação</TableHead>
                  <TableHead className="py-2 pr-3">Receita</TableHead>
                  <TableHead className="py-2">Ações</TableHead>
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
                      <TableCell data-rotulo="Data" className="py-2 pr-3">{formatarDataBR(ev.inicioEm)}</TableCell>
                      <TableCell data-rotulo="Status" className="py-2 pr-3"><Badge variant={tom}>{ev.status.replace("_", " ")}</Badge></TableCell>
                      <TableCell data-rotulo="Ocupação" className="py-2 pr-3">{inscritas}/{ev.capacidadeTotal}</TableCell>
                      <TableCell data-rotulo="Receita" className="py-2 pr-3">{formatarBRL(receita)}</TableCell>
                      <TableCell className="celula-acoes py-2">
                        <div className="flex flex-wrap gap-2">
                          <Link to="/admin/eventos/$eventoId" params={{ eventoId: ev.id }}>
                            <Button variant="outline">Ver</Button>
                          </Link>
                          {ev.status === "publicado" && (
                            <Link to="/admin/divulgacao" search={{ aba: "impulsionamentos", evento: ev.id }}>
                              <Button variant="outline">Impulsionar operação</Button>
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
