import { Heart, ImagePlus, MessageSquare, Pin } from "lucide-react";
import { IconeForum } from "@/components/IconeForum";
// Componentes de interface da comunidade (feed social). Regras ficam no serviço.
import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useConfirmacao } from "@/contexts/ConfirmacaoContext";
import { carregarBase } from "@/services/db";
import { acessoAComunidade } from "@/lib/comunidadePublica";
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
import { Campo, Modal, SkeletonPagina } from "@/components/ui";
import { Checkbox } from "@/components/ui/checkbox";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { tr } from "@/i18n/components/comunidade";

function msg(e: unknown) {
  return e instanceof Error ? e.message : tr("algo_deu_errado_tente_novamente");
}

export function SemAcesso({ eventoId }: { eventoId: string }) {
  return (
    <div className="mx-auto max-w-xl px-4 py-16 text-center">
      <h1 className="font-display text-2xl font-semibold">{tr("conteudo_indisponivel")}</h1>
      <p className="mt-2 text-muted-foreground">{tr("este_conteudo_nao_existe_ou_voce")}</p>
      <Link to="/eventos/$eventoId" params={{ eventoId }} className="mt-4 inline-block text-accent hover:underline">{tr("ver_pagina_publica_do_evento")}</Link>
    </div>
  );
}

/**
 * Quem chega à comunidade sem acesso (pelo menu, pela vitrine ou por um link compartilhado):
 * com inscrições abertas vai direto para a inscrição; com reserva em aberto, para o pagamento;
 * sem como entrar, recebe a explicação. O conteúdo nunca é mostrado.
 */
export function PortaComunidade({ eventoId }: { eventoId: string }) {
  const { usuario } = useAuth();
  const navigate = useNavigate();
  const acesso = acessoAComunidade(carregarBase(), usuario ?? null, eventoId);
  useEffect(() => {
    if (acesso === "inscrever") {
      navigate({ to: "/inscricao/$eventoId", params: { eventoId }, search: { cortesia: undefined, voucher: undefined, comunidade: "1" }, replace: true });
    }
  }, [acesso, eventoId, navigate]);

  if (acesso === "inscrever") return <SkeletonPagina />;
  if (acesso === "pagamento_pendente" || acesso === "encerrada") {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center">
        <h1 className="font-display text-2xl font-semibold">{tr("comunidade_exclusiva_para_inscritos")}</h1>
        <p className="mt-2 text-muted-foreground">
          {acesso === "pagamento_pendente"
            ? tr("sua_vaga_esta_reservada_mas_o")
            : tr("as_inscricoes_desta_operacao_estao_encer")}
        </p>
        {acesso === "pagamento_pendente" ? (
          <Link to="/app/ingressos" className="mt-4 inline-block text-accent hover:underline">{tr("concluir_pagamento_em_meus_ingressos")}</Link>
        ) : (
          <Link to="/comunidades" className="mt-4 inline-block text-accent hover:underline">{tr("ver_outras_comunidades")}</Link>
        )}
      </div>
    );
  }
  return <SemAcesso eventoId={eventoId} />;
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
        onErro(tr("maximo_de_max_imagem_ns", { max }));
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
                <img src={img.url} alt={img.alt ?? tr("previa_da_imagem")} className="h-28 w-full rounded-md object-cover" />
                <Button variant="plain" size="none"
                  type="button"
                  onClick={() => setImagens(imagens.filter((_, j) => j !== i))}
                  className="absolute right-1 top-1 rounded-full bg-background/90 px-2 text-sm text-foreground"
                  aria-label={tr("remover_imagem_valor", { valor: i + 1 })}
                >
                  ✕
                </Button>
              </div>
              <Input
                placeholder={tr("descricao_alternativa_opcional")}
                aria-label={tr("descricao_alternativa_da_imagem_valor", { valor: i + 1 })}
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
          <ImagePlus className="h-4 w-4" aria-hidden />{tr("adicionar_imagem")}</Button>
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
    if (!destino) return setErro(tr("selecione_o_forum_de_destino"));
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
        <span className="hidden sm:block"><Avatar usuario={usuario} /></span>
        <div className="min-w-0 flex-1 space-y-2">
          <Textarea
            aria-label={tr("texto_da_publicacao")}
            rows={3}
            placeholder={tr("compartilhe_algo_com_os_participantes")}
            value={texto}
            maxLength={LIMITE_TEXTO + 200}
            onChange={(e) => setTexto(e.target.value)}
          />
          <SeletorImagens imagens={imagens} setImagens={setImagens} max={LIMITE_IMAGENS} onErro={setErro} />
          <div className="flex flex-wrap items-center gap-2">
            {forumFixo ? (
              <span className="text-xs text-muted-foreground">{tr("publicando_em")}{" "}<strong className="text-foreground">{forumFixo.nome}</strong></span>
            ) : (
              <div className="w-full sm:w-auto sm:min-w-48">
                <NativeSelect aria-label={tr("forum_de_destino")} value={forumId} onChange={(e) => setForumId(e.target.value)}>
                  <option value="">{tr("escolha_o_forum")}</option>
                  {forunsPermitidos.map((f) => (
                    <option key={f.id} value={f.id}>{f.nome}</option>
                  ))}
                </NativeSelect>
              </div>
            )}
            {gestao && (
              <Label className="flex items-center gap-1 text-xs font-normal text-inherit">
                <Checkbox checked={importante} onCheckedChange={(marcado) => setImportante(marcado === true)} />{" "}{tr("importante_notifica_todos")}</Label>
            )}
            <span className={`ml-auto font-mono text-xs ${restante < 0 ? "text-destructive" : "text-muted-foreground"}`} aria-live="polite">
              {restante}
            </span>
            <Button onClick={publicar} disabled={enviando || restante < 0}>{enviando ? tr("publicando") : tr("publicar")}</Button>
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
        <img key={i} src={img.url} alt={img.alt || tr("imagem_da_publicacao")} loading="lazy" className="max-h-80 w-full object-cover" />
      ))}
    </div>
  );
}

/** Avatar que abre o perfil do operador (mantém o fórum no histórico para voltar). */
function AvatarLink({ usuario }: { usuario: Usuario | undefined }) {
  if (!usuario) return <Avatar usuario={undefined} />;
  return (
    <Link to="/operador/$usuarioId" params={{ usuarioId: usuario.id }} search={{ aba: undefined }} aria-label={tr("perfil_de_usuario", { usuario: nomeExibicao(usuario) })} className="shrink-0 rounded-full focus-visible:outline-2 focus-visible:outline-ring">
      <Avatar usuario={usuario} />
    </Link>
  );
}

// ---------- Cabeçalho de autor ----------
function CabecalhoAutor({ base, autorId, eventoId, criadoEm, editadoEm, extra }: { base: BaseDados; autorId: string; eventoId: string; criadoEm: string; editadoEm?: string | undefined; extra?: React.ReactNode }) {
  const autor = base.usuarios.find((u) => u.id === autorId);
  const selo = seloAutor(base, autorId, eventoId);
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm">
      {autor ? (
        <Link to="/operador/$usuarioId" params={{ usuarioId: autor.id }} search={{ aba: undefined }} className="font-semibold hover:underline">{nomeExibicao(autor)}</Link>
      ) : <span className="font-semibold">{nomeExibicao(autor)}</span>}
      {selo && <Badge variant={selo === "Admin" ? "destructive" : "accent"}>{selo}</Badge>}
      <span className="text-xs text-muted-foreground"><span className="hidden sm:inline">· </span>{formatarDataHoraBR(criadoEm)}</span>
      {editadoEm && <span className="text-xs text-muted-foreground">{tr("editado")}</span>}
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
  const { confirmar } = useConfirmacao();
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
      setAviso(tr("link_copiado_ele_so_abre_para"));
    } catch {
      setAviso(url);
    }
    setMenu(false);
  };

  return (
    <article className={`border-b border-border py-5 ${pub.fixada ? "border-l-2 border-l-accent bg-accent/5 pl-4 pr-3" : ""} ${pub.oculta ? "opacity-60" : ""}`}>
      <div className="flex gap-3">
        <AvatarLink usuario={pub.removidaPeloAutor ? undefined : base.usuarios.find((u) => u.id === pub.autorId)} />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <CabecalhoAutor base={base} autorId={pub.autorId} eventoId={pub.eventoId} criadoEm={pub.criadoEm} editadoEm={pub.editadoEm} />
              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                {mostrarForum && forum && <span className="inline-flex items-center gap-1 text-xs text-muted-foreground"><IconeForum forum={forum} tamanho="sm" />{forum.nome}</span>}
                {pub.fixada && <Badge variant="accent"><Pin />{tr("fixada")}</Badge>}
                {pub.importante && <Badge variant="warning">{tr("importante")}</Badge>}
                {pub.respostasFechadas && <Badge>{tr("respostas_fechadas")}</Badge>}
                {pub.oculta && <Badge variant="destructive">{tr("oculta_motivoocultacao", { motivoOcultacao: pub.motivoOcultacao })}</Badge>}
              </div>
            </div>
            <DropdownMenu open={menu} onOpenChange={setMenu} modal={false}>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" aria-label={tr("acoes_da_publicacao")}>⋯</Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 border-border text-sm shadow-lg">
                  <ItemMenu onClick={copiarLink}>{tr("copiar_link")}</ItemMenu>
                  {proprio && !pub.removidaPeloAutor && <ItemMenu onClick={() => { setModal("editar"); setMenu(false); }}>{tr("editar")}</ItemMenu>}
                  {proprio && (
                    <ItemMenu onClick={async () => { setMenu(false); if (await confirmar({ titulo: tr("excluir_esta_publicacao"), confirmar: tr("excluir"), destrutivo: true })) executar(() => excluirPublicacao(pub.id)); }}>{tr("excluir")}</ItemMenu>
                  )}
                  {!proprio && <ItemMenu onClick={() => { setModal("denunciar"); setMenu(false); }}>{tr("denunciar")}</ItemMenu>}
                  {gestao && (
                    <>
                      <DropdownMenuSeparator />
                      <ItemMenu onClick={() => executar(() => fixarPublicacao(pub.id))}>{pub.fixada ? tr("desafixar") : tr("fixar")}</ItemMenu>
                      <ItemMenu onClick={() => executar(() => alternarRespostas(pub.id))}>{pub.respostasFechadas ? tr("reabrir_respostas") : tr("fechar_respostas")}</ItemMenu>
                      {pub.oculta ? (
                        <ItemMenu onClick={() => executar(() => ocultarConteudo("publicacao", pub.id, "", false))}>{tr("restaurar")}</ItemMenu>
                      ) : (
                        <ItemMenu onClick={() => { setModal("ocultar"); setMenu(false); }}>{tr("ocultar")}</ItemMenu>
                      )}
                      <ItemMenu onClick={() => { setModal("mover"); setMenu(false); }}>{tr("mover_para_outro_forum")}</ItemMenu>
                    </>
                  )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {pub.removidaPeloAutor ? (
            <p className="mt-2 text-sm italic text-muted-foreground">{tr("publicacao_removida_pelo_autor")}</p>
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
              aria-label={curtido ? tr("remover_curtida") : tr("curtir")}
              disabled={!podeCurtir(base, usuario, pub)}
              onClick={() => executar(() => alternarCurtida(pub.id))}
            >
              <Heart className={`inline h-3.5 w-3.5 ${curtido ? "fill-current text-destructive" : ""}`} aria-hidden /> {contarCurtidas(base, pub.id)}
            </Button>
            {noDetalhe ? (
              <span><MessageSquare className="inline h-3.5 w-3.5" aria-hidden /> {contarRespostas(base, pub.id, gestao)}</span>
            ) : (
              <Link
                to="/comunidade/$eventoId/p/$postId"
                params={{ eventoId: pub.eventoId, postId: pub.id }}
                onClick={onAbrir}
                className="flex items-center gap-1 hover:text-foreground"
                aria-label={tr("ver_publicacao_e_respostas")}
              >
                <MessageSquare className="inline h-3.5 w-3.5" aria-hidden /> {contarRespostas(base, pub.id, gestao)}
              </Link>
            )}
          </div>
          {aviso && <p role="status" className="mt-2 break-all text-xs text-accent">{aviso}</p>}
        </div>
      </div>

      {modal === "editar" && (
        <ModalEditar
          titulo={tr("editar_publicacao")}
          textoInicial={pub.texto}
          imagensIniciais={pub.imagens}
          maxImagens={LIMITE_IMAGENS}
          onFechar={() => setModal(null)}
          onSalvar={async (t, imgs) => { await editarPublicacao(pub.id, t, imgs); onMudou(); }}
        />
      )}
      {modal === "denunciar" && <ModalDenuncia onFechar={() => setModal(null)} onEnviar={(m, d) => denunciar({ alvo: "publicacao", alvoId: pub.id, motivo: m, descricao: d })} />}
      {modal === "ocultar" && <ModalJustificativa titulo={tr("ocultar_publicacao")} onFechar={() => setModal(null)} onConfirmar={async (j) => { await ocultarConteudo("publicacao", pub.id, j); onMudou(); }} />}
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
  const { confirmar } = useConfirmacao();
  const [erro, setErro] = useState("");
  const proprio = r.autorId === usuario.id;
  const run = async (fn: () => Promise<unknown>) => {
    try { await fn(); onMudou(); } catch (e) { setErro(msg(e)); }
  };
  return (
    <div className={`flex gap-3 border-t border-border py-3 ${r.oculta ? "opacity-60" : ""}`}>
      <AvatarLink usuario={base.usuarios.find((u) => u.id === r.autorId)} />
      <div className="min-w-0 flex-1">
        <CabecalhoAutor base={base} autorId={r.autorId} eventoId={eventoId} criadoEm={r.criadoEm} editadoEm={r.editadoEm} extra={r.oculta ? <Badge variant="destructive">{tr("oculta_motivoocultacao", { motivoOcultacao: r.motivoOcultacao })}</Badge> : null} />
        {r.texto && <p className="mt-1 whitespace-pre-wrap break-words text-sm">{r.texto}</p>}
        {r.imagem && <Galeria imagens={[r.imagem]} />}
        <div className="mt-1 flex flex-wrap gap-3 text-xs text-muted-foreground">
          {proprio && !arquivado && <Button variant="plain" size="none" className="hover:text-foreground" onClick={() => setModal("editar")}>{tr("editar")}</Button>}
          {proprio && <Button variant="plain" size="none" className="hover:text-foreground" onClick={async () => (await confirmar({ titulo: tr("excluir_esta_resposta"), confirmar: tr("excluir"), destrutivo: true })) && run(() => excluirResposta(r.id))}>{tr("excluir")}</Button>}
          {!proprio && <Button variant="plain" size="none" className="hover:text-foreground" onClick={() => setModal("denunciar")}>{tr("denunciar")}</Button>}
          {gestao && (r.oculta
            ? <Button variant="plain" size="none" className="hover:text-foreground" onClick={() => run(() => ocultarConteudo("resposta", r.id, "", false))}>{tr("restaurar")}</Button>
            : <Button variant="plain" size="none" className="hover:text-foreground" onClick={() => setModal("ocultar")}>{tr("ocultar_2")}</Button>)}
        </div>
        {erro && <p role="alert" className="text-xs text-destructive">{erro}</p>}
      </div>
      {modal === "editar" && (
        <ModalEditar titulo={tr("editar_resposta")} textoInicial={r.texto} imagensIniciais={r.imagem ? [r.imagem] : []} maxImagens={1} onFechar={() => setModal(null)} onSalvar={async (t, imgs) => { await editarResposta(r.id, t, imgs[0]); onMudou(); }} />
      )}
      {modal === "denunciar" && <ModalDenuncia onFechar={() => setModal(null)} onEnviar={(m, d) => denunciar({ alvo: "resposta", alvoId: r.id, motivo: m, descricao: d })} />}
      {modal === "ocultar" && <ModalJustificativa titulo={tr("ocultar_resposta")} onFechar={() => setModal(null)} onConfirmar={async (j) => { await ocultarConteudo("resposta", r.id, j); onMudou(); }} />}
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
      <Textarea aria-label={tr("sua_resposta")} rows={2} placeholder={tr("escreva_uma_resposta")} value={texto} onChange={(e) => setTexto(e.target.value)} />
      <div className="flex flex-wrap items-start justify-between gap-2">
        <SeletorImagens imagens={imagens} setImagens={setImagens} max={1} onErro={setErro} />
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs text-muted-foreground">{LIMITE_TEXTO - texto.length}</span>
          <Button onClick={enviar}>{tr("responder")}</Button>
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
        <Textarea aria-label={tr("texto")} value={texto} onChange={(e) => setTexto(e.target.value)} />
        <p className="text-right font-mono text-xs text-muted-foreground">{LIMITE_TEXTO - texto.length}</p>
        <SeletorImagens imagens={imagens} setImagens={setImagens} max={maxImagens} onErro={setErro} />
        {erro && <p role="alert" className="text-sm text-destructive">{erro}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onFechar}>{tr("cancelar")}</Button>
          <Button onClick={async () => { try { await onSalvar(texto, imagens); onFechar(); } catch (e) { setErro(msg(e)); } }}>{tr("salvar")}</Button>
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
    <Modal aberto titulo={tr("denunciar_conteudo")} onFechar={onFechar}>
      {estado === "ok" ? (
        <div className="space-y-3">
          <p className="text-sm">{tr("denuncia_enviada_ela_e_privada_e")}</p>
          <Button onClick={onFechar}>{tr("fechar")}</Button>
        </div>
      ) : (
        <div className="space-y-3">
          <Campo rotulo={tr("motivo")} htmlFor="motivo-den">
            <NativeSelect id="motivo-den" value={motivo} onChange={(e) => setMotivo(e.target.value as MotivoDenuncia)}>
              {Object.entries(MOTIVOS_DENUNCIA).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </NativeSelect>
          </Campo>
          <Campo rotulo={tr("descricao_opcional")} htmlFor="desc-den">
            <Textarea id="desc-den" value={descricao} onChange={(e) => setDescricao(e.target.value)} />
          </Campo>
          {estado && <p role="alert" className="text-sm text-destructive">{estado}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onFechar}>{tr("cancelar")}</Button>
            <Button onClick={async () => { try { await onEnviar(motivo, descricao); setEstado("ok"); } catch (e) { setEstado(msg(e)); } }}>{tr("enviar_denuncia")}</Button>
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
        <Campo rotulo={tr("justificativa_registrada_na_auditoria")} htmlFor="just">
          <Textarea id="just" value={j} onChange={(e) => setJ(e.target.value)} />
        </Campo>
        {erro && <p role="alert" className="text-sm text-destructive">{erro}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onFechar}>{tr("cancelar")}</Button>
          <Button variant="destructive" onClick={async () => { try { await onConfirmar(j); onFechar(); } catch (e) { setErro(msg(e)); } }}>{tr("confirmar")}</Button>
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
    <Modal aberto titulo={tr("mover_publicacao")} onFechar={onFechar}>
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">{tr("so_e_possivel_mover_para_foruns")}</p>
        {opcoes.length === 0 ? (
          <p className="text-sm">{tr("nenhum_forum_compativel")}</p>
        ) : (
          <NativeSelect aria-label={tr("forum_de_destino")} value={destino} onChange={(e) => setDestino(e.target.value)}>
            {opcoes.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
          </NativeSelect>
        )}
        {erro && <p role="alert" className="text-sm text-destructive">{erro}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onFechar}>{tr("cancelar")}</Button>
          <Button disabled={!destino} onClick={async () => { try { await onMover(destino); onFechar(); } catch (e) { setErro(msg(e)); } }}>{tr("mover")}</Button>
        </div>
      </div>
    </Modal>
  );
}
