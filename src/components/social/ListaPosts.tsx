// Lista paginada de publicações ("carregar mais"), usada no feed, no perfil e nas respostas.
// As leituras não passam pela visão: cada página vem pronta do servidor (social_posts_page).
import { useInfiniteQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { EstadoVazio, ErroSecao, SkeletonCartao } from "@/components/ui";
import type { PaginaPosts } from "@/lib/comunidadeGeral";
import { CartaoPost } from "./CartaoPost";
import { tr } from "@/i18n/components/social/ListaPosts";

export type CarregarPagina = (cursor: { antes?: string | undefined; antesId?: string | undefined }) => Promise<PaginaPosts>;

export function ListaPosts({ chave, carregar, vazio, moderar = false }: {
  chave: readonly unknown[];
  carregar: CarregarPagina;
  vazio: { titulo: string; descricao?: string | undefined };
  /** Dono ou moderador do fórum listado: cada post ganha a opção de ocultar. */
  moderar?: boolean;
}) {
  const q = useInfiniteQuery({
    queryKey: chave,
    queryFn: ({ pageParam }) => carregar(pageParam),
    initialPageParam: {} as { antes?: string | undefined; antesId?: string | undefined },
    getNextPageParam: (ultima) => ultima.proximo,
  });

  if (q.isPending) return <div className="space-y-3"><SkeletonCartao /><SkeletonCartao /></div>;
  if (q.isError) return <ErroSecao titulo={tr("nao_foi_possivel_carregar_as_publicacoes")} descricao={q.error.message} onTentar={() => void q.refetch()} />;
  const posts = q.data.pages.flatMap((p) => p.posts);
  if (!posts.length) return <EstadoVazio titulo={vazio.titulo} descricao={vazio.descricao ?? ""} />;

  return (
    <div className="space-y-3">
      <ul className="space-y-3">
        {posts.map((p) => (
          <li key={p.id} className="surgir"><CartaoPost post={p} moderar={moderar} onMudou={() => void q.refetch()} /></li>
        ))}
      </ul>
      {q.isFetchingNextPage && <div className="space-y-3"><SkeletonCartao /><SkeletonCartao /></div>}
      {q.hasNextPage && !q.isFetchingNextPage && (
        <div className="flex justify-center">
          <Button variant="outline" onClick={() => void q.fetchNextPage()}>{tr("carregar_mais")}</Button>
        </div>
      )}
    </div>
  );
}
