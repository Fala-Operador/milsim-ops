import { useState } from "react";
import { act, fireEvent, render, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Evento } from "@/lib/domain/types";
import { eventoVazio } from "@/components/editorEvento/eventoVazio";
import { EtapaImagem } from "@/components/editorEvento/EventImageStep";

vi.mock("@/lib/recorteBanner", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/recorteBanner")>();
  return {
    ...original,
    carregarImagem: vi.fn(async () => ({ naturalWidth: 1600, naturalHeight: 900 })),
    desenhar: vi.fn(),
    gerarRecorte: vi.fn((_img, formato, r) => `${formato}:${r.zoom}:${r.x}:${r.y}`),
  };
});

afterEach(cleanup);

// Aumenta o zoom em um salto do teclado (PageUp = 10 passos de 0,05), como a pessoa faria.
const aumentarZoom = (id: string) => fireEvent.keyDown(document.getElementById(id) as HTMLElement, { key: "PageUp" });

describe("recortes do editor", () => {
  it("guarda o novo recorte imediatamente antes de sair da etapa, sem alterar o outro formato", async () => {
    let atual: Evento = {
      ...eventoVazio("org-teste"), imagemUrl: "card-salvo",
      imagem: { originalUrl: "https://example.com/original.jpg", alt: "Operadores", bannerUrl: "banner-salvo", banner: { zoom: 1, x: 0, y: 0 }, card: { zoom: 1, x: 0, y: 0 } },
    };
    function Editor() {
      const [ev, setEv] = useState(atual);
      return <EtapaImagem ev={ev} erros={{}} onErro={() => {}} set={(k, v) => setEv((prev) => { atual = { ...prev, [k]: v }; return atual; })} />;
    }
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({} as CanvasRenderingContext2D);
    const view = render(<Editor />);
    await act(async () => {});
    aumentarZoom("zoom-card");
    view.unmount();
    expect(atual.imagemUrl).toBe("card:1.5:0:0");
    expect(atual.imagem?.card.zoom).toBe(1.5);
    expect(atual.imagem?.bannerUrl).toBe("banner-salvo");
    expect(atual.imagem?.banner.zoom).toBe(1);
  });
  it("guarda o banner antes de avançar rapidamente e o restaura sem substituir a imagem do card", async () => {
    let atual: Evento = {
      ...eventoVazio("org-teste"), cep: "13300-000", imagemUrl: "card-salvo",
      imagem: { originalUrl: "https://example.com/original.jpg", alt: "Operadores", bannerUrl: "banner-salvo", banner: { zoom: 1, x: 0, y: 0 }, card: { zoom: 1.8, x: 0.2, y: 0.3 } },
    };
    function Editor() {
      const [ev, setEv] = useState(atual);
      return <EtapaImagem ev={ev} erros={{}} onErro={() => {}} set={(k, v) => setEv((prev) => { atual = { ...prev, [k]: v }; return atual; })} />;
    }
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({} as CanvasRenderingContext2D);
    const view = render(<Editor />);
    await act(async () => {});
    aumentarZoom("zoom-banner");
    view.unmount();
    expect(atual.imagem?.bannerUrl).toBe("banner:1.5:0:0");
    expect(atual.imagemUrl).toBe("card-salvo");
    expect(atual.imagem?.card).toEqual({ zoom: 1.8, x: 0.2, y: 0.3 });
    expect(atual.cep).toBe("13300-000");
    const reaberto = render(<Editor />);
    await act(async () => {});
    expect(reaberto.container.querySelector("#zoom-banner")).toHaveAttribute("aria-valuenow", "1.5");
    expect(reaberto.container.querySelector("#zoom-card")).toHaveAttribute("aria-valuenow", "1.8");
  });
});