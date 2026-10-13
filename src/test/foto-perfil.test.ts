// Foto de perfil: geometria do recorte e regra de gravação.
import { describe, it, expect, beforeEach } from "vitest";
import {
  AJUSTES_INICIAIS, ZOOM_MAXIMO, deslocamentoMaximo, desenharRecorte, escalaBase, normalizarAjustes, proximaRotacao,
  type ContextoDesenho,
} from "@/lib/recorteFoto";
import { definirFoto } from "@/services/conta";
import { carregarBase } from "@/services/db";
import { restaurarBase } from "@/test/baseTeste";

describe("geometria do recorte", () => {
  it("escala base cobre a área pelo lado menor da imagem", () => {
    expect(escalaBase(1000, 500, 0, 100)).toBeCloseTo(0.2); // altura manda
    expect(escalaBase(500, 1000, 0, 100)).toBeCloseTo(0.2); // largura manda
    expect(escalaBase(1000, 500, 90, 100)).toBeCloseTo(0.2); // girada: dimensões trocam
  });

  it("sem zoom, imagem paisagem só desliza na horizontal", () => {
    const max = deslocamentoMaximo(1000, 500, { zoom: 1, rotacao: 0 });
    expect(max.x).toBeCloseTo(0.5);
    expect(max.y).toBe(0);
  });

  it("girar 90° troca o eixo livre", () => {
    const max = deslocamentoMaximo(1000, 500, { zoom: 1, rotacao: 90 });
    expect(max.x).toBe(0);
    expect(max.y).toBeCloseTo(0.5);
  });

  it("normaliza zoom e nunca deixa borda vazia", () => {
    const a = normalizarAjustes(800, 800, { ...AJUSTES_INICIAIS, zoom: 10, dx: 5, dy: -5, brilho: 300 });
    expect(a.zoom).toBe(ZOOM_MAXIMO);
    const max = deslocamentoMaximo(800, 800, a);
    expect(a.dx).toBeCloseTo(max.x);
    expect(a.dy).toBeCloseTo(-max.y);
    expect(a.brilho).toBe(150);
    const semZoom = normalizarAjustes(800, 800, { ...AJUSTES_INICIAIS, zoom: 0.2, dx: 0.3 });
    expect([semZoom.zoom, semZoom.dx]).toEqual([1, 0]);
  });

  it("rotação cicla em passos de 90°", () => {
    expect([proximaRotacao(0), proximaRotacao(90), proximaRotacao(270)]).toEqual([90, 180, 0]);
  });

  it("desenho centraliza, gira, espelha e aplica filtros", () => {
    const chamadas: string[] = [];
    const ctx: ContextoDesenho = {
      filter: "",
      clearRect: () => chamadas.push("clear"),
      save: () => chamadas.push("save"),
      restore: () => chamadas.push("restore"),
      translate: (x, y) => chamadas.push(`translate ${x} ${y}`),
      rotate: (a) => chamadas.push(`rotate ${a.toFixed(3)}`),
      scale: (x, y) => chamadas.push(`scale ${x} ${y}`),
      drawImage: (_i, x, y, w, h) => chamadas.push(`draw ${x} ${y} ${w} ${h}`),
    };
    const img = { naturalWidth: 200, naturalHeight: 100 } as unknown as HTMLImageElement;
    desenharRecorte(ctx, img, { ...AJUSTES_INICIAIS, rotacao: 90, espelhar: true, dx: 0.1, brilho: 120 }, 100);
    expect(ctx.filter).toBe("brightness(120%) contrast(100%)");
    expect(chamadas).toContain("translate 60 50");
    expect(chamadas).toContain(`rotate ${(Math.PI / 2).toFixed(3)}`);
    expect(chamadas).toContain("scale -1 1");
    expect(chamadas).toContain("draw -100 -50 200 100"); // girada 100x200 cobre 100x100 com escala 1
  });
});

describe("gravação da foto", () => {
  beforeEach(() => restaurarBase());
  const eu = () => carregarBase().usuarios.find((u) => u.id === "usr-participante")!;

  it("aceita data URL de imagem e remove com null", () => {
    definirFoto(eu(), "data:image/jpeg;base64,/9j/4AAQ");
    expect(eu().fotoUrl).toBe("data:image/jpeg;base64,/9j/4AAQ");
    definirFoto(eu(), null);
    expect(eu().fotoUrl).toBeUndefined();
  });

  it("recusa URL externa, SVG e arquivos que não são imagem", () => {
    expect(() => definirFoto(eu(), "https://exemplo.com/rastreio.png")).toThrow(/Formato/);
    expect(() => definirFoto(eu(), "data:image/svg+xml;base64,PHN2Zz4=")).toThrow(/Formato/);
    expect(() => definirFoto(eu(), "data:application/pdf;base64,JVBER")).toThrow(/Formato/);
  });
});
