import { OperacaoSelecionada } from "@/components/OperacaoSelecionada";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useEventoSelecionado, useEventosOrg } from "@/components/organizacao";
import { tr } from "@/i18n/routes/organizacao.comunidade";

export const Route = createFileRoute("/organizacao/comunidade")({
  head: () => ({
    meta: [
      { title: tr("comunidade_minha_organizacao_milsim_ops") },
      { name: "description", content: tr("resumo_da_comunidade_do_evento_e") },
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
        <h2 className="titulo-pagina">{tr("comunidade")}</h2>
      </div>
      <OperacaoSelecionada eventos={eventos} evento={eventos.find((e) => e.id === eventoId)} invalido={invalido} onSelecionar={setEventoId} />
      {eventos.length === 0 ? (
        <Card><p className="subtitulo-pagina">{tr("nenhum_evento_criado_ainda_crie_um")}</p></Card>
      ) : !eventoId ? null : (
        <>
          <section aria-label={tr("resumo_da_comunidade")} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {([
              [tr("foruns_ativos"), String(foruns.filter((f) => f.status !== "arquivado").length), tr("length_arquivados", { length: foruns.filter((f) => f.status === "arquivado").length })],
              [tr("publicacoes"), String(publicacoes.length), tr("length_respostas", { length: respostas.length })],
              [tr("denuncias_pendentes"), String(denunciasPendentes.length), denunciasPendentes.length ? tr("exigem_analise") : tr("nada_a_revisar")],
              [tr("participantes_suspensos"), String(suspensoes.length), tr("restricoes_ativas")],
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
                <h3 className="font-display text-base font-semibold uppercase">{tr("moderacao_e_foruns")}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{tr("gerencie_foruns_analise_denuncias_fixe_p")}</p>
              </div>
              <div className="grid w-full gap-2 sm:flex sm:w-auto">
                <Button asChild variant="outline">
                  <Link to="/comunidade/$eventoId" params={{ eventoId }}>{tr("ver_comunidade")}</Link>
                </Button>
                <Button asChild>
                  <Link to="/comunidade/$eventoId/gerenciar" params={{ eventoId }}>{tr("gerenciar_comunidade")}</Link>
                </Button>
              </div>
            </div>
            {denunciasPendentes.length > 0 && (
              <p className="mt-3 rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-warning">{tr("ha_length_denuncia_s_aguardando_analise", { length: denunciasPendentes.length })}</p>
            )}
          </Card>

          <Card>
            <h3 className="font-display text-base font-semibold uppercase">{tr("foruns_do_evento")}</h3>
            <ul className="mt-3 space-y-1 text-sm">
              {foruns.map((f) => (
                <li key={f.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-elevated px-3 py-2">
                  <span>
                    {f.nome}
                    <span className="ml-2 text-xs text-muted-foreground">
                      {f.publico === "todos" ? tr("todos_os_inscritos") : tr("restrito_a_um_exercito")}
                    </span>
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      {publicacoes.filter((p) => p.forumId === f.id).length}{" "}{tr("publicacoes_2")}</span>
                    {f.status === "arquivado" && <Badge variant="warning">{tr("arquivado")}</Badge>}
                  </span>
                </li>
              ))}
              {foruns.length === 0 && (
                <li className="text-muted-foreground">{tr("nenhum_forum_eles_sao_criados_automatica")}</li>
              )}
            </ul>
          </Card>
        </>
      )}
    </div>
  );
}
