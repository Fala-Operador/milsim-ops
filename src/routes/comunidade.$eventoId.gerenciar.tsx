import { IconeForum, OPCOES_ICONE_FORUM } from "@/components/IconeForum";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useComunidade } from "@/hooks/useComunidade";
import {
  MOTIVOS_DENUNCIA,
  listarDenuncias,
  membrosParaModeracao,
  nomeExibicao,
  type DadosForum,
} from "@/services/comunidade";
import {
  alternarArquivoForum,
  analisarDenuncia,
  criarForum,
  editarForum,
  excluirForum,
  moverOrdemForum,
  ocultarConteudo,
  reativarUsuario,
  suspenderUsuario,
} from "@/api/comunidade.functions";
import { ModalJustificativa, SemAcesso } from "@/components/comunidade";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { Campo, Modal, SkeletonPagina } from "@/components/ui";
import { useConfirmacao } from "@/contexts/ConfirmacaoContext";
import { formatarDataHoraBR } from "@/lib/domain/money";
import type { Forum } from "@/lib/domain/types";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/comunidade/$eventoId/gerenciar")({
  head: () => ({
    meta: [
      { title: "Gerenciar comunidade — MilSim Ops" },
      { name: "description", content: "Gestão de fóruns, denúncias e moderação da comunidade do evento." },
      { property: "og:title", content: "Gerenciar comunidade — MilSim Ops" },
      { property: "og:description", content: "Gestão de fóruns e moderação." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Gerenciar,
});

const vazio: DadosForum = { nome: "", descricao: "", icone: "", regras: "", publico: "todos", publicacao: "membros", respostas: "membros" };

function Gerenciar() {
  const { eventoId } = Route.useParams();
  const { montado, usuario, base, gestao, atualizar } = useComunidade(eventoId, `/comunidade/${eventoId}/gerenciar`);
  const [aba, setAba] = useState<"foruns" | "denuncias" | "membros">("foruns");
  const [editando, setEditando] = useState<Forum | "novo" | null>(null);
  const [suspender, setSuspender] = useState<string | null>(null);
  const [ocultarAlvo, setOcultarAlvo] = useState<{ alvo: "publicacao" | "resposta"; id: string } | null>(null);
  const { confirmar } = useConfirmacao();
  const [erro, setErro] = useState("");

  if (!montado || !usuario) return <SkeletonPagina />;
  if (!gestao) return <SemAcesso eventoId={eventoId} />;
  const evento = base.eventos.find((e) => e.id === eventoId)!;
  const foruns = base.foruns.filter((f) => f.eventoId === eventoId).sort((a, b) => a.ordem - b.ordem);
  const run = async (fn: () => Promise<unknown>) => { try { await fn(); setErro(""); atualizar(); } catch (e) { setErro(e instanceof Error ? e.message : "Erro"); } };
  const denuncias = listarDenuncias(usuario, eventoId);
  const membros = membrosParaModeracao(usuario, eventoId);
  const publicoNome = (p: string) => (p === "todos" ? "Todos os confirmados" : `Restrito: ${evento.exercitos.find((e) => e.id === p)?.nome ?? "?"}`);

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <nav aria-label="Breadcrumb" className="text-xs text-muted-foreground">
        <Link to="/comunidade/$eventoId" params={{ eventoId }} search={{}} className="hover:underline">Comunidade</Link> / Gerenciar
      </nav>
      <h1 className="mt-2 font-display text-2xl font-semibold uppercase">Gerenciar comunidade — {evento.nome}</h1>

      <Tabs value={aba} onValueChange={(v) => setAba(v as typeof aba)}>
      <TabsList className="mt-4 flex-wrap gap-2">
        {([["foruns", "Fóruns"], ["denuncias", `Denúncias (${denuncias.filter((d) => d.status === "pendente").length})`], ["membros", "Participação"]] as const).map(([k, r]) => (
          <TabsTrigger key={k} value={k} asChild><Button variant={aba === k ? "default" : "outline"}>{r}</Button></TabsTrigger>
        ))}
      </TabsList>
      </Tabs>
      {erro && <p role="alert" className="mt-3 text-sm text-destructive">{erro}</p>}

      {aba === "foruns" && (
        <div className="mt-4 space-y-3">
          <Button onClick={() => setEditando("novo")}>+ Novo fórum</Button>
          {foruns.map((f, i) => {
            const qtd = base.publicacoes.filter((p) => p.forumId === f.id).length;
            return (
              <Card key={f.id}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="flex items-center gap-2 font-semibold"><IconeForum forum={f} />{f.nome} {f.status === "arquivado" && <Badge>Arquivado</Badge>}</p>
                    <p className="text-sm text-muted-foreground">{f.descricao}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {publicoNome(f.publico)} · Publicação: {f.publicacao === "gestao" ? "só organização" : "membros"} · Respostas: {f.respostas === "gestao" ? "só organização" : "membros"} · {qtd} publicação(ões)
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    <Button variant="ghost" aria-label="Subir" disabled={i === 0} onClick={() => run(() => moverOrdemForum(f.id, -1))}>↑</Button>
                    <Button variant="ghost" aria-label="Descer" disabled={i === foruns.length - 1} onClick={() => run(() => moverOrdemForum(f.id, 1))}>↓</Button>
                    <Button variant="outline" onClick={() => setEditando(f)}>Editar</Button>
                    <Button variant="outline" onClick={() => run(() => alternarArquivoForum(f.id))}>{f.status === "ativo" ? "Arquivar" : "Reativar"}</Button>
                    {qtd === 0 && (
                      <Button variant="destructive" onClick={async () => (await confirmar({ titulo: "Excluir fórum?", descricao: `O fórum "${f.nome}" será excluído.`, confirmar: "Excluir", destrutivo: true })) && run(() => excluirForum(f.id))}>Excluir</Button>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {aba === "denuncias" && (
        <div className="mt-4 space-y-3">
          {denuncias.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma denúncia.</p>}
          {denuncias.map((d) => {
            const pub = d.alvo === "publicacao" ? base.publicacoes.find((p) => p.id === d.alvoId) : undefined;
            const res = d.alvo === "resposta" ? base.respostas.find((r) => r.id === d.alvoId) : undefined;
            const item = pub ?? res;
            const postId = pub?.id ?? res?.publicacaoId;
            return (
              <Card key={d.id}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm">
                      <Badge variant={d.status === "pendente" ? "warning" : d.status === "procedente" ? "destructive" : "secondary"}>{d.status}</Badge>{" "}
                      <strong>{MOTIVOS_DENUNCIA[d.motivo]}</strong> · {d.alvo} · {formatarDataHoraBR(d.criadoEm)}
                    </p>
                    {d.descricao && <p className="mt-1 text-sm text-muted-foreground">“{d.descricao}”</p>}
                    <p className="mt-1 text-xs text-muted-foreground">Denunciante: {nomeExibicao(base.usuarios.find((u) => u.id === d.denuncianteId))} (visível só para gestão)</p>
                    {item ? (
                      <blockquote className="mt-2 border-l-2 border-border pl-3 text-sm">
                        <span className="font-medium">{nomeExibicao(base.usuarios.find((u) => u.id === item.autorId))}:</span> {item.texto || "(sem texto)"}
                        {item.oculta && <Badge variant="destructive">Oculto</Badge>}
                      </blockquote>
                    ) : <p className="mt-2 text-xs text-muted-foreground">Conteúdo já removido.</p>}
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {postId && <Link to="/comunidade/$eventoId/p/$postId" params={{ eventoId, postId }}><Button variant="ghost">Abrir</Button></Link>}
                    {item && !item.oculta && <Button variant="outline" onClick={() => setOcultarAlvo({ alvo: d.alvo, id: d.alvoId })}>Ocultar</Button>}
                    {d.status === "pendente" && (
                      <>
                        <Button variant="destructive" onClick={() => run(() => analisarDenuncia(d.id, "procedente"))}>Procedente</Button>
                        <Button variant="outline" onClick={() => run(() => analisarDenuncia(d.id, "descartada"))}>Descartar</Button>
                      </>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {aba === "membros" && (
        <Card className="mt-4">
          <p className="text-sm text-muted-foreground">A suspensão bloqueia publicações, respostas e curtidas, mas mantém a leitura. Não cancela a inscrição.</p>
          <ul className="mt-3 divide-y divide-border">
            {membros.map((m) => (
              <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                <span>{m.nome} <span className="text-muted-foreground">({m.exibicao})</span> {m.suspenso && <Badge variant="destructive">Suspenso</Badge>}</span>
                {m.suspenso
                  ? <Button variant="outline" onClick={() => run(() => reativarUsuario(eventoId, m.id))}>Reativar</Button>
                  : <Button variant="destructive" onClick={() => setSuspender(m.id)}>Suspender</Button>}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {editando && (
        <ModalForum
          inicial={editando === "novo" ? vazio : { ...editando }}
          titulo={editando === "novo" ? "Novo fórum" : "Editar fórum"}
          exercitos={evento.exercitos}
          onFechar={() => setEditando(null)}
          onSalvar={async (d) => {
            if (editando === "novo") await criarForum(eventoId, d);
            else await editarForum(editando.id, d);
            atualizar();
          }}
        />
      )}
      {suspender && <ModalJustificativa titulo="Suspender participação" onFechar={() => setSuspender(null)} onConfirmar={async (j) => { await suspenderUsuario(eventoId, suspender, j); atualizar(); }} />}
      {ocultarAlvo && <ModalJustificativa titulo="Ocultar conteúdo" onFechar={() => setOcultarAlvo(null)} onConfirmar={async (j) => { await ocultarConteudo(ocultarAlvo.alvo, ocultarAlvo.id, j); atualizar(); }} />}
    </div>
  );
}

function ModalForum({ inicial, titulo, exercitos, onFechar, onSalvar }: { inicial: DadosForum; titulo: string; exercitos: { id: string; nome: string }[]; onFechar: () => void; onSalvar: (d: DadosForum) => Promise<unknown> }) {
  const [d, setD] = useState<DadosForum>(inicial);
  const [erro, setErro] = useState("");
  const set = (k: keyof DadosForum, v: string) => setD((x) => ({ ...x, [k]: v }));
  return (
    <Modal aberto titulo={titulo} onFechar={onFechar}>
      <div className="max-h-[70vh] space-y-3 overflow-y-auto pr-1">
        <Campo rotulo="Nome" htmlFor="f-nome"><Input id="f-nome" value={d.nome} onChange={(e) => set("nome", e.target.value)} /></Campo>
        <Campo rotulo="Descrição" htmlFor="f-desc"><Textarea id="f-desc" rows={2} value={d.descricao} onChange={(e) => set("descricao", e.target.value)} /></Campo>
        <Campo rotulo="Ícone" htmlFor="f-ico">
          <div className="flex items-center gap-2">
            <IconeForum forum={{ icone: d.icone, nome: d.nome }} ativo />
            <NativeSelect id="f-ico" value={OPCOES_ICONE_FORUM.some((o) => o.valor === (d.icone ?? "")) ? (d.icone ?? "") : ""} onChange={(e) => set("icone", e.target.value)}>
              {OPCOES_ICONE_FORUM.map((o) => <option key={o.rotulo} value={o.valor}>{o.rotulo}</option>)}
            </NativeSelect>
          </div>
        </Campo>
        <Campo rotulo="Regras específicas (opcional)" htmlFor="f-reg"><Textarea id="f-reg" rows={2} value={d.regras ?? ""} onChange={(e) => set("regras", e.target.value)} /></Campo>
        <Campo rotulo="Público autorizado" htmlFor="f-pub">
          <NativeSelect id="f-pub" value={d.publico} onChange={(e) => set("publico", e.target.value)}>
            <option value="todos">Todos os participantes confirmados</option>
            {exercitos.map((x) => <option key={x.id} value={x.id}>Somente: {x.nome}</option>)}
          </NativeSelect>
        </Campo>
        {d.publico !== "todos" && (
          <p className="rounded-md border border-warning p-2 text-xs">
            Atenção: use nome, descrição e conteúdos neutros (ex.: “Preparação operacional”). Não revele a segmentação nem o nome do exército.
          </p>
        )}
        <Campo rotulo="Quem pode publicar" htmlFor="f-pc">
          <NativeSelect id="f-pc" value={d.publicacao} onChange={(e) => set("publicacao", e.target.value)}>
            <option value="membros">Todos os membros autorizados</option>
            <option value="gestao">Somente organização e administração</option>
          </NativeSelect>
        </Campo>
        <Campo rotulo="Quem pode responder" htmlFor="f-rp">
          <NativeSelect id="f-rp" value={d.respostas} onChange={(e) => set("respostas", e.target.value)}>
            <option value="membros">Todos os membros autorizados</option>
            <option value="gestao">Somente organização e administração</option>
          </NativeSelect>
        </Campo>
        {erro && <p role="alert" className="text-sm text-destructive">{erro}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onFechar}>Cancelar</Button>
          <Button onClick={async () => { try { await onSalvar(d); onFechar(); } catch (e) { setErro(e instanceof Error ? e.message : "Erro"); } }}>Salvar</Button>
        </div>
      </div>
    </Modal>
  );
}
