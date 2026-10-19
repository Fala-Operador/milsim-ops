// Componentes de interface da comunidade (feed social). Regras ficam no serviço.
import { Link } from "@tanstack/react-router";
import { useRef, useState } from "react";
import type { BaseDados, Forum, ImagemPost, MotivoDenuncia, Publicacao, Resposta, Usuario } from "@/lib/domain/types";
import {
  LIMITE_IMAGENS,
  LIMITE_TEXTO,
  MOTIVOS_DENUNCIA,
  contarCurtidas,
  contarRespostas,
  curtiu,
  nomeExibicao,
  podeCurtir,
  seloAutor,
} from "@/services/comunidade";
import {
  alternarCurtida,
  alternarRespostas,
  criarPublicacao,
  denunciar,
  editarPublicacao,
  editarResposta,
  excluirPublicacao,
  excluirResposta,
  fixarPublicacao,
  moverPublicacao,
  ocultarConteudo,
} from "@/api/comunidade.functions";
import { arquivoParaDataUrl } from "@/lib/imagens";
import { formatarDataHoraBR } from "@/lib/domain/money";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { Campo, Modal } from "@/components/ui";
import { Checkbox } from "@/components/ui/checkbox";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";

function msg(e: unknown) {
  return e instanceof Error ? e.message : "Algo deu errado. Tente novamente.";
}

export function SemAcesso({ eventoId }: { eventoId: string }) {
  return (
    <div className="mx-auto max-w-xl px-4 py-16 text-center">
      <h1 className="font-display text-2xl font-semibold">Conteúdo indisponível</h1>
      <p className="mt-2 text-muted-foreground">
        Este conteúdo não existe ou você não tem acesso a ele. A comunidade é exclusiva para participantes com inscrição
        confirmada, organização e administração.
      </p>
      <Link to="/eventos/$eventoId" params={{ eventoId }} className="mt-4 inline-block text-accent hover:underline">
        Ver página pública do evento →
      </Link>
    </div>
  );
}

export function Avatar({ usuario }: { usuario: Usuario | undefined }) {
  const nome = nomeExibicao(usuario);
  if (usuario?.fotoUrl) return <img src={usuario.fotoUrl} alt="" className="h-10 w-10 shrink-0 rounded-full object-cover" />;
  return (
    <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-secondary font-display text-sm font-semibold text-secondary-foreground">
      {nome.slice(0, 1).toUpperCase()}
    </span>
  );
}

// ---------- Seletor de imagens ----------
function SeletorImagens({ imagens, setImagens, max, onErro }: { imagens: ImagemPost[]; setImagens: (i: ImagemPost[]) => void; max: number; onErro: (m: string) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  const adicionar = async (files: FileList | null) => {
    if (!files) return;
    const novas: ImagemPost[] = [];
    for (const f of Array.from(files)) {
      if (imagens.length + novas.length >= max) {
        onErro(`Máximo de ${max} imagem(ns).`);
        break;
      }
      try {
        novas.push({ url: await arquivoParaDataUrl(f) });
      } catch (e) {
        onErro(msg(e));
      }
    }
    setImagens([...imagens, ...novas]);
    if (ref.current) ref.current.value = "";
  };
  return (
    <div className="space-y-2">
      {imagens.length > 0 && (
        <div className="grid grid-cols-2 gap-2">
          {imagens.map((img, i) => (
            <div key={i} className="space-y-1">
              <div className="relative">
                <img src={img.url} alt={img.alt ?? "Prévia da imagem"} className="h-28 w-full rounded-md object-cover" />
                <Button variant="plain" size="none"
                  type="button"
                  onClick={() => setImagens(imagens.filter((_, j) => j !== i))}
                  className="absolute right-1 top-1 rounded-full bg-background/90 px-2 text-sm text-foreground"
                  aria-label={`Remover imagem ${i + 1}`}
                >
                  ✕
                </Button>
              </div>
              <Input
                placeholder="Descrição alternativa (opcional)"
                aria-label={`Descrição alternativa da imagem ${i + 1}`}
                value={img.alt ?? ""}
                onChange={(e) => setImagens(imagens.map((x, j) => (j === i ? { ...x, alt: e.target.value } : x)))}
              />
            </div>
          ))}
        </div>
      )}
      <input ref={ref} type="file" accept="image/*" multiple={max > 1} className="hidden" onChange={(e) => adicionar(e.target.files)} />
      {imagens.length < max && (
        <Button type="button" variant="ghost" onClick={() => ref.current?.click()}>
          🖼 Adicionar imagem
        </Button>
      )}
    </div>
  );
}

// ---------- Compositor ----------
export function Compositor({
  usuario,
  forunsPermitidos,
  forumFixo,
  gestao,
  onPublicado,
}: {
  usuario: Usuario;
  forunsPermitidos: Forum[];
  forumFixo?: Forum | undefined;
  gestao: boolean;
  onPublicado: () => void;
}) {
  const [texto, setTexto] = useState("");
  const [imagens, setImagens] = useState<ImagemPost[]>([]);
  const [forumId, setForumId] = useState(forumFixo?.id ?? "");
  const [importante, setImportante] = useState(false);
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);
  const destino = forumFixo ?? forunsPermitidos.find((f) => f.id === forumId);
  const restante = LIMITE_TEXTO - texto.length;

  const publicar = async () => {
    setErro("");
    if (!destino) return setErro("Selecione o fórum de destino.");
    setEnviando(true);
    try {
      await criarPublicacao({ forumId: destino.id, texto, imagens, importante });
      setTexto("");
      setImagens([]);
      setImportante(false);
      onPublicado();
    } catch (e) {
      setErro(msg(e)); // texto preservado
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex gap-3">
        <Avatar usuario={usuario} />
        <div className="flex-1 space-y-2">
          <Textarea
            aria-label="Texto da publicação"
            rows={3}
            placeholder="Compartilhe algo com os participantes…"
            value={texto}
            maxLength={LIMITE_TEXTO + 200}
            onChange={(e) => setTexto(e.target.value)}
          />
          <SeletorImagens imagens={imagens} setImagens={setImagens} max={LIMITE_IMAGENS} onErro={setErro} />
          <div className="flex flex-wrap items-center gap-2">
            {forumFixo ? (
              <span className="text-xs text-muted-foreground">Publicando em <strong className="text-foreground">{forumFixo.nome}</strong></span>
            ) : (
              <div className="min-w-48">
                <NativeSelect aria-label="Fórum de destino" value={forumId} onChange={(e) => setForumId(e.target.value)}>
                  <option value="">Escolha o fórum…</option>
                  {forunsPermitidos.map((f) => (
                    <option key={f.id} value={f.id}>{f.icone} {f.nome}</option>
                  ))}
                </NativeSelect>
              </div>
            )}
            {gestao && (
              <Label className="flex items-center gap-1 text-xs font-normal text-inherit">
                <Checkbox checked={importante} onCheckedChange={(marcado) => setImportante(marcado === true)} /> Importante (notifica todos)
              </Label>
            )}
            <span className={`ml-auto font-mono text-xs ${restante < 0 ? "text-destructive" : "text-muted-foreground"}`} aria-live="polite">
              {restante}
            </span>
            <Button onClick={publicar} disabled={enviando || restante < 0}>{enviando ? "Publicando…" : "Publicar"}</Button>
          </div>
          {erro && <p role="alert" className="text-sm text-destructive">{erro}</p>}
        </div>
      </div>
    </div>
  );
}

// ---------- Galeria ----------
function Galeria({ imagens }: { imagens: ImagemPost[] }) {
  if (!imagens.length) return null;
  return (
    <div className={`mt-3 grid gap-1 overflow-hidden rounded-lg ${imagens.length > 1 ? "grid-cols-2" : ""}`}>
      {imagens.map((img, i) => (
        <img key={i} src={img.url} alt={img.alt || "Imagem da publicação"} loading="lazy" className="max-h-80 w-full object-cover" />
      ))}
    </div>
  );
}

/** Avatar que abre o perfil do operador (mantém o fórum no histórico para voltar). */
function AvatarLink({ usuario }: { usuario: Usuario | undefined }) {
  if (!usuario) return <Avatar usuario={undefined} />;
  return (
    <Link to="/operador/$usuarioId" params={{ usuarioId: usuario.id }} search={{ aba: undefined }} aria-label={`Perfil de ${nomeExibicao(usuario)}`} className="shrink-0 rounded-full focus-visible:outline-2 focus-visible:outline-ring">
      <Avatar usuario={usuario} />
    </Link>
  );
}

// ---------- Cabeçalho de autor ----------
function CabecalhoAutor({ base, autorId, eventoId, criadoEm, editadoEm, extra }: { base: BaseDados; autorId: string; eventoId: string; criadoEm: string; editadoEm?: string | undefined; extra?: React.ReactNode }) {
  const autor = base.usuarios.find((u) => u.id === autorId);
  const selo = seloAutor(base, autorId, eventoId);
  return (
    <div className="flex flex-wrap items-center gap-x-2 text-sm">
      {autor ? (
        <Link to="/operador/$usuarioId" params={{ usuarioId: autor.id }} search={{ aba: undefined }} className="font-semibold hover:underline">{nomeExibicao(autor)}</Link>
      ) : <span className="font-semibold">{nomeExibicao(autor)}</span>}
      {selo && <Badge variant={selo === "Admin" ? "destructive" : "accent"}>{selo}</Badge>}
      <span className="text-xs text-muted-foreground">· {formatarDataHoraBR(criadoEm)}</span>
      {editadoEm && <span className="text-xs text-muted-foreground">(editado)</span>}
      {extra}
    </div>
  );
}

// ---------- Cartão de publicação ----------
export function CartaoPublicacao({
  base,
  pub,
  usuario,
  gestao,
  foruns,
  mostrarForum,
  noDetalhe,
  onMudou,
  onAbrir,
}: {
  base: BaseDados;
  pub: Publicacao;
  usuario: Usuario;
  gestao: boolean;
  foruns: Forum[];
  mostrarForum?: boolean;
  noDetalhe?: boolean;
  onMudou: () => void;
  onAbrir?: () => void;
}) {
  const forum = foruns.find((f) => f.id === pub.forumId);
  const [modal, setModal] = useState<null | "editar" | "denunciar" | "ocultar" | "mover">(null);
  const [menu, setMenu] = useState(false);
  const [aviso, setAviso] = useState("");
  const proprio = pub.autorId === usuario.id;
  const curtido = curtiu(base, pub.id, usuario.id);
  const executar = async (fn: () => Promise<unknown>) => {
    try {
      await fn();
      setAviso("");
      onMudou();
    } catch (e) {
      setAviso(msg(e));
    }
    setMenu(false);
  };
  const copiarLink = async () => {
    const url = `${window.location.origin}/comunidade/${pub.eventoId}/p/${pub.id}`;
    try {
      await navigator.clipboard.writeText(url);
      setAviso("Link copiado. Ele só abre para quem tem acesso.");
    } catch {
      setAviso(url);
    }
    setMenu(false);
  };

  return (
    <article className={`rounded-lg border bg-card p-4 ${pub.fixada ? "border-accent" : "border-border"} ${pub.oculta ? "opacity-60" : ""}`}>
      <div className="flex gap-3">
        <AvatarLink usuario={pub.removidaPeloAutor ? undefined : base.usuarios.find((u) => u.id === pub.autorId)} />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div>
              <CabecalhoAutor base={base} autorId={pub.autorId} eventoId={pub.eventoId} criadoEm={pub.criadoEm} editadoEm={pub.editadoEm} />
              <div className="mt-0.5 flex flex-wrap gap-1">
                {mostrarForum && forum && <span className="text-xs text-muted-foreground">em {forum.icone} {forum.nome}</span>}
                {pub.fixada && <Badge variant="accent">📌 Fixada</Badge>}
                {pub.importante && <Badge variant="warning">Importante</Badge>}
                {pub.respostasFechadas && <Badge>Respostas fechadas</Badge>}
                {pub.oculta && <Badge variant="destructive">Oculta: {pub.motivoOcultacao}</Badge>}
              </div>
            </div>
            <DropdownMenu open={menu} onOpenChange={setMenu} modal={false}>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" aria-label="Ações da publicação">⋯</Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 border-border text-sm shadow-lg">
                  <ItemMenu onClick={copiarLink}>Copiar link</ItemMenu>
                  {proprio && !pub.removidaPeloAutor && <ItemMenu onClick={() => { setModal("editar"); setMenu(false); }}>Editar</ItemMenu>}
                  {proprio && (
                    <ItemMenu onClick={() => window.confirm("Excluir esta publicação?") && executar(() => excluirPublicacao(pub.id))}>Excluir</ItemMenu>
                  )}
                  {!proprio && <ItemMenu onClick={() => { setModal("denunciar"); setMenu(false); }}>Denunciar</ItemMenu>}
                  {gestao && (
                    <>
                      <DropdownMenuSeparator />
                      <ItemMenu onClick={() => executar(() => fixarPublicacao(pub.id))}>{pub.fixada ? "Desafixar" : "Fixar"}</ItemMenu>
                      <ItemMenu onClick={() => executar(() => alternarRespostas(pub.id))}>{pub.respostasFechadas ? "Reabrir respostas" : "Fechar respostas"}</ItemMenu>
                      {pub.oculta ? (
                        <ItemMenu onClick={() => executar(() => ocultarConteudo("publicacao", pub.id, "", false))}>Restaurar</ItemMenu>
                      ) : (
                        <ItemMenu onClick={() => { setModal("ocultar"); setMenu(false); }}>Ocultar…</ItemMenu>
                      )}
                      <ItemMenu onClick={() => { setModal("mover"); setMenu(false); }}>Mover para outro fórum…</ItemMenu>
                    </>
                  )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {pub.removidaPeloAutor ? (
            <p className="mt-2 text-sm italic text-muted-foreground">Publicação removida pelo autor</p>
          ) : (
            <>
              {pub.texto && <p className="mt-2 whitespace-pre-wrap break-words text-sm">{pub.texto}</p>}
              <Galeria imagens={pub.imagens} />
            </>
          )}

          <div className="mt-3 flex items-center gap-4 text-sm text-muted-foreground">
            <Button variant="plain" size="none"
              type="button"
              className={`flex items-center gap-1 hover:text-foreground disabled:cursor-not-allowed ${curtido ? "text-accent" : ""}`}
              aria-pressed={curtido}
              aria-label={curtido ? "Remover curtida" : "Curtir"}
              disabled={!podeCurtir(base, usuario, pub)}
              onClick={() => executar(() => alternarCurtida(pub.id))}
            >
              {curtido ? "♥" : "♡"} {contarCurtidas(base, pub.id)}
            </Button>
            {noDetalhe ? (
              <span>💬 {contarRespostas(base, pub.id, gestao)}</span>
            ) : (
              <Link
                to="/comunidade/$eventoId/p/$postId"
                params={{ eventoId: pub.eventoId, postId: pub.id }}
                onClick={onAbrir}
                className="flex items-center gap-1 hover:text-foreground"
                aria-label="Ver publicação e respostas"
              >
                💬 {contarRespostas(base, pub.id, gestao)}
              </Link>
            )}
          </div>
          {aviso && <p role="status" className="mt-2 break-all text-xs text-accent">{aviso}</p>}
        </div>
      </div>

      {modal === "editar" && (
        <ModalEditar
          titulo="Editar publicação"
          textoInicial={pub.texto}
          imagensIniciais={pub.imagens}
          maxImagens={LIMITE_IMAGENS}
          onFechar={() => setModal(null)}
          onSalvar={async (t, imgs) => { await editarPublicacao(pub.id, t, imgs); onMudou(); }}
        />
      )}
      {modal === "denunciar" && <ModalDenuncia onFechar={() => setModal(null)} onEnviar={(m, d) => denunciar({ alvo: "publicacao", alvoId: pub.id, motivo: m, descricao: d })} />}
      {modal === "ocultar" && <ModalJustificativa titulo="Ocultar publicação" onFechar={() => setModal(null)} onConfirmar={async (j) => { await ocultarConteudo("publicacao", pub.id, j); onMudou(); }} />}
      {modal === "mover" && forum && (
        <ModalMover
          origem={forum}
          foruns={foruns}
          onFechar={() => setModal(null)}
          onMover={async (id) => { await moverPublicacao(pub.id, id); onMudou(); }}
        />
      )}
    </article>
  );
}

function ItemMenu({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <DropdownMenuItem onSelect={onClick} className="block py-1.5">
      {children}
    </DropdownMenuItem>
  );
}

// ---------- Resposta ----------
export function ItemResposta({ base, r, usuario, gestao, eventoId, arquivado, onMudou }: { base: BaseDados; r: Resposta; usuario: Usuario; gestao: boolean; eventoId: string; arquivado: boolean; onMudou: () => void }) {
  const [modal, setModal] = useState<null | "editar" | "denunciar" | "ocultar">(null);
  const [erro, setErro] = useState("");
  const proprio = r.autorId === usuario.id;
  const run = async (fn: () => Promise<unknown>) => {
    try { await fn(); onMudou(); } catch (e) { setErro(msg(e)); }
  };
  return (
    <div className={`flex gap-3 border-t border-border py-3 ${r.oculta ? "opacity-60" : ""}`}>
      <AvatarLink usuario={base.usuarios.find((u) => u.id === r.autorId)} />
      <div className="min-w-0 flex-1">
        <CabecalhoAutor base={base} autorId={r.autorId} eventoId={eventoId} criadoEm={r.criadoEm} editadoEm={r.editadoEm} extra={r.oculta ? <Badge variant="destructive">Oculta: {r.motivoOcultacao}</Badge> : null} />
        {r.texto && <p className="mt-1 whitespace-pre-wrap break-words text-sm">{r.texto}</p>}
        {r.imagem && <Galeria imagens={[r.imagem]} />}
        <div className="mt-1 flex flex-wrap gap-3 text-xs text-muted-foreground">
          {proprio && !arquivado && <Button variant="plain" size="none" className="hover:text-foreground" onClick={() => setModal("editar")}>Editar</Button>}
          {proprio && <Button variant="plain" size="none" className="hover:text-foreground" onClick={() => window.confirm("Excluir esta resposta?") && run(() => excluirResposta(r.id))}>Excluir</Button>}
          {!proprio && <Button variant="plain" size="none" className="hover:text-foreground" onClick={() => setModal("denunciar")}>Denunciar</Button>}
          {gestao && (r.oculta
            ? <Button variant="plain" size="none" className="hover:text-foreground" onClick={() => run(() => ocultarConteudo("resposta", r.id, "", false))}>Restaurar</Button>
            : <Button variant="plain" size="none" className="hover:text-foreground" onClick={() => setModal("ocultar")}>Ocultar</Button>)}
        </div>
        {erro && <p role="alert" className="text-xs text-destructive">{erro}</p>}
      </div>
      {modal === "editar" && (
        <ModalEditar titulo="Editar resposta" textoInicial={r.texto} imagensIniciais={r.imagem ? [r.imagem] : []} maxImagens={1} onFechar={() => setModal(null)} onSalvar={async (t, imgs) => { await editarResposta(r.id, t, imgs[0]); onMudou(); }} />
      )}
      {modal === "denunciar" && <ModalDenuncia onFechar={() => setModal(null)} onEnviar={(m, d) => denunciar({ alvo: "resposta", alvoId: r.id, motivo: m, descricao: d })} />}
      {modal === "ocultar" && <ModalJustificativa titulo="Ocultar resposta" onFechar={() => setModal(null)} onConfirmar={async (j) => { await ocultarConteudo("resposta", r.id, j); onMudou(); }} />}
    </div>
  );
}

export function CompositorResposta({ onEnviar }: { onEnviar: (texto: string, imagem?: ImagemPost) => Promise<unknown> }) {
  const [texto, setTexto] = useState("");
  const [imagens, setImagens] = useState<ImagemPost[]>([]);
  const [erro, setErro] = useState("");
  const enviar = async () => {
    try {
      await onEnviar(texto, imagens[0]);
      setTexto("");
      setImagens([]);
      setErro("");
    } catch (e) {
      setErro(msg(e));
    }
  };
  return (
    <div className="space-y-2 border-t border-border pt-3">
      <Textarea aria-label="Sua resposta" rows={2} placeholder="Escreva uma resposta…" value={texto} onChange={(e) => setTexto(e.target.value)} />
      <div className="flex flex-wrap items-start justify-between gap-2">
        <SeletorImagens imagens={imagens} setImagens={setImagens} max={1} onErro={setErro} />
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs text-muted-foreground">{LIMITE_TEXTO - texto.length}</span>
          <Button onClick={enviar}>Responder</Button>
        </div>
      </div>
      {erro && <p role="alert" className="text-sm text-destructive">{erro}</p>}
    </div>
  );
}

// ---------- Modais ----------
function ModalEditar({ titulo, textoInicial, imagensIniciais, maxImagens, onFechar, onSalvar }: { titulo: string; textoInicial: string; imagensIniciais: ImagemPost[]; maxImagens: number; onFechar: () => void; onSalvar: (t: string, i: ImagemPost[]) => Promise<unknown> }) {
  const [texto, setTexto] = useState(textoInicial);
  const [imagens, setImagens] = useState(imagensIniciais);
  const [erro, setErro] = useState("");
  return (
    <Modal aberto titulo={titulo} onFechar={onFechar}>
      <div className="space-y-3">
        <Textarea aria-label="Texto" value={texto} onChange={(e) => setTexto(e.target.value)} />
        <p className="text-right font-mono text-xs text-muted-foreground">{LIMITE_TEXTO - texto.length}</p>
        <SeletorImagens imagens={imagens} setImagens={setImagens} max={maxImagens} onErro={setErro} />
        {erro && <p role="alert" className="text-sm text-destructive">{erro}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onFechar}>Cancelar</Button>
          <Button onClick={async () => { try { await onSalvar(texto, imagens); onFechar(); } catch (e) { setErro(msg(e)); } }}>Salvar</Button>
        </div>
      </div>
    </Modal>
  );
}

function ModalDenuncia({ onFechar, onEnviar }: { onFechar: () => void; onEnviar: (m: MotivoDenuncia, d: string) => Promise<unknown> }) {
  const [motivo, setMotivo] = useState<MotivoDenuncia>("ofensa");
  const [descricao, setDescricao] = useState("");
  const [estado, setEstado] = useState<"" | "ok" | string>("");
  return (
    <Modal aberto titulo="Denunciar conteúdo" onFechar={onFechar}>
      {estado === "ok" ? (
        <div className="space-y-3">
          <p className="text-sm">Denúncia enviada. Ela é privada e será analisada pela organização.</p>
          <Button onClick={onFechar}>Fechar</Button>
        </div>
      ) : (
        <div className="space-y-3">
          <Campo rotulo="Motivo" htmlFor="motivo-den">
            <NativeSelect id="motivo-den" value={motivo} onChange={(e) => setMotivo(e.target.value as MotivoDenuncia)}>
              {Object.entries(MOTIVOS_DENUNCIA).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </NativeSelect>
          </Campo>
          <Campo rotulo="Descrição (opcional)" htmlFor="desc-den">
            <Textarea id="desc-den" value={descricao} onChange={(e) => setDescricao(e.target.value)} />
          </Campo>
          {estado && <p role="alert" className="text-sm text-destructive">{estado}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onFechar}>Cancelar</Button>
            <Button onClick={async () => { try { await onEnviar(motivo, descricao); setEstado("ok"); } catch (e) { setEstado(msg(e)); } }}>Enviar denúncia</Button>
          </div>
        </div>
      )}
    </Modal>
  );
}

export function ModalJustificativa({ titulo, onFechar, onConfirmar }: { titulo: string; onFechar: () => void; onConfirmar: (j: string) => Promise<unknown> }) {
  const [j, setJ] = useState("");
  const [erro, setErro] = useState("");
  return (
    <Modal aberto titulo={titulo} onFechar={onFechar}>
      <div className="space-y-3">
        <Campo rotulo="Justificativa (registrada na auditoria)" htmlFor="just">
          <Textarea id="just" value={j} onChange={(e) => setJ(e.target.value)} />
        </Campo>
        {erro && <p role="alert" className="text-sm text-destructive">{erro}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onFechar}>Cancelar</Button>
          <Button variant="destructive" onClick={async () => { try { await onConfirmar(j); onFechar(); } catch (e) { setErro(msg(e)); } }}>Confirmar</Button>
        </div>
      </div>
    </Modal>
  );
}

function ModalMover({ origem, foruns, onFechar, onMover }: { origem: Forum; foruns: Forum[]; onFechar: () => void; onMover: (id: string) => Promise<unknown> }) {
  const opcoes = foruns.filter((f) => f.id !== origem.id && f.publico === origem.publico && f.status === "ativo");
  const [destino, setDestino] = useState(opcoes[0]?.id ?? "");
  const [erro, setErro] = useState("");
  return (
    <Modal aberto titulo="Mover publicação" onFechar={onFechar}>
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">Só é possível mover para fóruns com o mesmo público, para evitar exposição involuntária.</p>
        {opcoes.length === 0 ? (
          <p className="text-sm">Nenhum fórum compatível.</p>
        ) : (
          <NativeSelect aria-label="Fórum de destino" value={destino} onChange={(e) => setDestino(e.target.value)}>
            {opcoes.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
          </NativeSelect>
        )}
        {erro && <p role="alert" className="text-sm text-destructive">{erro}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onFechar}>Cancelar</Button>
          <Button disabled={!destino} onClick={async () => { try { await onMover(destino); onFechar(); } catch (e) { setErro(msg(e)); } }}>Mover</Button>
        </div>
      </div>
    </Modal>
  );
}
