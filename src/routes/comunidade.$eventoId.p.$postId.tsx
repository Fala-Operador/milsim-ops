import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useComunidade } from "@/hooks/useComunidade";
import { detalhePublicacao, forunsVisiveis, podeResponder } from "@/services/comunidade";
import { responder } from "@/api/comunidade.functions";
import { CartaoPublicacao, CompositorResposta, ItemResposta, SemAcesso } from "@/components/comunidade";
import { Button } from "@/components/ui/button";
import { SkeletonPagina } from "@/components/ui";

export const Route = createFileRoute("/comunidade/$eventoId/p/$postId")({
  head: () => ({
    meta: [
      { title: "Publicação — Comunidade MilSim Ops" },
      { name: "description", content: "Publicação e respostas na comunidade privada do evento." },
      { property: "og:title", content: "Publicação — Comunidade MilSim Ops" },
      { property: "og:description", content: "Conteúdo privado da comunidade do evento." },
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
  const det = papel ? detalhePublicacao(usuario, postId) : null;
  if (!det || det.pub.eventoId !== eventoId) return <SemAcesso eventoId={eventoId} />;
  const { pub, forum, respostas } = det;
  const foruns = forunsVisiveis(base, usuario, eventoId);
  const voltar = () => (window.history.length > 1 ? router.history.back() : router.navigate({ to: "/comunidade/$eventoId", params: { eventoId }, search: { forum: forum.id } }));

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <nav aria-label="Breadcrumb" className="text-xs text-muted-foreground">
        <Link to="/comunidade/$eventoId" params={{ eventoId }} search={{}} className="hover:underline">Comunidade</Link> /{" "}
        <Link to="/comunidade/$eventoId" params={{ eventoId }} search={{ forum: forum.id }} className="hover:underline">{forum.nome}</Link> / Publicação
      </nav>
      <Button variant="ghost" className="mt-2" onClick={voltar}>← Voltar</Button>
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
      <section aria-label="Respostas" className="mt-4 rounded-lg border border-border bg-card px-4 pb-4">
        <h2 className="py-3 font-display text-sm font-semibold uppercase">Respostas ({respostas.length})</h2>
        {respostas.length === 0 && <p className="border-t border-border py-3 text-sm text-muted-foreground">Nenhuma resposta ainda.</p>}
        {respostas.map((r) => (
          <ItemResposta key={r.id} base={base} r={r} usuario={usuario} gestao={gestao} eventoId={eventoId} arquivado={forum.status !== "ativo"} onMudou={atualizar} />
        ))}
        {podeResponder(base, usuario, pub) ? (
          <CompositorResposta onEnviar={async (t, img) => { await responder(pub.id, t, img); atualizar(); }} />
        ) : (
          <p className="border-t border-border pt-3 text-sm text-muted-foreground">
            {forum.status !== "ativo" ? "Fórum arquivado: sem novas respostas." : pub.respostasFechadas ? "As respostas foram fechadas pela organização." : "Você não pode responder a esta publicação."}
          </p>
        )}
      </section>
    </div>
  );
}
