import { useState } from "react";
import { act, fireEvent, render, screen, cleanup } from "@testing-library/react";
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
    fireEvent.change(view.container.querySelector("#zoom-card") as HTMLInputElement, { target: { value: "1.8" } });
    view.unmount();
    expect(atual.imagemUrl).toBe("card:1.8:0:0");
    expect(atual.imagem?.card.zoom).toBe(1.8);
    expect(atual.imagem?.bannerUrl).toBe("banner-salvo");
    expect(atual.imagem?.banner.zoom).toBe(1);
  });
});