import { nomeModalidade } from "@/lib/modalidades";
import { createFileRoute, Link } from "@tanstack/react-router";
import { carregarBase } from "@/services/db";
import { formatarBRL, formatarDataBR } from "@/lib/domain/money";
import { Badge, Botao, Cartao } from "@/components/ui";

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
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {cards.map(([r, v]) => (
          <Cartao key={r}>
            <p className="text-xs uppercase text-muted-foreground">{r}</p>
            <p className="font-display text-2xl font-semibold">{v}</p>
          </Cartao>
        ))}
      </section>

      <section>
        <h2 className="font-display text-lg font-semibold uppercase">Eventos</h2>
        {base.eventos.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">Nenhum evento cadastrado.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase text-muted-foreground">
                  <th className="py-2 pr-3">Evento</th>
                  <th className="py-2 pr-3">Data</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 pr-3">Ocupação</th>
                  <th className="py-2 pr-3">Receita</th>
                  <th className="py-2">Ações</th>
                </tr>
              </thead>
              <tbody>
                {base.eventos.map((ev) => {
                  const inscritas = base.inscricoes.filter((i) => i.eventoId === ev.id && i.status === "confirmada").length;
                  const receita = base.movimentacoes.filter((m) => m.eventoId === ev.id).reduce((s, m) => s + m.valorCentavos, 0);
                  const org = base.organizacoes.find((o) => o.id === ev.organizacaoId);
                  const tom =
                    ev.status === "publicado" ? "sucesso" : ev.status === "cancelado" ? "perigo" : ev.status === "rascunho" ? "aviso" : "padrao";
                  return (
                    <tr key={ev.id} className="border-b border-border/50">
                      <td className="py-2 pr-3">
                        <p className="font-medium">{ev.nome}</p>
                        <p className="text-xs text-muted-foreground">{org?.nome ?? "—"} · {ev.cidade}/{ev.uf} · {nomeModalidade(ev.modalidade)}</p>
                      </td>
                      <td className="py-2 pr-3">{formatarDataBR(ev.inicioEm)}</td>
                      <td className="py-2 pr-3"><Badge tom={tom}>{ev.status.replace("_", " ")}</Badge></td>
                      <td className="py-2 pr-3">{inscritas}/{ev.capacidadeTotal}</td>
                      <td className="py-2 pr-3">{formatarBRL(receita)}</td>
                      <td className="py-2">
                        <div className="flex flex-wrap gap-2">
                          <Link to="/eventos/$eventoId" params={{ eventoId: ev.id }}>
                            <Botao variante="contorno">Ver</Botao>
                          </Link>
                          {ev.status === "publicado" && (
                            <Link to="/admin/divulgacao" search={{ aba: "impulsionamentos", evento: ev.id }}>
                              <Botao variante="contorno">Impulsionar operação</Botao>
                            </Link>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
