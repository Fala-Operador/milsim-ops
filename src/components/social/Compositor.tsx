// Caixa de publicação da comunidade geral: até 220 caracteres e até 4 fotos.
// A checagem final (limites e moderação do texto) é do servidor; aqui só antecipamos o aviso.
import { useRef, useState } from "react";
import { ImagePlus, X } from "lucide-react";
import { publicarPost } from "@/api/social.functions";
import { useAuth } from "@/contexts/AuthContext";
import { arquivoParaDataUrl } from "@/lib/imagens";
import { erroPost, LIMITE_POST, MAX_FOTOS, type PostDTO } from "@/lib/comunidadeGeral";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { AvatarAutor } from "./CartaoPost";

export function Compositor({ respondendoA, onPublicado, placeholder }: {
  respondendoA?: string | undefined;
  onPublicado: (post: PostDTO) => void;
  placeholder?: string | undefined;
}) {
  const { usuario } = useAuth();
  const [texto, setTexto] = useState("");
  const [fotos, setFotos] = useState<string[]>([]);
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);
  const entrada = useRef<HTMLInputElement>(null);
  if (!usuario) return null;

  const usados = [...texto].length;
  const restantes = LIMITE_POST - usados;

  const adicionar = async (arquivos: FileList | null) => {
    if (!arquivos) return;
    setErro("");
    const novas: string[] = [];
    for (const a of Array.from(arquivos).slice(0, MAX_FOTOS - fotos.length)) {
      try {
        novas.push(await arquivoParaDataUrl(a, 1600));
      } catch (e) {
        setErro(e instanceof Error ? e.message : "Não foi possível ler a imagem.");
      }
    }
    setFotos((f) => [...f, ...novas].slice(0, MAX_FOTOS));
  };

  const publicar = async () => {
    const lista = fotos.map((dados) => ({ dados }));
    const problema = erroPost(texto, lista);
    if (problema) return setErro(problema);
    setEnviando(true);
    setErro("");
    try {
      const post = await publicarPost({ texto, fotos: lista, respondendoA });
      setTexto("");
      setFotos([]);
      onPublicado(post);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível publicar.");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex gap-3">
        <AvatarAutor nome={usuario.nomeExibicao || usuario.nomeCompleto} fotoUrl={usuario.fotoUrl} />
        <div className="min-w-0 flex-1">
          <Textarea
            aria-label={respondendoA ? "Escreva sua resposta" : "Escreva uma publicação"}
            placeholder={placeholder ?? "O que está rolando no campo?"}
            rows={respondendoA ? 2 : 3}
            value={texto}
            onChange={(e) => { setTexto(e.target.value); setErro(""); }}
            className="resize-none border-0 bg-transparent px-0 text-[15px] shadow-none focus-visible:ring-0"
          />
          {fotos.length > 0 && (
            <ul className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4" aria-label="Fotos selecionadas">
              {fotos.map((f, i) => (
                <li key={i} className="relative">
                  <img src={f} alt={`Foto ${i + 1}`} className="aspect-square w-full rounded-md object-cover" />
                  <Button variant="plain" size="none" type="button" onClick={() => setFotos((l) => l.filter((_, j) => j !== i))}
                    aria-label={`Remover foto ${i + 1}`} className="absolute right-1 top-1 rounded-full bg-background/90 p-1 hover:bg-background">
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
          {erro && <p role="alert" className="mt-2 text-sm text-destructive">{erro}</p>}
          <div className="mt-2 flex items-center justify-between gap-2 border-t border-border pt-2">
            <div>
              <input ref={entrada} type="file" accept="image/jpeg,image/png,image/webp" multiple className="sr-only" tabIndex={-1}
                onChange={(e) => { void adicionar(e.target.files); e.target.value = ""; }} />
              <Button variant="ghost" type="button" disabled={fotos.length >= MAX_FOTOS} onClick={() => entrada.current?.click()}
                aria-label={`Adicionar foto (${fotos.length} de ${MAX_FOTOS})`} className="h-8 px-2 text-accent">
                <ImagePlus className="h-5 w-5" />
              </Button>
            </div>
            <div className="flex items-center gap-3">
              <span aria-live="polite" className={`font-mono text-xs ${restantes < 0 ? "text-destructive" : restantes <= 20 ? "text-warning" : "text-muted-foreground"}`}>
                {restantes}
              </span>
              <Button type="button" onClick={publicar} disabled={enviando || restantes < 0 || (!texto.trim() && fotos.length === 0)}>
                {enviando ? "Publicando..." : respondendoA ? "Responder" : "Publicar"}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
