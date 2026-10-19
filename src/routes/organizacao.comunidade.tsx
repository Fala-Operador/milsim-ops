import { OperacaoSelecionada } from "@/components/OperacaoSelecionada";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useEventoSelecionado, useEventosOrg } from "@/components/organizacao";

export const Route = createFileRoute("/organizacao/comunidade")({
  head: () => ({
    meta: [
      { title: "Comunidade — Minha organização — MilSim Ops" },
      { name: "description", content: "Resumo da comunidade do evento e acesso à moderação." },
    ],
  }),
  component: PaginaComunidadeOrg,
});

function PaginaComunidadeOrg() {
  const { base, eventos } = useEventosOrg();
  const [eventoId, setEventoId, invalido] = useEventoSelecionado(eventos);

  const foruns = base.foruns.filter((f) => f.eventoId === eventoId);
  const publicacoes = base.publicacoes.filter((p) => p.eventoId === eventoId && !p.oculta);
  const respostas = base.respostas.filter((r) => publicacoes.some((p) => p.id === r.publicacaoId));
  const denunciasPendentes = base.denuncias.filter((d) => d.eventoId === eventoId && d.status === "pendente");
  const suspensoes = base.restricoesComunidade.filter((r) => r.eventoId === eventoId && r.ativa);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-lg font-semibold uppercase">Comunidade</h2>
      </div>
      <OperacaoSelecionada eventos={eventos} evento={eventos.find((e) => e.id === eventoId)} invalido={invalido} onSelecionar={setEventoId} />
      {eventos.length === 0 ? (
        <Card><p className="text-sm text-muted-foreground">Nenhum evento criado ainda. Crie um evento no Painel.</p></Card>
      ) : !eventoId ? null : (
        <>
          <section aria-label="Resumo da comunidade" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {([
              ["Fóruns ativos", String(foruns.filter((f) => f.status !== "arquivado").length), `${foruns.filter((f) => f.status === "arquivado").length} arquivados`],
              ["Publicações", String(publicacoes.length), `${respostas.length} respostas`],
              ["Denúncias pendentes", String(denunciasPendentes.length), denunciasPendentes.length ? "Exigem análise" : "Nada a revisar"],
              ["Participantes suspensos", String(suspensoes.length), "Restrições ativas"],
            ] as const).map(([rotulo, valor, sub]) => (
              <Card key={rotulo}>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">{rotulo}</p>
                <p className="mt-1 font-mono text-2xl font-semibold">{valor}</p>
                <p className="mt-1 text-xs text-muted-foreground">{sub}</p>
              </Card>
            ))}
          </section>

          <Card>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="font-display text-base font-semibold uppercase">Moderação e fóruns</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Gerencie fóruns, analise denúncias, fixe publicações e suspenda participantes.
                </p>
              </div>
              <div className="flex gap-2">
                <Link to="/comunidade/$eventoId" params={{ eventoId }}>
                  <Button variant="outline">Ver comunidade</Button>
                </Link>
                <Link to="/comunidade/$eventoId/gerenciar" params={{ eventoId }}>
                  <Button>Gerenciar comunidade</Button>
                </Link>
              </div>
            </div>
            {denunciasPendentes.length > 0 && (
              <p className="mt-3 rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-warning">
                Há {denunciasPendentes.length} denúncia(s) aguardando análise na moderação.
              </p>
            )}
          </Card>

          <Card>
            <h3 className="font-display text-base font-semibold uppercase">Fóruns do evento</h3>
            <ul className="mt-3 space-y-1 text-sm">
              {foruns.map((f) => (
                <li key={f.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-elevated px-3 py-2">
                  <span>
                    {f.nome}
                    <span className="ml-2 text-xs text-muted-foreground">
                      {f.publico === "todos" ? "todos os inscritos" : "restrito a um exército"}
                    </span>
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      {publicacoes.filter((p) => p.forumId === f.id).length} publicações
                    </span>
                    {f.status === "arquivado" && <Badge variant="warning">arquivado</Badge>}
                  </span>
                </li>
              ))}
              {foruns.length === 0 && (
                <li className="text-muted-foreground">Nenhum fórum. Eles são criados automaticamente ao publicar a comunidade.</li>
              )}
            </ul>
          </Card>
        </>
      )}
    </div>
  );
}
