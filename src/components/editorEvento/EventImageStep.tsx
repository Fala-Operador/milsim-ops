import { useEffect, useRef, useState } from "react";
import { Botao, Campo, Entrada } from "@/components/ui";
import { arquivoParaDataUrl } from "@/lib/imagens";
import type { Recorte } from "@/lib/domain/types";
import {
  carregarImagem, desenhar, erroArquivoImagem, FORMATOS, geometria, gerarRecorte, normalizarRecorte,
  RECORTE_INICIAL, ZOOM_MAX, type FormatoRecorte,
} from "@/lib/recorteBanner";
import { Ajuda, inval, MsgErro, type PropsEtapa } from "./comum";

function EditorRecorte({ img, formato, recorte, onChange }: { img: HTMLImageElement; formato: FormatoRecorte; recorte: Recorte; onChange: (r: Recorte) => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const arrasto = useRef<{ x: number; y: number; r: Recorte } | null>(null);
  const { largura, altura, rotulo } = FORMATOS[formato];
  const W = 840;
  const H = Math.round((W * altura) / largura);

  useEffect(() => {
    const c = ref.current;
    if (c) desenhar(c.getContext("2d")!, img, W, H, recorte);
  }, [img, recorte, W, H]);

  const mover = (dxPx: number, dyPx: number, base: Recorte) => {
    const c = ref.current!;
    const fator = W / c.getBoundingClientRect().width;
    const g = geometria(img.naturalWidth, img.naturalHeight, W, H, base);
    onChange(normalizarRecorte({
      ...base,
      x: g.folgaX > 0 ? base.x - (dxPx * fator) / g.folgaX : 0,
      y: g.folgaY > 0 ? base.y - (dyPx * fator) / g.folgaY : 0,
    }));
  };

  return (
    <figure className="space-y-2">
      <figcaption className="text-sm font-medium">{rotulo}</figcaption>
      <canvas
        ref={ref}
        width={W}
        height={H}
        tabIndex={0}
        role="img"
        aria-label={`${rotulo}. Arraste ou use as setas do teclado para reposicionar.`}
        className="w-full cursor-grab touch-none rounded-md border border-border bg-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring active:cursor-grabbing"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          arrasto.current = { x: e.clientX, y: e.clientY, r: recorte };
        }}
        onPointerMove={(e) => {
          const a = arrasto.current;
          if (a) mover(e.clientX - a.x, e.clientY - a.y, a.r);
        }}
        onPointerUp={() => (arrasto.current = null)}
        onPointerCancel={() => (arrasto.current = null)}
        onKeyDown={(e) => {
          const passo = e.shiftKey ? 40 : 10;
          const mapa: Record<string, [number, number]> = { ArrowLeft: [passo, 0], ArrowRight: [-passo, 0], ArrowUp: [0, passo], ArrowDown: [0, -passo] };
          const d = mapa[e.key];
          if (d) {
            e.preventDefault();
            mover(d[0], d[1], recorte);
          }
        }}
      />
      <div className="flex items-center gap-3">
        <label htmlFor={`zoom-${formato}`} className="text-xs text-muted-foreground">Zoom</label>
        <input id={`zoom-${formato}`} type="range" min={1} max={ZOOM_MAX} step={0.05} value={recorte.zoom} className="flex-1 accent-primary"
          onChange={(e) => onChange(normalizarRecorte({ ...recorte, zoom: Number(e.target.value) }))} />
        <Botao type="button" variante="fantasma" onClick={() => onChange(RECORTE_INICIAL)}>Centralizar</Botao>
      </div>
    </figure>
  );
}

export function EtapaImagem({ ev, set, erros, onErro }: PropsEtapa & { onErro: (m: string) => void }) {
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [processando, setProcessando] = useState(false);
  const [arrastando, setArrastando] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const imagem = ev.imagem;
  const ultimoGerado = useRef("");

  useEffect(() => {
    let vivo = true;
    if (!imagem?.originalUrl) return setImg(null);
    carregarImagem(imagem.originalUrl).then((i) => vivo && setImg(i)).catch(() => vivo && onErro("Não foi possível carregar a imagem salva."));
    return () => { vivo = false; };
  }, [imagem?.originalUrl, onErro]);

  // Gera as duas apresentações a partir da mesma original (com espera para não regerar a cada movimento).
  useEffect(() => {
    if (!img || !imagem) return;
    const chave = JSON.stringify([imagem.originalUrl.slice(-64), imagem.banner, imagem.card]);
    if (chave === ultimoGerado.current) return;
    if (!ultimoGerado.current && imagem.bannerUrl && ev.imagemUrl) { ultimoGerado.current = chave; return; } // já gerados ao reabrir
    const t = setTimeout(() => {
      try {
        const card = gerarRecorte(img, "card", imagem.card);
        const banner = gerarRecorte(img, "banner", imagem.banner);
        ultimoGerado.current = chave;
        set("imagemUrl", card);
        set("imagem", { ...imagem, bannerUrl: banner });
      } catch {
        onErro("Não foi possível gerar os recortes desta imagem. Envie o arquivo novamente.");
      }
    }, 500);
    return () => clearTimeout(t);
  }, [img, imagem, ev.imagemUrl, set, onErro]);

  const escolher = async (arquivo: File | undefined) => {
    if (!arquivo) return;
    const msg = erroArquivoImagem(arquivo);
    if (msg) return onErro(msg);
    setProcessando(true);
    try {
      const originalUrl = await arquivoParaDataUrl(arquivo, 2400);
      ultimoGerado.current = "";
      set("imagem", { originalUrl, alt: imagem?.alt ?? "", banner: RECORTE_INICIAL, card: RECORTE_INICIAL, bannerUrl: "" });
      set("imagemUrl", undefined);
    } catch (e) {
      onErro(e instanceof Error ? e.message : "Falha ao ler a imagem.");
    } finally {
      setProcessando(false);
    }
  };

  const recorte = (f: FormatoRecorte, r: Recorte) => imagem && set("imagem", { ...imagem, [f]: r });

  return (
    <div className="space-y-4">
      <div
        onDragOver={(e) => { e.preventDefault(); setArrastando(true); }}
        onDragLeave={() => setArrastando(false)}
        onDrop={(e) => { e.preventDefault(); setArrastando(false); void escolher(e.dataTransfer.files[0]); }}
        className={`rounded-lg border-2 border-dashed p-5 text-center ${arrastando ? "border-primary bg-primary/10" : "border-border bg-elevated"}`}
      >
        <p className="font-display text-sm font-semibold uppercase tracking-wide">{imagem ? "Substituir imagem principal" : "Imagem principal da operação"}</p>
        <p className="mt-1 text-xs text-muted-foreground">Arraste e solte aqui ou selecione um arquivo · JPEG, PNG ou WebP · até 10 MB</p>
        <div className="mt-3 flex flex-wrap justify-center gap-2">
          <input ref={inputRef} id="ev-img-arquivo" type="file" accept="image/jpeg,image/png,image/webp" className="sr-only"
            onChange={(e) => { const a = e.target.files?.[0]; e.target.value = ""; void escolher(a); }} />
          <Botao type="button" variante="contorno" disabled={processando} onClick={() => inputRef.current?.click()}>
            {processando ? "Processando…" : imagem ? "Escolher outra imagem" : "Selecionar arquivo"}
          </Botao>
          {imagem && (
            <Botao type="button" variante="fantasma" onClick={() => { set("imagem", undefined); set("imagemUrl", undefined); }}>Remover imagem</Botao>
          )}
        </div>
        <MsgErro erros={erros} id="ev-img-arquivo" />
        {!imagem && <Ajuda>O rascunho pode ficar sem imagem; para publicar, ela é obrigatória.</Ajuda>}
      </div>

      {imagem && (
        <>
          <Campo rotulo="Texto alternativo" htmlFor="ev-img-alt">
            <Entrada id="ev-img-alt" maxLength={200} placeholder="Ex.: Operadores avançando em mata fechada ao amanhecer" value={imagem.alt}
              onChange={(e) => set("imagem", { ...imagem, alt: e.target.value })} {...inval(erros, "ev-img-alt")} />
            <MsgErro erros={erros} id="ev-img-alt" />
            <Ajuda>Descreve a imagem para quem usa leitor de tela.</Ajuda>
          </Campo>
          {img ? (
            <div className="grid gap-5 xl:grid-cols-[3fr_2fr]">
              <EditorRecorte img={img} formato="banner" recorte={imagem.banner} onChange={(r) => recorte("banner", r)} />
              <EditorRecorte img={img} formato="card" recorte={imagem.card} onChange={(r) => recorte("card", r)} />
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Carregando imagem…</p>
          )}
          {ev.imagemUrl && (
            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Prévia do card</p>
              <div className="w-64 overflow-hidden rounded-lg border border-border bg-card">
                <img src={ev.imagemUrl} alt={imagem.alt} className="aspect-video w-full object-cover" />
                <div className="p-3">
                  <p className="truncate font-display text-sm font-semibold uppercase">{ev.nome || "Nome da operação"}</p>
                  <p className="truncate text-xs text-muted-foreground">{ev.cidade || "Cidade"}/{ev.uf}</p>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
