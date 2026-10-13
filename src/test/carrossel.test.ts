import { describe, expect, it } from "vitest";
import { paginasCarrossel, paginaMaisProxima } from "@/lib/carrossel";

const cards = Array.from({ length: 8 }, (_, i) => ({ left: i * 304, width: 288 }));
describe("Navegação do carrossel", () => {
  it("oculta paginação quando todos os cards cabem", () => {
    expect(paginasCarrossel(cards.slice(0, 3), 1120, 1120)).toEqual([0]);
  });
  it("alinha páginas desktop aos cards e termina no limite", () => {
    expect(paginasCarrossel(cards, 1120, 2416)).toEqual([0, 912, 1296]);
  });
  it("avança um card por página no celular e inclui o fim", () => {
    expect(paginasCarrossel(cards.slice(0, 3), 358, 896)).toEqual([0, 304, 538]);
  });
  it("atualiza a página após deslize livre", () => {
    expect(paginaMaisProxima([0, 304, 538], 500)).toBe(2);
  });
});