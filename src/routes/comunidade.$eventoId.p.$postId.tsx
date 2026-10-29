import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useComunidade } from "@/hooks/useComunidade";
import { detalhePublicacao, forunsVisiveis, podeResponder } from "@/services/comunidade";
import { responder } from "@/api/comunidade.functions";
import { CartaoPublicacao, CompositorResposta, ItemResposta, PortaComunidade, SemAcesso } from "@/components/comunidade";
import { Button } from "@/components/ui/button";
import { SkeletonPagina } from "@/components/ui";
import { tr } from "@/i18n/routes/comunidade.$eventoId.p.$postId";

export const Route = createFileRoute("/comunidade/$eventoId/p/$postId")({
  head: () => ({
    meta: [
      { title: tr("publicacao_comunidade_milsim_ops") },
      { name: "description", content: tr("publicacao_e_respostas_na_comunidade_pri") },
      { property: "og:title", content: tr("publicacao_comunidade_milsim_ops") },
      { property: "og:description", content: tr("conteudo_privado_da_comunidade_do_evento") },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: DetalhePublicacao,
});

function DetalhePublicacao() {
  const { eventoId, postId } = Route.useParams();
  const router = useRouter();
  const { montado, usuario, base, papel, gestao, atualizar } = useComunidade(eventoId, `/comunidade/${eventoId}/p/${postId}`);
  if (!montado || !usuario) return <SkeletonPagina />;
  // Link de publicação aberto por quem não participa: mesmo encaminhamento da comunidade.
  if (!papel) return <PortaComunidade eventoId={eventoId} />;
  const det = detalhePublicacao(usuario, postId);
  if (!det || det.pub.eventoId !== eventoId) return <SemAcesso eventoId={eventoId} />;
  const { pub, forum, respostas } = det;
  const foruns = forunsVisiveis(base, usuario, eventoId);
  const voltar = () => (window.history.length > 1 ? router.history.back() : router.navigate({ to: "/comunidade/$eventoId", params: { eventoId }, search: { forum: forum.id } }));

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <nav aria-label={tr("breadcrumb")} className="text-xs text-muted-foreground">
        <Link to="/comunidade/$eventoId" params={{ eventoId }} search={{}} className="hover:underline">{tr("comunidade")}</Link> /{" "}
        <Link to="/comunidade/$eventoId" params={{ eventoId }} search={{ forum: forum.id }} className="hover:underline">{forum.nome}</Link>{" "}{tr("publicacao")}</nav>
      <Button variant="ghost" className="mt-2" onClick={voltar}>{tr("voltar")}</Button>
      <div className="mt-2">
        <CartaoPublicacao
          base={base}
          pub={pub}
          usuario={usuario}
          gestao={gestao}
          foruns={foruns}
          mostrarForum
          noDetalhe
          onMudou={() => {
            if (!detalhePublicacao(usuario, postId)) voltar();
            else atualizar();
          }}
        />
      </div>
      <section aria-label={tr("respostas")} className="mt-4 rounded-lg border border-border bg-card px-4 pb-4">
        <h2 className="py-3 font-display text-sm font-semibold uppercase">{tr("respostas_length", { length: respostas.length })}</h2>
        {respostas.length === 0 && <p className="border-t border-border py-3 text-sm text-muted-foreground">{tr("nenhuma_resposta_ainda")}</p>}
        {respostas.map((r) => (
          <ItemResposta key={r.id} base={base} r={r} usuario={usuario} gestao={gestao} eventoId={eventoId} arquivado={forum.status !== "ativo"} onMudou={atualizar} />
        ))}
        {podeResponder(base, usuario, pub) ? (
          <CompositorResposta onEnviar={async (t, img) => { await responder(pub.id, t, img); atualizar(); }} />
        ) : (
          <p className="border-t border-border pt-3 text-sm text-muted-foreground">
            {forum.status !== "ativo" ? tr("forum_arquivado_sem_novas_respostas") : pub.respostasFechadas ? tr("as_respostas_foram_fechadas_pela_organiz") : tr("voce_nao_pode_responder_a_esta")}
          </p>
        )}
      </section>
    </div>
  );
}
