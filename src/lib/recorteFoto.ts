import { tr } from "@/i18n/lib/recorteFoto";
// Geometria do recorte da foto de perfil (regras puras, sem DOM).
// A foto é desenhada centralizada numa área quadrada de lado `lado`, girada, espelhada,
// ampliada pelo zoom e deslocada pelo arraste. A escala base garante que a imagem
// sempre cubra a área inteira (sem bordas vazias), e o deslocamento é limitado a isso.

export const ZOOM_MINIMO = 1;
export const ZOOM_MAXIMO = 4;
export const LADO_SAIDA = 512; // pixels da foto final (quadrada)

export type Rotacao = 0 | 90 | 180 | 270;

export interface Ajustes {
  zoom: number;
  rotacao: Rotacao;
  espelhar: boolean;
  /** Deslocamento em frações do lado da área (independe do tamanho da tela). */
  dx: number;
  dy: number;
  brilho: number; // 100 = original
  contraste: number; // 100 = original
}

export const AJUSTES_INICIAIS: Ajustes = { zoom: 1, rotacao: 0, espelhar: false, dx: 0, dy: 0, brilho: 100, contraste: 100 };

/** Dimensões da imagem depois da rotação. */
export function dimensoesGiradas(largura: number, altura: number, rotacao: Rotacao) {
  return rotacao === 90 || rotacao === 270 ? { largura: altura, altura: largura } : { largura, altura };
}

/** Escala que faz a imagem (girada) cobrir exatamente a área quadrada. */
export function escalaBase(largura: number, altura: number, rotacao: Rotacao, lado: number): number {
  const g = dimensoesGiradas(largura, altura, rotacao);
  return Math.max(lado / g.largura, lado / g.altura);
}

/** Maior deslocamento permitido em cada eixo, em frações do lado da área. */
export function deslocamentoMaximo(largura: number, altura: number, a: Pick<Ajustes, "zoom" | "rotacao">) {
  const g = dimensoesGiradas(largura, altura, a.rotacao);
  const k = escalaBase(largura, altura, a.rotacao, 1) * a.zoom;
  return { x: Math.max(0, (g.largura * k - 1) / 2), y: Math.max(0, (g.altura * k - 1) / 2) };
}

const limitar = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

/** Normaliza os ajustes: zoom dentro dos limites e imagem sempre cobrindo a área. */
export function normalizarAjustes(largura: number, altura: number, a: Ajustes): Ajustes {
  const zoom = limitar(a.zoom, ZOOM_MINIMO, ZOOM_MAXIMO);
  const max = deslocamentoMaximo(largura, altura, { zoom, rotacao: a.rotacao });
  return {
    ...a,
    zoom,
    dx: limitar(a.dx, -max.x, max.x),
    dy: limitar(a.dy, -max.y, max.y),
    brilho: limitar(a.brilho, 50, 150),
    contraste: limitar(a.contraste, 50, 150),
  };
}

export const proximaRotacao = (r: Rotacao): Rotacao => (((r + 90) % 360) as Rotacao);

/** Mínimo de operações de canvas usado pela prévia e pela exportação. */
export interface ContextoDesenho {
  clearRect(x: number, y: number, w: number, h: number): void;
  save(): void;
  restore(): void;
  translate(x: number, y: number): void;
  rotate(angulo: number): void;
  scale(x: number, y: number): void;
  drawImage(img: CanvasImageSource, x: number, y: number, w: number, h: number): void;
  filter: string;
}

/** Desenha a foto ajustada num quadrado de `lado` pixels (mesma conta na prévia e na saída). */
export function desenharRecorte(
  ctx: ContextoDesenho,
  img: CanvasImageSource & { naturalWidth: number; naturalHeight: number },
  a: Ajustes,
  lado: number,
): void {
  const w = img.naturalWidth;
  const h = img.naturalHeight;
  const k = escalaBase(w, h, a.rotacao, lado) * a.zoom;
  ctx.clearRect(0, 0, lado, lado);
  ctx.save();
  ctx.filter = `brightness(${a.brilho}%) contrast(${a.contraste}%)`;
  ctx.translate(lado / 2 + a.dx * lado, lado / 2 + a.dy * lado);
  ctx.rotate((a.rotacao * Math.PI) / 180);
  ctx.scale(a.espelhar ? -1 : 1, 1);
  ctx.drawImage(img, (-w * k) / 2, (-h * k) / 2, w * k, h * k);
  ctx.restore();
}

export const TIPOS_FOTO = ["image/jpeg", "image/png", "image/webp"];
const TAMANHO_MAXIMO_ARQUIVO = 15 * 1024 * 1024;

/** Valida o arquivo escolhido antes de abrir o editor; devolve a mensagem de erro, se houver. */
export function erroArquivoFoto(arquivo: { type: string; size: number }): string | null {
  if (!TIPOS_FOTO.includes(arquivo.type)) return tr("formato_de_foto_invalido_use_jpg");
  if (arquivo.size > TAMANHO_MAXIMO_ARQUIVO) return tr("a_foto_deve_ter_no_maximo");
  return null;
}
