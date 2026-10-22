// Cartão de uma publicação da comunidade geral: autor, texto (sempre como texto, nunca HTML),
// fotos e ações (curtir, responder, compartilhar, denunciar, excluir, bloquear).
import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Ban, Flag, Heart, MessageCircle, MoreHorizontal, Share2, Trash2 } from "lucide-react";
import { bloquear, curtirPost, denunciarPost, excluirPost } from "@/api/social.functions";
import { useAuth } from "@/contexts/AuthContext";
import { MOTIVOS_DENUNCIA, type MotivoDenunciaSocial, type PostDTO } from "@/lib/comunidadeGeral";
import { tempoRelativo } from "@/lib/tempoRelativo";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { Campo, Modal } from "@/components/ui";

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
          <img src={img.url} alt={img.alt || "Foto da publicação"} loading="lazy"
            className={`h-full w-full object-cover ${imagens.length === 1 ? "max-h-[28rem]" : "aspect-square"}`} />
        </a>
      ))}
    </div>
  );
}

export function CartaoPost({ post, onMudou, destaque = false }: { post: PostDTO; onMudou: () => void; destaque?: boolean }) {
  const { usuario } = useAuth();
  const navigate = useNavigate();
  const [curtiu, setCurtiu] = useState(post.curtiu);
  const [curtidas, setCurtidas] = useState(post.curtidas);
  const [aviso, setAviso] = useState("");
  const [denunciando, setDenunciando] = useState(false);
  const [excluindo, setExcluindo] = useState(false);
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
      setAviso(e instanceof Error ? e.message : "Não foi possível curtir.");
    }
  };

  const compartilhar = async () => {
    const url = `${window.location.origin}${link}`;
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title: "Publicação no MilSim Ops", url });
        return;
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setAviso("Link copiado.");
    } catch {
      setAviso(url);
    }
  };

  const bloquearAutor = async () => {
    try {
      await bloquear(post.autor.id, true);
      setAviso(`Você bloqueou ${post.autor.nome}. As publicações dessa conta não aparecem mais para você.`);
      onMudou();
    } catch (e) {
      setAviso(e instanceof Error ? e.message : "Não foi possível bloquear.");
    }
  };

  return (
    <article className={`rounded-lg border border-border bg-card p-4 ${destaque ? "" : "transition-colors hover:bg-card/80"}`}>
      <div className="flex gap-3">
        <Link to="/operador/$usuarioId" params={{ usuarioId: post.autor.id }} search={{ aba: undefined }} className="shrink-0" aria-label={`Perfil de ${post.autor.nome}`}>
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
                  <Button variant="plain" size="none" type="button" aria-label="Mais ações" className="-mr-1 -mt-1 rounded-md p-1 text-muted-foreground hover:bg-secondary hover:text-foreground">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {post.proprio ? (
                    <DropdownMenuItem onSelect={() => setExcluindo(true)} className="text-destructive"><Trash2 className="h-4 w-4" /> Excluir publicação</DropdownMenuItem>
                  ) : (
                    <>
                      <DropdownMenuItem onSelect={() => setDenunciando(true)}><Flag className="h-4 w-4" /> Denunciar</DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onSelect={bloquearAutor} className="text-destructive"><Ban className="h-4 w-4" /> Bloquear {post.autor.nome}</DropdownMenuItem>
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
              aria-label={curtiu ? `Descurtir (${curtidas} curtidas)` : `Curtir (${curtidas} curtidas)`}
              className={`flex items-center gap-1.5 rounded-md px-2 py-1 text-sm hover:bg-secondary ${curtiu ? "text-destructive" : "hover:text-foreground"}`}>
              <Heart className={`h-4 w-4 ${curtiu ? "fill-current" : ""}`} aria-hidden="true" /> {curtidas > 0 && curtidas}
            </Button>
            <Link to="/comunidades/p/$postId" params={{ postId: post.id }} aria-label={`Responder (${post.respostas} respostas)`}
              className="flex items-center gap-1.5 rounded-md px-2 py-1 text-sm hover:bg-secondary hover:text-foreground">
              <MessageCircle className="h-4 w-4" aria-hidden="true" /> {post.respostas > 0 && post.respostas}
            </Link>
            <Button variant="plain" size="none" type="button" onClick={compartilhar} aria-label="Compartilhar"
              className="flex items-center gap-1.5 rounded-md px-2 py-1 text-sm hover:bg-secondary hover:text-foreground">
              <Share2 className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
          {aviso && <p role="status" className="mt-1 break-all text-xs text-muted-foreground">{aviso}</p>}
        </div>
      </div>

      <ModalDenuncia aberto={denunciando} onFechar={() => setDenunciando(false)} onEnviar={async (m, d) => {
        await denunciarPost(post.id, m, d);
        setAviso("Denúncia enviada. A moderação vai analisar.");
      }} />
      <Modal aberto={excluindo} titulo="Excluir publicação" onFechar={() => setExcluindo(false)}>
        <p className="text-sm text-muted-foreground">A publicação some do feed e do seu perfil. Não dá para desfazer.</p>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setExcluindo(false)}>Cancelar</Button>
          <Button variant="destructive" onClick={async () => {
            try {
              await excluirPost(post.id);
              setExcluindo(false);
              onMudou();
            } catch (e) {
              setAviso(e instanceof Error ? e.message : "Não foi possível excluir.");
              setExcluindo(false);
            }
          }}>Excluir</Button>
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
    if (!motivo) return setErro("Escolha o motivo da denúncia.");
    setEnviando(true);
    try {
      await onEnviar(motivo, detalhes.trim() || undefined);
      setMotivo("");
      setDetalhes("");
      onFechar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível enviar a denúncia.");
    } finally {
      setEnviando(false);
    }
  };
  return (
    <Modal aberto={aberto} titulo="Denunciar publicação" onFechar={onFechar}>
      <div className="space-y-3">
        <Campo rotulo="Motivo" htmlFor="den-motivo" erro={erro}>
          <NativeSelect id="den-motivo" value={motivo} onChange={(e) => { setMotivo(e.target.value as MotivoDenunciaSocial); setErro(""); }}>
            <option value="">Selecione</option>
            {(Object.keys(MOTIVOS_DENUNCIA) as MotivoDenunciaSocial[]).map((m) => <option key={m} value={m}>{MOTIVOS_DENUNCIA[m]}</option>)}
          </NativeSelect>
        </Campo>
        <Campo rotulo="Detalhes (opcional)" htmlFor="den-detalhes">
          <Textarea id="den-detalhes" rows={3} maxLength={500} value={detalhes} onChange={(e) => setDetalhes(e.target.value)} />
        </Campo>
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="ghost" onClick={onFechar} disabled={enviando}>Cancelar</Button>
        <Button onClick={enviar} disabled={enviando}>{enviando ? "Enviando..." : "Enviar denúncia"}</Button>
      </div>
    </Modal>
  );
}
