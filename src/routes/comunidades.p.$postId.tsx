import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { lerForum, lerPost, lerRespostas } from "@/api/social.functions";
import { moderaForum } from "@/lib/comunidadeGeral";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { EstadoVazio, SkeletonCartao } from "@/components/ui";
import { CartaoPost } from "@/components/social/CartaoPost";
import { Compositor } from "@/components/social/Compositor";
import { ListaPosts } from "@/components/social/ListaPosts";

// Publicação da comunidade geral com as respostas. Visitante vê se o autor tem perfil público.
export const Route = createFileRoute("/comunidades/p/$postId")({
  head: () => ({
    meta: [
      { title: "Publicação — Comunidade MilSim Ops" },
      { name: "description", content: "Publicação na comunidade geral do MilSim Ops." },
    ],
  }),
  component: DetalhePost,
});

function DetalhePost() {
  const { postId } = Route.useParams();
  const { usuario } = useAuth();
  const router = useRouter();
  const qc = useQueryClient();
  const chave = ["social", "post", postId, usuario?.id ?? "visitante"] as const;
  const q = useQuery({ queryKey: chave, queryFn: () => lerPost(postId), retry: false });
  // Post de fórum: quem modera o fórum pode ocultar o post e as respostas.
  const forumId = q.data?.post.forumId;
  const forum = useQuery({ queryKey: ["social", "forum", forumId, usuario?.id ?? "visitante"], queryFn: () => lerForum(forumId!), enabled: !!forumId && !!usuario });
  const moderar = !!forum.data && moderaForum(forum.data.forum.meuPapel, forum.data.forum.minhaSituacao);
  const voltar = () => (window.history.length > 1 ? router.history.back() : router.navigate({ to: "/comunidades" }));
  const atualizar = () => void qc.invalidateQueries({ queryKey: ["social"] });

  return (
    <div className="mx-auto max-w-2xl space-y-4 px-4 py-6">
      <Button variant="ghost" onClick={voltar} className="-ml-2"><ArrowLeft className="h-4 w-4" /> Voltar</Button>
      {q.isPending ? (
        <SkeletonCartao />
      ) : q.isError || !q.data ? (
        <div className="space-y-3">
          <EstadoVazio titulo="Publicação indisponível" descricao="Ela pode ter sido excluída, ocultada pela moderação ou ser de um perfil privado." />
          <Link to="/comunidades" className="inline-block text-sm text-accent hover:underline">Ver a comunidade →</Link>
        </div>
      ) : (
        <>
          {q.data.pai && (
            <div className="opacity-80">
              <p className="mb-1 text-xs text-muted-foreground">Em resposta a</p>
              <CartaoPost post={q.data.pai} onMudou={atualizar} />
            </div>
          )}
          {forum.data && (
            <Link to="/comunidades/f/$forumId" params={{ forumId: forum.data.forum.id }} className="inline-block text-xs text-muted-foreground hover:underline">
              Fórum: {forum.data.forum.nome}
            </Link>
          )}
          <CartaoPost post={q.data.post} moderar={moderar} onMudou={() => { atualizar(); if (q.data.post.proprio) void router.navigate({ to: "/comunidades" }); }} destaque />
          {usuario ? (
            <Compositor respondendoA={postId} placeholder="Escreva sua resposta" onPublicado={atualizar} />
          ) : (
            <p className="text-sm text-muted-foreground">
              <Link to="/login" search={{ redirect: `/comunidades/p/${postId}` }} className="text-accent hover:underline">Entre</Link> para responder.
            </p>
          )}
          <section aria-labelledby="respostas" className="space-y-3">
            <h2 id="respostas" className="font-display text-base font-semibold uppercase tracking-wide text-muted-foreground">Respostas</h2>
            <ListaPosts
              chave={["social", "respostas", postId, usuario?.id ?? "visitante"]}
              carregar={(c) => lerRespostas(postId, c)}
              moderar={moderar}
              vazio={{ titulo: "Nenhuma resposta ainda" }}
            />
          </section>
        </>
      )}
    </div>
  );
}
