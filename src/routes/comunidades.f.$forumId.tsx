import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeft, Clock, LogIn, LogOut, Users } from "lucide-react";
import {
  arquivarForum,
  definirModerador,
  entrarNoForum,
  lerForum,
  lerMembrosDoForum,
  lerPostsDoForum,
  removerMembro,
  responderEntrada,
  sairDoForum,
} from "@/api/social.functions";
import { useAuth } from "@/contexts/AuthContext";
import { moderaForum, podeRemoverMembro, type ForumDTO, type MembroForumDTO } from "@/lib/comunidadeGeral";
import { tempoRelativo } from "@/lib/tempoRelativo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EstadoVazio, Modal, SkeletonCartao } from "@/components/ui";
import { AvatarAutor } from "@/components/social/CartaoPost";
import { Compositor } from "@/components/social/Compositor";
import { ListaPosts } from "@/components/social/ListaPosts";
import { FotoForum, ModalForum, SeloVisibilidade } from "@/components/social/Foruns";
import { LateralComunidade } from "@/components/social/LateralComunidade";

type Aba = "publicacoes" | "membros" | "pedidos" | "config";

export const Route = createFileRoute("/comunidades/f/$forumId")({
  validateSearch: (s: Record<string, unknown>): { aba?: Aba | undefined } => ({
    aba: s["aba"] === "membros" || s["aba"] === "pedidos" || s["aba"] === "config" ? s["aba"] : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Fórum — Comunidade MilSim Ops" },
      { name: "description", content: "Fórum da comunidade geral do MilSim Ops." },
    ],
  }),
  component: PaginaForum,
});

function PaginaForum() {
  const { forumId } = Route.useParams();
  const { aba: abaUrl } = Route.useSearch();
  const navigate = useNavigate();
  const { usuario } = useAuth();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["social", "forum", forumId, usuario?.id ?? "visitante"], queryFn: () => lerForum(forumId), retry: false });
  const atualizar = () => void qc.invalidateQueries({ queryKey: ["social"] });

  if (q.isPending) return <div className="mx-auto max-w-6xl px-4 py-8"><SkeletonCartao /></div>;
  if (q.isError || !q.data) {
    return (
      <div className="mx-auto max-w-xl space-y-3 px-4 py-16">
        <EstadoVazio titulo="Fórum indisponível" descricao="Ele pode ter sido arquivado ou o endereço está incorreto." />
        <Link to="/comunidades" search={{ aba: "foruns" }} className="inline-block text-sm text-accent hover:underline">Ver os fóruns →</Link>
      </div>
    );
  }
  const { forum, podeLer } = q.data;
  const modera = moderaForum(forum.meuPapel, forum.minhaSituacao);
  const dono = forum.meuPapel === "dono";
  const abas: { id: Aba; rotulo: string }[] = [
    { id: "publicacoes", rotulo: "Publicações" },
    { id: "membros", rotulo: `Membros (${forum.membros})` },
    ...(modera ? [{ id: "pedidos" as const, rotulo: `Pedidos${forum.pedidosPendentes ? ` (${forum.pedidosPendentes})` : ""}` }] : []),
    ...(dono ? [{ id: "config" as const, rotulo: "Configurações" }] : []),
  ];
  const aba: Aba = abaUrl && abas.some((a) => a.id === abaUrl) ? abaUrl : "publicacoes";
  const irPara = (a: Aba) => navigate({ to: "/comunidades/f/$forumId", params: { forumId }, search: { aba: a === "publicacoes" ? undefined : a }, replace: true, resetScroll: false });

  return (
    <div className="mx-auto max-w-6xl space-y-5 px-4 py-6">
      <Link to="/comunidades" search={{ aba: "foruns" }} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Fóruns
      </Link>
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-4">
        <FotoForum nome={forum.nome} fotoUrl={forum.fotoUrl} tamanho="h-16 w-16 sm:h-20 sm:w-20" texto="text-3xl" />
        <div className="min-w-0">
          <h1 className="flex flex-wrap items-center gap-2 font-display text-2xl font-semibold uppercase">{forum.nome} <SeloVisibilidade v={forum.visibilidade} /></h1>
          {forum.descricao && <p className="mt-1 max-w-2xl whitespace-pre-wrap text-sm text-muted-foreground">{forum.descricao}</p>}
          <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <Users className="h-3.5 w-3.5" aria-hidden="true" /> {forum.membros} {forum.membros === 1 ? "membro" : "membros"} · criado por{" "}
            <Link to="/operador/$usuarioId" params={{ usuarioId: forum.dono.id }} search={{ aba: undefined }} className="hover:underline">{forum.dono.nome}</Link>
          </p>
        </div>
        </div>
        <AcaoParticipacao forum={forum} onMudou={atualizar} />
      </header>

      <Tabs value={aba} onValueChange={(v) => irPara(v as Aba)}>
        <TabsList aria-label="Seções do fórum" className="abas-rolaveis flex w-full gap-1 border-b border-border">
          {abas.map((a) => (
            <TabsTrigger key={a.id} value={a.id}
                className={`-mb-px shrink-0 whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium focus-visible:outline-2 focus-visible:outline-ring ${aba === a.id ? "border-accent text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
                {a.rotulo}
              </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="min-w-0 space-y-4">
          {aba === "publicacoes" && (
            !podeLer ? (
              <EstadoVazio titulo="Fórum privado" descricao="Só membros aprovados veem as publicações. Peça para entrar." />
            ) : (
              <>
                <LateralComunidade compacta />
                {forum.minhaSituacao === "aprovado" && (
                  <Compositor forumId={forum.id} forumPublico={forum.visibilidade === "publico"} placeholder={`Publicar em ${forum.nome}`} onPublicado={atualizar} />
                )}
                <ListaPosts
                  chave={["social", "forum-posts", forumId, usuario?.id ?? "visitante"]}
                  carregar={(c) => lerPostsDoForum(forumId, c)}
                  moderar={modera}
                  vazio={{ titulo: "Nenhuma publicação neste fórum ainda", descricao: forum.minhaSituacao === "aprovado" ? "Comece a conversa." : undefined }}
                />
              </>
            )
          )}
          {aba === "membros" && (podeLer ? <ListaMembros forum={forum} situacao="aprovado" /> : <EstadoVazio titulo="Fórum privado" descricao="Só membros aprovados veem quem participa." />)}
          {aba === "pedidos" && modera && <ListaMembros forum={forum} situacao="pendente" />}
          {aba === "config" && dono && <ConfigForum forum={forum} />}
        </div>
        <aside className="hidden lg:block" aria-label="Destaques"><LateralComunidade /></aside>
      </div>
    </div>
  );
}

function AcaoParticipacao({ forum, onMudou }: { forum: ForumDTO; onMudou: () => void }) {
  const { usuario } = useAuth();
  const navigate = useNavigate();
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState("");
  if (forum.meuPapel === "dono") return <Badge variant="warning">Você é o dono</Badge>;

  const agir = async (fn: () => Promise<unknown>) => {
    if (!usuario) return navigate({ to: "/login", search: { redirect: `/comunidades/f/${forum.id}` } });
    setOcupado(true);
    setErro("");
    try {
      await fn();
      onMudou();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível concluir.");
    } finally {
      setOcupado(false);
    }
  };

  return (
    <div className="flex flex-col items-end gap-1">
      {forum.minhaSituacao === "aprovado" ? (
        <Button variant="outline" disabled={ocupado} onClick={() => agir(() => sairDoForum(forum.id))}><LogOut className="h-4 w-4" /> Sair do fórum</Button>
      ) : forum.minhaSituacao === "pendente" ? (
        <Button variant="outline" disabled={ocupado} onClick={() => agir(() => sairDoForum(forum.id))} title="Cancelar pedido"><Clock className="h-4 w-4" /> Pedido enviado</Button>
      ) : (
        <Button disabled={ocupado} onClick={() => agir(() => entrarNoForum(forum.id))}>
          <LogIn className="h-4 w-4" /> {forum.visibilidade === "privado" ? "Pedir para entrar" : "Entrar no fórum"}
        </Button>
      )}
      {erro && <p role="alert" className="text-xs text-destructive">{erro}</p>}
    </div>
  );
}

const ROTULO_PAPEL: Record<MembroForumDTO["papel"], string> = { dono: "Dono", moderador: "Moderador", membro: "Membro" };

function ListaMembros({ forum, situacao }: { forum: ForumDTO; situacao: "aprovado" | "pendente" }) {
  const { usuario } = useAuth();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["social", "membros", forum.id, situacao], queryFn: () => lerMembrosDoForum(forum.id, situacao) });
  const [erro, setErro] = useState("");
  const dono = forum.meuPapel === "dono";
  const modera = moderaForum(forum.meuPapel, forum.minhaSituacao);

  const agir = async (fn: () => Promise<unknown>) => {
    setErro("");
    try {
      await fn();
      await qc.invalidateQueries({ queryKey: ["social"] });
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível concluir.");
    }
  };

  if (q.isPending) return <SkeletonCartao />;
  if (q.isError) return <p role="alert" className="text-sm text-destructive">{q.error.message}</p>;
  if (!q.data.length) {
    return <EstadoVazio titulo={situacao === "pendente" ? "Nenhum pedido pendente" : "Nenhum membro"} />;
  }
  return (
    <Card>
      {erro && <p role="alert" className="mb-2 text-sm text-destructive">{erro}</p>}
      <ul className="divide-y divide-border">
        {q.data.map((m) => (
          <li key={m.id} className="flex flex-wrap items-center gap-3 py-2.5">
            <AvatarAutor nome={m.nome} fotoUrl={m.fotoUrl} tamanho="h-9 w-9" />
            <span className="min-w-0 flex-1">
              <Link to="/operador/$usuarioId" params={{ usuarioId: m.id }} search={{ aba: undefined }} className="block truncate text-sm font-medium hover:underline">{m.nome}</Link>
              <span className="block text-xs text-muted-foreground">
                {situacao === "pendente" ? `pediu ${tempoRelativo(m.desde)}` : `${ROTULO_PAPEL[m.papel]} · desde ${tempoRelativo(m.desde)}`}
              </span>
            </span>
            {situacao === "pendente" ? (
              <>
                <Button className="h-8 px-3 text-xs" onClick={() => void agir(() => responderEntrada(forum.id, m.id, true))}>Aprovar</Button>
                <Button variant="ghost" className="h-8 px-2 text-xs" onClick={() => void agir(() => responderEntrada(forum.id, m.id, false))}>Recusar</Button>
              </>
            ) : (
              <>
                {m.papel !== "membro" && <Badge variant="warning">{ROTULO_PAPEL[m.papel]}</Badge>}
                {dono && m.papel !== "dono" && (
                  <Button variant="outline" className="h-8 px-2 text-xs" onClick={() => void agir(() => definirModerador(forum.id, m.id, m.papel !== "moderador"))}>
                    {m.papel === "moderador" ? "Tirar moderação" : "Tornar moderador"}
                  </Button>
                )}
                {modera && m.id !== usuario?.id && podeRemoverMembro(forum.meuPapel, m.papel) && (
                  <Button variant="ghost" className="h-8 px-2 text-xs text-destructive" onClick={() => void agir(() => removerMembro(forum.id, m.id))}>Remover</Button>
                )}
              </>
            )}
          </li>
        ))}
      </ul>
    </Card>
  );
}

function ConfigForum({ forum }: { forum: ForumDTO }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [editando, setEditando] = useState(false);
  const [arquivando, setArquivando] = useState(false);
  const [erro, setErro] = useState("");
  return (
    <Card className="space-y-4">
      <div>
        <h2 className="font-medium">Dados do fórum</h2>
        <p className="mt-1 text-sm text-muted-foreground">Nome, descrição e quem pode ler.</p>
        <Button variant="outline" className="mt-2" onClick={() => setEditando(true)}>Editar fórum</Button>
      </div>
      <div className="border-t border-border pt-4">
        <h2 className="font-medium text-destructive">Arquivar fórum</h2>
        <p className="mt-1 text-sm text-muted-foreground">O fórum some da lista e ninguém mais lê ou publica. Libera uma das suas vagas de fórum.</p>
        <Button variant="destructive" className="mt-2" onClick={() => setArquivando(true)}>Arquivar</Button>
      </div>
      {erro && <p role="alert" className="text-sm text-destructive">{erro}</p>}
      {editando && (
        <ModalForum aberto forum={forum} onFechar={() => setEditando(false)} onSalvo={() => {
          setEditando(false);
          void qc.invalidateQueries({ queryKey: ["social"] });
        }} />
      )}
      <Modal aberto={arquivando} titulo="Arquivar fórum" onFechar={() => setArquivando(false)}>
        <p className="text-sm text-muted-foreground">“{forum.nome}” deixa de aparecer e as publicações deixam de ser lidas. Não dá para desfazer pelo site.</p>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setArquivando(false)}>Cancelar</Button>
          <Button variant="destructive" onClick={async () => {
            try {
              await arquivarForum(forum.id);
              await qc.invalidateQueries({ queryKey: ["social"] });
              void navigate({ to: "/comunidades", search: { aba: "foruns" } });
            } catch (e) {
              setErro(e instanceof Error ? e.message : "Não foi possível arquivar.");
              setArquivando(false);
            }
          }}>Arquivar</Button>
        </div>
      </Modal>
    </Card>
  );
}
