// Cartão de uma publicação da comunidade geral: autor, texto (sempre como texto, nunca HTML),
// fotos e ações (curtir, responder, compartilhar, denunciar, excluir, bloquear).
import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Ban, EyeOff, Flag, Heart, MessageCircle, MoreHorizontal, Share2, Trash2 } from "lucide-react";
import { bloquear, curtirPost, denunciarPost, excluirPost, ocultarPostDoForum } from "@/api/social.functions";
import { useAuth } from "@/contexts/AuthContext";
import { MOTIVOS_DENUNCIA, type MotivoDenunciaSocial, type PostDTO } from "@/lib/comunidadeGeral";
import { tempoRelativo } from "@/lib/tempoRelativo";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { Campo, Modal, ModalTexto } from "@/components/ui";
import { tr } from "@/i18n/components/social/CartaoPost";

export function AvatarAutor({ nome, fotoUrl, tamanho = "h-10 w-10" }: { nome: string; fotoUrl?: string | undefined; tamanho?: string }) {
  if (fotoUrl) return <img src={fotoUrl} alt="" className={`${tamanho} shrink-0 rounded-full object-cover`} />;
  return (
    <span aria-hidden="true" className={`${tamanho} flex shrink-0 items-center justify-center rounded-full bg-secondary font-display text-sm font-semibold text-secondary-foreground`}>
      {nome.slice(0, 1).toUpperCase()}
    </span>
  );
}

function GradeFotos({ imagens }: { imagens: PostDTO["imagens"] }) {
  if (!imagens.length) return null;
  const grade = imagens.length === 1 ? "grid-cols-1" : "grid-cols-2";
  return (
    <div className={`mt-2 grid gap-1 overflow-hidden rounded-lg border border-border ${grade}`}>
      {imagens.map((img, i) => (
        <a key={img.url} href={img.url} target="_blank" rel="noopener noreferrer"
          className={`block bg-secondary ${imagens.length === 3 && i === 0 ? "row-span-2" : ""}`}>
          <img src={img.url} alt={img.alt || tr("foto_da_publicacao")} loading="lazy"
            className={`h-full w-full object-cover ${imagens.length === 1 ? "max-h-[28rem]" : "aspect-square"}`} />
        </a>
      ))}
    </div>
  );
}

export function CartaoPost({ post, onMudou, destaque = false, moderar = false }: {
  post: PostDTO; onMudou: () => void; destaque?: boolean;
  /** Dono ou moderador do fórum do post: pode ocultar. */
  moderar?: boolean;
}) {
  const { usuario } = useAuth();
  const navigate = useNavigate();
  const [curtiu, setCurtiu] = useState(post.curtiu);
  const [curtidas, setCurtidas] = useState(post.curtidas);
  const [aviso, setAviso] = useState("");
  const [denunciando, setDenunciando] = useState(false);
  const [excluindo, setExcluindo] = useState(false);
  const [ocultando, setOcultando] = useState(false);
  const link = `/comunidades/p/${post.id}`;

  const exigirLogin = () => {
    if (usuario) return true;
    navigate({ to: "/login", search: { redirect: link } });
    return false;
  };

  const alternarCurtida = async () => {
    if (!exigirLogin()) return;
    const novo = !curtiu;
    setCurtiu(novo);
    setCurtidas((n) => n + (novo ? 1 : -1));
    try {
      await curtirPost(post.id, novo);
    } catch (e) {
      setCurtiu(!novo);
      setCurtidas((n) => n + (novo ? -1 : 1));
      setAviso(e instanceof Error ? e.message : tr("nao_foi_possivel_curtir"));
    }
  };

  const compartilhar = async () => {
    const url = `${window.location.origin}${link}`;
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title: tr("publicacao_no_milsim_ops"), url });
        return;
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setAviso(tr("link_copiado"));
    } catch {
      setAviso(url);
    }
  };

  const bloquearAutor = async () => {
    try {
      await bloquear(post.autor.id, true);
      setAviso(tr("voce_bloqueou_nome_as_publicacoes_dessa", { nome: post.autor.nome }));
      onMudou();
    } catch (e) {
      setAviso(e instanceof Error ? e.message : tr("nao_foi_possivel_bloquear"));
    }
  };

  return (
    <article className={`rounded-lg border border-border bg-card p-4 ${destaque ? "" : "transition-colors hover:bg-card/80"}`}>
      <div className="flex gap-3">
        <Link to="/operador/$usuarioId" params={{ usuarioId: post.autor.id }} search={{ aba: undefined }} className="shrink-0" aria-label={tr("perfil_de_nome", { nome: post.autor.nome })}>
          <AvatarAutor nome={post.autor.nome} fotoUrl={post.autor.fotoUrl} />
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="min-w-0 truncate text-sm">
              <Link to="/operador/$usuarioId" params={{ usuarioId: post.autor.id }} search={{ aba: undefined }} className="font-semibold hover:underline">
                {post.autor.nome}
              </Link>
              <span className="text-muted-foreground"> · </span>
              <Link to="/comunidades/p/$postId" params={{ postId: post.id }} className="text-muted-foreground hover:underline">
                <time dateTime={post.criadoEm}>{tempoRelativo(post.criadoEm)}</time>
              </Link>
            </p>
            {usuario && (
              <DropdownMenu modal={false}>
                <DropdownMenuTrigger asChild>
                  <Button variant="plain" size="none" type="button" aria-label={tr("mais_acoes")} className="-mr-1 -mt-1 rounded-md p-1 text-muted-foreground hover:bg-secondary hover:text-foreground">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {moderar && !post.proprio && (
                    <>
                      <DropdownMenuItem onSelect={() => setOcultando(true)}><EyeOff className="h-4 w-4" />{" "}{tr("ocultar_moderacao_do_forum")}</DropdownMenuItem>
                      <DropdownMenuSeparator />
                    </>
                  )}
                  {post.proprio ? (
                    <DropdownMenuItem onSelect={() => setExcluindo(true)} className="text-destructive"><Trash2 className="h-4 w-4" />{" "}{tr("excluir_publicacao")}</DropdownMenuItem>
                  ) : (
                    <>
                      <DropdownMenuItem onSelect={() => setDenunciando(true)}><Flag className="h-4 w-4" />{" "}{tr("denunciar")}</DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onSelect={bloquearAutor} className="text-destructive"><Ban className="h-4 w-4" />{" "}{tr("bloquear_nome", { nome: post.autor.nome })}</DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
          {post.texto && <p className={`mt-1 whitespace-pre-wrap break-words ${destaque ? "text-lg" : "text-[15px]"}`}>{post.texto}</p>}
          <GradeFotos imagens={post.imagens} />
          <div className="mt-2 flex items-center gap-1 text-muted-foreground">
            <Button variant="plain" size="none" type="button" onClick={alternarCurtida} aria-pressed={curtiu}
              aria-label={curtiu ? tr("descurtir_curtidas_curtidas", { curtidas }) : tr("curtir_curtidas_curtidas", { curtidas })}
              className={`flex items-center gap-1.5 rounded-md px-2 py-1 text-sm hover:bg-secondary ${curtiu ? "text-destructive" : "hover:text-foreground"}`}>
              <Heart className={`h-4 w-4 ${curtiu ? "fill-current" : ""}`} aria-hidden="true" /> {curtidas > 0 && curtidas}
            </Button>
            <Link to="/comunidades/p/$postId" params={{ postId: post.id }} aria-label={tr("responder_respostas_respostas", { respostas: post.respostas })}
              className="flex items-center gap-1.5 rounded-md px-2 py-1 text-sm hover:bg-secondary hover:text-foreground">
              <MessageCircle className="h-4 w-4" aria-hidden="true" /> {post.respostas > 0 && post.respostas}
            </Link>
            <Button variant="plain" size="none" type="button" onClick={compartilhar} aria-label={tr("compartilhar")}
              className="flex items-center gap-1.5 rounded-md px-2 py-1 text-sm hover:bg-secondary hover:text-foreground">
              <Share2 className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
          {aviso && <p role="status" className="mt-1 break-all text-xs text-muted-foreground">{aviso}</p>}
        </div>
      </div>

      <ModalDenuncia aberto={denunciando} onFechar={() => setDenunciando(false)} onEnviar={async (m, d) => {
        await denunciarPost(post.id, m, d);
        setAviso(tr("denuncia_enviada_a_moderacao_vai_analisa"));
      }} />
      <ModalTexto
        aberto={ocultando}
        titulo={tr("ocultar_publicacao_do_forum")}
        rotulo={tr("motivo_o_autor_recebe_este_texto")}
        descricao={tr("a_publicacao_deixa_de_aparecer_para")}
        confirmar={tr("ocultar")}
        destrutivo
        maximo={300}
        onFechar={() => setOcultando(false)}
        onConfirmar={async (motivo) => {
          await ocultarPostDoForum(post.id, motivo);
          onMudou();
        }}
      />
      <Modal aberto={excluindo} titulo={tr("excluir_publicacao")} onFechar={() => setExcluindo(false)}>
        <p className="text-sm text-muted-foreground">{tr("a_publicacao_some_do_feed_e")}</p>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setExcluindo(false)}>{tr("cancelar")}</Button>
          <Button variant="destructive" onClick={async () => {
            try {
              await excluirPost(post.id);
              setExcluindo(false);
              onMudou();
            } catch (e) {
              setAviso(e instanceof Error ? e.message : tr("nao_foi_possivel_excluir"));
              setExcluindo(false);
            }
          }}>{tr("excluir")}</Button>
        </div>
      </Modal>
    </article>
  );
}

function ModalDenuncia({ aberto, onFechar, onEnviar }: {
  aberto: boolean; onFechar: () => void; onEnviar: (motivo: MotivoDenunciaSocial, detalhes?: string) => Promise<void>;
}) {
  const [motivo, setMotivo] = useState<MotivoDenunciaSocial | "">("");
  const [detalhes, setDetalhes] = useState("");
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);
  const enviar = async () => {
    if (!motivo) return setErro(tr("escolha_o_motivo_da_denuncia"));
    setEnviando(true);
    try {
      await onEnviar(motivo, detalhes.trim() || undefined);
      setMotivo("");
      setDetalhes("");
      onFechar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : tr("nao_foi_possivel_enviar_a_denuncia"));
    } finally {
      setEnviando(false);
    }
  };
  return (
    <Modal aberto={aberto} titulo={tr("denunciar_publicacao")} onFechar={onFechar}>
      <div className="space-y-3">
        <Campo rotulo={tr("motivo")} htmlFor="den-motivo" erro={erro}>
          <NativeSelect id="den-motivo" value={motivo} onChange={(e) => { setMotivo(e.target.value as MotivoDenunciaSocial); setErro(""); }}>
            <option value="">{tr("selecione")}</option>
            {(Object.keys(MOTIVOS_DENUNCIA) as MotivoDenunciaSocial[]).map((m) => <option key={m} value={m}>{MOTIVOS_DENUNCIA[m]}</option>)}
          </NativeSelect>
        </Campo>
        <Campo rotulo={tr("detalhes_opcional")} htmlFor="den-detalhes">
          <Textarea id="den-detalhes" rows={3} maxLength={500} value={detalhes} onChange={(e) => setDetalhes(e.target.value)} />
        </Campo>
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="ghost" onClick={onFechar} disabled={enviando}>{tr("cancelar")}</Button>
        <Button onClick={enviar} disabled={enviando}>{enviando ? tr("enviando") : tr("enviar_denuncia")}</Button>
      </div>
    </Modal>
  );
}
