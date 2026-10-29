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
import { tr } from "@/i18n/routes/admin.comunidade";

// Moderação da comunidade geral: denúncias pendentes (das mais antigas para as mais novas)
// e auditoria das últimas publicações de toda a comunidade (inclusive privadas, ocultas e
// removidas). Sem IA por enquanto: fotos e textos fora da lista de termos dependem disto.
export const Route = createFileRoute("/admin/comunidade")({
  head: () => ({
    meta: [
      { title: tr("comunidade_admin_milsim_ops") },
      { name: "description", content: tr("moderacao_da_comunidade_geral_denuncias") },
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
        <h2 className="titulo-pagina">{tr("comunidade_moderacao")}</h2>
        <p className="mt-1 max-w-prose text-sm text-muted-foreground">{tr("denuncias_para_resolver_e_as_ultimas")}</p>
      </div>
      <Tabs value={aba} onValueChange={(v) => setAba(v as typeof aba)}>
        <TabsList className="flex-wrap gap-2">
          <TabsTrigger value="denuncias" asChild>
            <Button variant={aba === "denuncias" ? "default" : "outline"}>{tr("denuncias")}{pendentes > 0 && <Badge variant="warning" className="ml-1">{pendentes}</Badge>}
            </Button>
          </TabsTrigger>
          <TabsTrigger value="publicacoes" asChild>
            <Button variant={aba === "publicacoes" ? "default" : "outline"}>{tr("ultimas_publicacoes")}</Button>
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
            <a key={i.url} href={i.url} target="_blank" rel="noopener noreferrer"><img src={i.url} alt={i.alt || tr("foto_da_publicacao")} className="aspect-square w-full rounded object-cover" /></a>
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
      setErro(e instanceof Error ? e.message : tr("nao_foi_possivel_descartar"));
    }
  };

  return (
    <div className="space-y-3">
      <p className="max-w-prose text-sm text-muted-foreground">{tr("ocultar_a_publicacao_encerra_todas_as")}</p>
      {erro && <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">{erro}</p>}
      {q.isPending ? (
        <SkeletonCartao />
      ) : q.isError ? (
        <ErroSecao titulo={tr("nao_foi_possivel_carregar_as_denuncias")} descricao={q.error.message} onTentar={() => void q.refetch()} />
      ) : q.data.length === 0 ? (
        <EstadoVazio titulo={tr("nenhuma_denuncia_pendente")} descricao={tr("tudo_em_dia")} />
      ) : (
        <ul className="space-y-3">
          {q.data.map((d) => (
            <li key={d.id} className="surgir">
              <Card className="space-y-3">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <Badge variant="warning">{MOTIVOS_DENUNCIA[d.motivo]}</Badge>
                  <span className="text-muted-foreground">{tr("por_nome_criadoem", { nome: d.denunciante.nome, criadoEm: tempoRelativo(d.criadoEm) })}</span>
                  {d.post.status !== "publicado" && <Badge variant="secondary">{d.post.status}</Badge>}
                </div>
                {d.detalhes && <p className="text-sm whitespace-pre-line [overflow-wrap:anywhere]">“{d.detalhes.trim()}”</p>}
                <ConteudoPost autor={d.post.autor} criadoEm={d.post.criadoEm} texto={d.post.texto} imagens={d.post.imagens} />
                <div className="flex flex-wrap justify-end gap-2">
                  <Button variant="ghost" onClick={() => void descartar(d.id)}>{tr("descartar_denuncia")}</Button>
                  <Button variant="destructive" onClick={() => setOcultando(d.id)} disabled={d.post.status !== "publicado"}>{tr("ocultar_publicacao")}</Button>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
      <ModalTexto
        aberto={!!ocultando}
        titulo={tr("ocultar_publicacao")}
        rotulo={tr("motivo_o_autor_recebe_este_texto")}
        descricao={tr("a_publicacao_deixa_de_aparecer_para")}
        confirmar={tr("ocultar")}
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

const FILTROS: Record<FiltroAuditoria, string> = { get todos() { return tr("todas"); }, get publicado() { return tr("publicadas"); }, get oculto() { return tr("ocultadas"); }, get removido() { return tr("removidas_pelo_autor"); } };
const SITUACAO: Record<PostAuditoriaDTO["status"], { rotulo: string; variante: "success" | "destructive" | "secondary" }> = {
  publicado: { get rotulo() { return tr("publicada"); }, variante: "success" },
  oculto: { get rotulo() { return tr("ocultada"); }, variante: "destructive" },
  removido: { get rotulo() { return tr("removida_pelo_autor"); }, variante: "secondary" },
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
    if (!(await confirmar({ titulo: tr("restaurar_publicacao"), descricao: tr("ela_volta_a_aparecer_para_quem"), confirmar: tr("restaurar") }))) return;
    setErro("");
    try {
      await moderarPost(id, "restaurar");
      await atualizar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : tr("nao_foi_possivel_restaurar"));
    }
  };

  const posts = q.data?.pages.flatMap((p) => p.posts) ?? [];
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <p className="max-w-prose text-sm text-muted-foreground">{tr("todas_as_publicacoes_e_respostas_inclusi")}</p>
        <div className="w-56">
          <Label htmlFor="filtro-auditoria" className="mb-1 block text-xs">{tr("situacao")}</Label>
          <NativeSelect id="filtro-auditoria" value={filtro} onChange={(e) => setFiltro(e.target.value as FiltroAuditoria)}>
            {Object.entries(FILTROS).map(([v, r]) => <option key={v} value={v}>{r}</option>)}
          </NativeSelect>
        </div>
      </div>
      {erro && <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">{erro}</p>}
      {q.isPending ? (
        <div className="space-y-3"><SkeletonCartao /><SkeletonCartao /></div>
      ) : q.isError ? (
        <ErroSecao titulo={tr("nao_foi_possivel_carregar_as_publicacoes")} descricao={q.error.message} onTentar={() => void q.refetch()} />
      ) : posts.length === 0 ? (
        <EstadoVazio titulo={tr("nenhuma_publicacao")} descricao={filtro === "todos" ? tr("a_comunidade_ainda_nao_tem_publicacoes") : tr("nenhuma_publicacao_nesta_situacao")} />
      ) : (
        <>
          <ul className="space-y-3">
            {posts.map((p) => (
              <li key={p.id} className="surgir">
                <Card className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <Badge variant={SITUACAO[p.status].variante}>{SITUACAO[p.status].rotulo}</Badge>
                    <Badge variant="outline">{p.forum ? tr("forum_nome", { nome: p.forum.nome }) : tr("feed_geral")}</Badge>
                    {p.respostaA && <Badge variant="outline">{tr("resposta")}</Badge>}
                    {p.denuncias.total > 0 && (
                      <Badge variant="warning">
                        {tr.plural(p.denuncias.total, "n_denuncia", "n_denuncias")}
                        {p.denuncias.pendentes > 0 && ` · ${tr.plural(p.denuncias.pendentes, "n_pendente", "n_pendentes")}`}
                      </Badge>
                    )}
                    {p.editadoEm && <span className="text-xs text-muted-foreground">{tr("editada")}</span>}
                  </div>
                  <ConteudoPost autor={p.autor} criadoEm={p.criadoEm} texto={p.texto} imagens={p.imagens} />
                  {p.status === "oculto" && p.motivoOculto && (
                    <p className="text-sm text-muted-foreground">{tr("motivo_da_ocultacao_motivooculto", { motivoOculto: p.motivoOculto })}</p>
                  )}
                  <div className="flex flex-wrap justify-end gap-2">
                    {p.status === "publicado" && <Button variant="destructive" onClick={() => setOcultando(p.id)}>{tr("ocultar_publicacao")}</Button>}
                    {p.status === "oculto" && <Button variant="outline" onClick={() => void restaurar(p.id)}>{tr("restaurar")}</Button>}
                  </div>
                </Card>
              </li>
            ))}
          </ul>
          {q.isFetchingNextPage && <div className="space-y-3"><SkeletonCartao /><SkeletonCartao /></div>}
          {q.hasNextPage && !q.isFetchingNextPage && (
            <div className="flex justify-center">
              <Button variant="outline" onClick={() => void q.fetchNextPage()}>{tr("carregar_mais")}</Button>
            </div>
          )}
        </>
      )}
      <ModalTexto
        aberto={!!ocultando}
        titulo={tr("ocultar_publicacao")}
        rotulo={tr("motivo_o_autor_recebe_este_texto")}
        descricao={tr("a_publicacao_deixa_de_aparecer_para_2")}
        confirmar={tr("ocultar")}
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
