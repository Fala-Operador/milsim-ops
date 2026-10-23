import { createFileRoute, Link } from "@tanstack/react-router";
import { useInfiniteQuery, useQuery, useQueryClient, type UseQueryResult } from "@tanstack/react-query";
import { useState } from "react";
import { lerDenunciasPendentes, lerPostsAuditoria, moderarPost, resolverDenuncia } from "@/api/social.functions";
import { MOTIVOS_DENUNCIA } from "@/lib/comunidadeGeral";
import { tempoRelativo } from "@/lib/tempoRelativo";
import { formatarDataHoraBR } from "@/lib/domain/money";
import type { DenunciaDTO, FiltroAuditoria, PostAuditoriaDTO } from "@/server/social.server";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { NativeSelect } from "@/components/ui/native-select";
import { Label } from "@/components/ui/label";
import { EstadoVazio, ErroSecao, ModalTexto, SkeletonCartao } from "@/components/ui";
import { AvatarAutor } from "@/components/social/CartaoPost";
import { useConfirmacao } from "@/contexts/ConfirmacaoContext";

// Moderação da comunidade geral: denúncias pendentes (das mais antigas para as mais novas)
// e auditoria das últimas publicações de toda a comunidade (inclusive privadas, ocultas e
// removidas). Sem IA por enquanto: fotos e textos fora da lista de termos dependem disto.
export const Route = createFileRoute("/admin/comunidade")({
  head: () => ({
    meta: [
      { title: "Comunidade — Admin MilSim Ops" },
      { name: "description", content: "Moderação da comunidade geral: denúncias e auditoria das publicações." },
    ],
  }),
  component: ModeracaoComunidade,
});

const CHAVE_DENUNCIAS = ["social", "denuncias"] as const;
const CHAVE_AUDITORIA = ["social", "auditoria"] as const;

function ModeracaoComunidade() {
  const [aba, setAba] = useState<"denuncias" | "publicacoes">("denuncias");
  const denuncias = useQuery({ queryKey: CHAVE_DENUNCIAS, queryFn: lerDenunciasPendentes });
  const pendentes = denuncias.data?.length ?? 0;

  return (
    <section className="space-y-4">
      <div>
        <h2 className="font-display text-lg font-semibold uppercase">Comunidade — moderação</h2>
        <p className="mt-1 max-w-prose text-sm text-muted-foreground">
          Denúncias para resolver e as últimas publicações de toda a comunidade, para auditoria.
        </p>
      </div>
      <Tabs value={aba} onValueChange={(v) => setAba(v as typeof aba)}>
        <TabsList className="flex-wrap gap-2">
          <TabsTrigger value="denuncias" asChild>
            <Button variant={aba === "denuncias" ? "default" : "outline"}>
              Denúncias{pendentes > 0 && <Badge variant="warning" className="ml-1">{pendentes}</Badge>}
            </Button>
          </TabsTrigger>
          <TabsTrigger value="publicacoes" asChild>
            <Button variant={aba === "publicacoes" ? "default" : "outline"}>Últimas publicações</Button>
          </TabsTrigger>
        </TabsList>
      </Tabs>
      {aba === "denuncias" ? <Denuncias q={denuncias} /> : <Auditoria />}
    </section>
  );
}

/** Conteúdo de uma publicação (autor, texto e fotos) para as duas abas. */
function ConteudoPost({ autor, criadoEm, texto, imagens }: Pick<PostAuditoriaDTO, "autor" | "criadoEm" | "texto" | "imagens">) {
  return (
    <div className="rounded-md border border-border bg-elevated p-3">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <AvatarAutor nome={autor.nome} fotoUrl={autor.fotoUrl} tamanho="h-7 w-7" />
        <Link to="/operador/$usuarioId" params={{ usuarioId: autor.id }} search={{ aba: undefined }} className="font-medium hover:underline">{autor.nome}</Link>
        <span className="text-muted-foreground" title={formatarDataHoraBR(criadoEm)}>· {tempoRelativo(criadoEm)}</span>
      </div>
      {texto && <p className="mt-2 whitespace-pre-wrap break-words text-sm">{texto}</p>}
      {imagens.length > 0 && (
        <div className="mt-2 grid grid-cols-4 gap-1">
          {imagens.map((i) => (
            <a key={i.url} href={i.url} target="_blank" rel="noopener noreferrer"><img src={i.url} alt={i.alt || "Foto da publicação"} className="aspect-square w-full rounded object-cover" /></a>
          ))}
        </div>
      )}
    </div>
  );
}

function Denuncias({ q }: { q: UseQueryResult<DenunciaDTO[]> }) {
  const qc = useQueryClient();
  const [ocultando, setOcultando] = useState<string | null>(null);
  const [erro, setErro] = useState("");
  const atualizar = () => Promise.all([q.refetch(), qc.invalidateQueries({ queryKey: CHAVE_AUDITORIA })]);

  const descartar = async (id: string) => {
    setErro("");
    try {
      await resolverDenuncia(id, "descartar");
      await atualizar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível descartar.");
    }
  };

  return (
    <div className="space-y-3">
      <p className="max-w-prose text-sm text-muted-foreground">
        Ocultar a publicação encerra todas as denúncias dela e avisa o autor. Descartar encerra só esta denúncia.
      </p>
      {erro && <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">{erro}</p>}
      {q.isPending ? (
        <SkeletonCartao />
      ) : q.isError ? (
        <ErroSecao titulo="Não foi possível carregar as denúncias" descricao={q.error.message} onTentar={() => void q.refetch()} />
      ) : q.data.length === 0 ? (
        <EstadoVazio titulo="Nenhuma denúncia pendente" descricao="Tudo em dia." />
      ) : (
        <ul className="space-y-3">
          {q.data.map((d) => (
            <li key={d.id} className="surgir">
              <Card className="space-y-3">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <Badge variant="warning">{MOTIVOS_DENUNCIA[d.motivo]}</Badge>
                  <span className="text-muted-foreground">por {d.denunciante.nome} · {tempoRelativo(d.criadoEm)}</span>
                  {d.post.status !== "publicado" && <Badge variant="secondary">{d.post.status}</Badge>}
                </div>
                {d.detalhes && <p className="text-sm">“{d.detalhes}”</p>}
                <ConteudoPost autor={d.post.autor} criadoEm={d.post.criadoEm} texto={d.post.texto} imagens={d.post.imagens} />
                <div className="flex flex-wrap justify-end gap-2">
                  <Button variant="ghost" onClick={() => void descartar(d.id)}>Descartar denúncia</Button>
                  <Button variant="destructive" onClick={() => setOcultando(d.id)} disabled={d.post.status !== "publicado"}>Ocultar publicação</Button>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
      <ModalTexto
        aberto={!!ocultando}
        titulo="Ocultar publicação"
        rotulo="Motivo (o autor recebe este texto)"
        descricao="A publicação deixa de aparecer para todos. As outras denúncias dela são encerradas."
        confirmar="Ocultar"
        destrutivo
        maximo={300}
        onFechar={() => setOcultando(null)}
        onConfirmar={async (motivo) => {
          await resolverDenuncia(ocultando!, "ocultar", motivo);
          await atualizar();
        }}
      />
    </div>
  );
}

const FILTROS: Record<FiltroAuditoria, string> = { todos: "Todas", publicado: "Publicadas", oculto: "Ocultadas", removido: "Removidas pelo autor" };
const SITUACAO: Record<PostAuditoriaDTO["status"], { rotulo: string; variante: "success" | "destructive" | "secondary" }> = {
  publicado: { rotulo: "Publicada", variante: "success" },
  oculto: { rotulo: "Ocultada", variante: "destructive" },
  removido: { rotulo: "Removida pelo autor", variante: "secondary" },
};

/** Últimas publicações de toda a comunidade, do mais novo para o mais antigo. */
function Auditoria() {
  const qc = useQueryClient();
  const { confirmar } = useConfirmacao();
  const [filtro, setFiltro] = useState<FiltroAuditoria>("todos");
  const [ocultando, setOcultando] = useState<string | null>(null);
  const [erro, setErro] = useState("");
  const q = useInfiniteQuery({
    queryKey: [...CHAVE_AUDITORIA, filtro],
    queryFn: ({ pageParam }) => lerPostsAuditoria(filtro, pageParam),
    initialPageParam: {} as { antes?: string | undefined; antesId?: string | undefined },
    getNextPageParam: (ultima) => ultima.proximo,
  });
  const atualizar = () => Promise.all([qc.invalidateQueries({ queryKey: CHAVE_AUDITORIA }), qc.invalidateQueries({ queryKey: CHAVE_DENUNCIAS })]);

  const restaurar = async (id: string) => {
    if (!(await confirmar({ titulo: "Restaurar publicação?", descricao: "Ela volta a aparecer para quem pode ver o autor.", confirmar: "Restaurar" }))) return;
    setErro("");
    try {
      await moderarPost(id, "restaurar");
      await atualizar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível restaurar.");
    }
  };

  const posts = q.data?.pages.flatMap((p) => p.posts) ?? [];
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <p className="max-w-prose text-sm text-muted-foreground">
          Todas as publicações e respostas, inclusive de perfis e fóruns privados. Só a administração vê esta lista.
        </p>
        <div className="w-56">
          <Label htmlFor="filtro-auditoria" className="mb-1 block text-xs">Situação</Label>
          <NativeSelect id="filtro-auditoria" value={filtro} onChange={(e) => setFiltro(e.target.value as FiltroAuditoria)}>
            {Object.entries(FILTROS).map(([v, r]) => <option key={v} value={v}>{r}</option>)}
          </NativeSelect>
        </div>
      </div>
      {erro && <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">{erro}</p>}
      {q.isPending ? (
        <div className="space-y-3"><SkeletonCartao /><SkeletonCartao /></div>
      ) : q.isError ? (
        <ErroSecao titulo="Não foi possível carregar as publicações" descricao={q.error.message} onTentar={() => void q.refetch()} />
      ) : posts.length === 0 ? (
        <EstadoVazio titulo="Nenhuma publicação" descricao={filtro === "todos" ? "A comunidade ainda não tem publicações." : "Nenhuma publicação nesta situação."} />
      ) : (
        <>
          <ul className="space-y-3">
            {posts.map((p) => (
              <li key={p.id} className="surgir">
                <Card className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <Badge variant={SITUACAO[p.status].variante}>{SITUACAO[p.status].rotulo}</Badge>
                    <Badge variant="outline">{p.forum ? `Fórum: ${p.forum.nome}` : "Feed geral"}</Badge>
                    {p.respostaA && <Badge variant="outline">Resposta</Badge>}
                    {p.denuncias.total > 0 && (
                      <Badge variant="warning">
                        {p.denuncias.total} {p.denuncias.total === 1 ? "denúncia" : "denúncias"}
                        {p.denuncias.pendentes > 0 && ` · ${p.denuncias.pendentes} pendente${p.denuncias.pendentes === 1 ? "" : "s"}`}
                      </Badge>
                    )}
                    {p.editadoEm && <span className="text-xs text-muted-foreground">(editada)</span>}
                  </div>
                  <ConteudoPost autor={p.autor} criadoEm={p.criadoEm} texto={p.texto} imagens={p.imagens} />
                  {p.status === "oculto" && p.motivoOculto && (
                    <p className="text-sm text-muted-foreground">Motivo da ocultação: {p.motivoOculto}</p>
                  )}
                  <div className="flex flex-wrap justify-end gap-2">
                    {p.status === "publicado" && <Button variant="destructive" onClick={() => setOcultando(p.id)}>Ocultar publicação</Button>}
                    {p.status === "oculto" && <Button variant="outline" onClick={() => void restaurar(p.id)}>Restaurar</Button>}
                  </div>
                </Card>
              </li>
            ))}
          </ul>
          {q.isFetchingNextPage && <div className="space-y-3"><SkeletonCartao /><SkeletonCartao /></div>}
          {q.hasNextPage && !q.isFetchingNextPage && (
            <div className="flex justify-center">
              <Button variant="outline" onClick={() => void q.fetchNextPage()}>Carregar mais</Button>
            </div>
          )}
        </>
      )}
      <ModalTexto
        aberto={!!ocultando}
        titulo="Ocultar publicação"
        rotulo="Motivo (o autor recebe este texto)"
        descricao="A publicação deixa de aparecer para todos. As denúncias pendentes dela são encerradas."
        confirmar="Ocultar"
        destrutivo
        maximo={300}
        onFechar={() => setOcultando(null)}
        onConfirmar={async (motivo) => {
          await moderarPost(ocultando!, "ocultar", motivo);
          await atualizar();
        }}
      />
    </div>
  );
}
