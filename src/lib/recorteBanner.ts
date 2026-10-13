// Recortes da imagem principal do evento (banner 21:9 e card 16:9) sem distorção:
// a imagem sempre cobre o quadro, com zoom e posição ajustáveis.
import type { Recorte } from "@/lib/domain/types";

export const FORMATOS = {
  banner: { largura: 1680, altura: 720, rotulo: "Banner da página (21:9)" },
  card: { largura: 1280, altura: 720, rotulo: "Imagem dos cards (16:9)" },
} as const;
export type FormatoRecorte = keyof typeof FORMATOS;

export const RECORTE_INICIAL: Recorte = { zoom: 1, x: 0, y: 0 };
export const ZOOM_MAX = 3;
export const TIPOS_IMAGEM = ["image/jpeg", "image/png", "image/webp"];
export const TAMANHO_MAX_IMAGEM = 10 * 1024 * 1024;

export function erroArquivoImagem(a: { type: string; size: number }): string | null {
  if (!TIPOS_IMAGEM.includes(a.type)) return "Formato inválido. Use JPEG, PNG ou WebP.";
  if (a.size > TAMANHO_MAX_IMAGEM) return "A imagem deve ter no máximo 10 MB.";
  return null;
}

const limitar = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

export function normalizarRecorte(r: Recorte): Recorte {
  return { zoom: limitar(r.zoom, 1, ZOOM_MAX), x: limitar(r.x, -1, 1), y: limitar(r.y, -1, 1) };
}

/** Escala e deslocamento para desenhar a imagem (w×h) num quadro W×H, cobrindo-o. */
export function geometria(w: number, h: number, W: number, H: number, r: Recorte) {
  const { zoom, x, y } = normalizarRecorte(r);
  const escala = Math.max(W / w, H / h) * zoom;
  const dw = w * escala;
  const dh = h * escala;
  return { escala, dw, dh, dx: (W - dw) / 2 - x * ((dw - W) / 2), dy: (H - dh) / 2 - y * ((dh - H) / 2), folgaX: (dw - W) / 2, folgaY: (dh - H) / 2 };
}

export function desenhar(ctx: CanvasRenderingContext2D, img: HTMLImageElement, W: number, H: number, r: Recorte) {
  const g = geometria(img.naturalWidth, img.naturalHeight, W, H, r);
  ctx.clearRect(0, 0, W, H);
  ctx.drawImage(img, g.dx, g.dy, g.dw, g.dh);
}

export function gerarRecorte(img: HTMLImageElement, formato: FormatoRecorte, r: Recorte): string {
  const { largura, altura } = FORMATOS[formato];
  const c = document.createElement("canvas");
  c.width = largura;
  c.height = altura;
  desenhar(c.getContext("2d")!, img, largura, altura, r);
  return c.toDataURL("image/jpeg", 0.85);
}

export function carregarImagem(url: string): Promise<HTMLImageElement> {
  return new Promise((ok, falha) => {
    const i = new Image();
    if (!url.startsWith("data:")) i.crossOrigin = "anonymous";
    i.onload = () => ok(i);
    i.onerror = () => falha(new Error("Não foi possível carregar a imagem."));
    i.src = url;
  });
}
