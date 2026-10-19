// Editor da foto de perfil: recorte circular com arraste, zoom (botões, controle deslizante,
// roda do mouse e pinça), girar, espelhar, brilho e contraste. Gera um JPEG quadrado de
// 512 px; o servidor envia ao Storage. Teclado: setas movem, + e − ajustam o zoom.
import { useEffect, useRef, useState } from "react";
import { FlipHorizontal2, RotateCw, ZoomIn, ZoomOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui";
import {
  AJUSTES_INICIAIS, LADO_SAIDA, ZOOM_MAXIMO, ZOOM_MINIMO, desenharRecorte, normalizarAjustes, proximaRotacao,
  type Ajustes,
} from "@/lib/recorteFoto";
import { Slider } from "@/components/ui/slider";

const LADO_PREVIA = 288; // px na tela (cabe em celulares de 320 px)
const PASSO_TECLADO = 0.02;

export function EditorFoto({ arquivo, onConfirmar, onCancelar }: {
  arquivo: File;
  onConfirmar: (dataUrl: string) => Promise<void> | void;
  onCancelar: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const areaRef = useRef<HTMLDivElement>(null);
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [ajustes, setAjustes] = useState<Ajustes>(AJUSTES_INICIAIS);
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);
  const ponteiros = useRef(new Map<number, { x: number; y: number }>());
  const pinca = useRef<number | null>(null);

  const ajustar = (mudar: (a: Ajustes) => Ajustes) =>
    setAjustes((a) => (img ? normalizarAjustes(img.naturalWidth, img.naturalHeight, mudar(a)) : a));

  // Carrega o arquivo escolhido.
  useEffect(() => {
    let ativo = true; // ignora o carregamento cancelado (ex.: montagem dupla do Strict Mode)
    const url = URL.createObjectURL(arquivo);
    const i = new Image();
    i.onload = () => { if (ativo) { setErro(""); setImg(i); } };
    i.onerror = () => { if (ativo) setErro("Não foi possível abrir esta imagem."); };
    i.src = url;
    return () => {
      ativo = false;
      URL.revokeObjectURL(url);
    };
  }, [arquivo]);

  // Prévia: mesma rotina de desenho da foto final, na resolução da tela.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !img) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = LADO_PREVIA * dpr;
    canvas.height = LADO_PREVIA * dpr;
    const ctx = canvas.getContext("2d");
    if (ctx) desenharRecorte(ctx, img, ajustes, LADO_PREVIA * dpr);
  }, [img, ajustes]);

  // Roda do mouse (listener nativo para poder impedir a rolagem da página).
  useEffect(() => {
    const area = areaRef.current;
    if (!area) return;
    const aoRolar = (e: WheelEvent) => {
      e.preventDefault();
      ajustar((a) => ({ ...a, zoom: a.zoom * (e.deltaY < 0 ? 1.08 : 1 / 1.08) }));
    };
    area.addEventListener("wheel", aoRolar, { passive: false });
    return () => area.removeEventListener("wheel", aoRolar);
  });

  const distancia = () => {
    const [p1, p2] = [...ponteiros.current.values()];
    return p1 && p2 ? Math.hypot(p1.x - p2.x, p1.y - p2.y) : 0;
  };

  const aoPressionar = (e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    ponteiros.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    pinca.current = ponteiros.current.size === 2 ? distancia() : null;
  };
  const aoMover = (e: React.PointerEvent) => {
    const anterior = ponteiros.current.get(e.pointerId);
    if (!anterior) return;
    ponteiros.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (ponteiros.current.size === 2 && pinca.current) {
      const atual = distancia();
      const fator = atual / pinca.current;
      pinca.current = atual;
      ajustar((a) => ({ ...a, zoom: a.zoom * fator }));
    } else if (ponteiros.current.size === 1) {
      const dx = (e.clientX - anterior.x) / LADO_PREVIA;
      const dy = (e.clientY - anterior.y) / LADO_PREVIA;
      ajustar((a) => ({ ...a, dx: a.dx + dx, dy: a.dy + dy }));
    }
  };
  const aoSoltar = (e: React.PointerEvent) => {
    ponteiros.current.delete(e.pointerId);
    pinca.current = null;
  };

  const aoTeclar = (e: React.KeyboardEvent) => {
    const mapa: Record<string, (a: Ajustes) => Ajustes> = {
      ArrowLeft: (a) => ({ ...a, dx: a.dx - PASSO_TECLADO }),
      ArrowRight: (a) => ({ ...a, dx: a.dx + PASSO_TECLADO }),
      ArrowUp: (a) => ({ ...a, dy: a.dy - PASSO_TECLADO }),
      ArrowDown: (a) => ({ ...a, dy: a.dy + PASSO_TECLADO }),
      "+": (a) => ({ ...a, zoom: a.zoom + 0.1 }),
      "=": (a) => ({ ...a, zoom: a.zoom + 0.1 }),
      "-": (a) => ({ ...a, zoom: a.zoom - 0.1 }),
    };
    const acao = mapa[e.key];
    if (!acao) return;
    e.preventDefault();
    ajustar(acao);
  };

  const confirmar = async () => {
    if (!img) return;
    setErro("");
    setSalvando(true);
    try {
      const saida = document.createElement("canvas");
      saida.width = LADO_SAIDA;
      saida.height = LADO_SAIDA;
      const ctx = saida.getContext("2d");
      if (!ctx) throw new Error("Seu navegador não permitiu editar a imagem.");
      desenharRecorte(ctx, img, ajustes, LADO_SAIDA);
      await onConfirmar(saida.toDataURL("image/jpeg", 0.88));
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível salvar a foto.");
      setSalvando(false);
    }
  };

  const deslizante = (rotulo: string, valor: number, min: number, max: number, passo: number, mudar: (v: number) => void, texto: string) => (
    <div className="block text-sm">
      <span className="flex justify-between text-xs text-muted-foreground"><span>{rotulo}</span><span>{texto}</span></span>
      <Slider className="w-full" min={min} max={max} step={passo} value={[valor]}
        onValueChange={([v]) => v !== undefined && mudar(v)} aria-label={rotulo} />
    </div>
  );

  return (
    <Modal aberto titulo="Ajustar foto de perfil" onFechar={salvando ? () => {} : onCancelar}>
      <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
        <div className="shrink-0">
          <div
            ref={areaRef}
            role="application"
            tabIndex={0}
            aria-label="Área de recorte: arraste para posicionar, use + e − para zoom e as setas para mover"
            className="relative cursor-grab touch-none select-none overflow-hidden rounded-md bg-secondary outline-none focus-visible:ring-2 focus-visible:ring-ring active:cursor-grabbing"
            style={{ width: LADO_PREVIA, height: LADO_PREVIA }}
            onPointerDown={aoPressionar}
            onPointerMove={aoMover}
            onPointerUp={aoSoltar}
            onPointerCancel={aoSoltar}
            onKeyDown={aoTeclar}
          >
            <canvas ref={canvasRef} style={{ width: LADO_PREVIA, height: LADO_PREVIA }} />
            {/* Máscara: escurece o que fica fora do círculo exibido no perfil */}
            <div aria-hidden="true" className="pointer-events-none absolute inset-0" style={{ background: "radial-gradient(circle closest-side, transparent 98.5%, rgba(0,0,0,0.6) 100%)" }} />
            <div aria-hidden="true" className="pointer-events-none absolute inset-0 rounded-full ring-2 ring-white/80" />
            {!img && !erro && <p className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">Carregando…</p>}
          </div>
          <p className="mt-2 text-center text-xs text-muted-foreground">Arraste para posicionar · role ou faça pinça para o zoom</p>
        </div>

        <div className="w-full space-y-3">
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" aria-label="Diminuir zoom" onClick={() => ajustar((a) => ({ ...a, zoom: a.zoom - 0.2 }))}><ZoomOut className="h-4 w-4" /></Button>
            <div className="flex-1">
              {deslizante("Zoom", ajustes.zoom, ZOOM_MINIMO, ZOOM_MAXIMO, 0.01, (v) => ajustar((a) => ({ ...a, zoom: v })), `${Math.round(ajustes.zoom * 100)}%`)}
            </div>
            <Button type="button" variant="outline" aria-label="Aumentar zoom" onClick={() => ajustar((a) => ({ ...a, zoom: a.zoom + 0.2 }))}><ZoomIn className="h-4 w-4" /></Button>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={() => ajustar((a) => ({ ...a, rotacao: proximaRotacao(a.rotacao) }))}>
              <RotateCw className="mr-1 inline h-4 w-4" /> Girar
            </Button>
            <Button type="button" variant={ajustes.espelhar ? "secondary" : "outline"} aria-pressed={ajustes.espelhar} onClick={() => ajustar((a) => ({ ...a, espelhar: !a.espelhar }))}>
              <FlipHorizontal2 className="mr-1 inline h-4 w-4" /> Espelhar
            </Button>
            <Button type="button" variant="ghost" onClick={() => setAjustes(AJUSTES_INICIAIS)}>Redefinir</Button>
          </div>
          {deslizante("Brilho", ajustes.brilho, 50, 150, 1, (v) => ajustar((a) => ({ ...a, brilho: v })), `${ajustes.brilho}%`)}
          {deslizante("Contraste", ajustes.contraste, 50, 150, 1, (v) => ajustar((a) => ({ ...a, contraste: v })), `${ajustes.contraste}%`)}
          {erro && <p role="alert" className="text-sm text-destructive">{erro}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={onCancelar} disabled={salvando}>Cancelar</Button>
            <Button type="button" onClick={confirmar} disabled={!img || salvando}>{salvando ? "Salvando..." : "Usar esta foto"}</Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
