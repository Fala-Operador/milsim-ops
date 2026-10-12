import { beforeEach, describe, expect, it } from "vitest";
import { carregarBase, restaurarBase, mutarBase } from "@/services/db";
import { linkWhatsapp, montarPaginaInicial, normalizarInstagram, validarUrlExterna, NACIONAL } from "@/lib/divulgacao";
import { salvarParceiro } from "@/services/divulgacao";

class LS {
  private m = new Map<string, string>();
  get length() { return this.m.size; }
  key(i: number) { return [...this.m.keys()][i] ?? null; }
  getItem(k: string) { return this.m.get(k) ?? null; }
  setItem(k: string, v: string) { this.m.set(k, v); }
  removeItem(k: string) { this.m.delete(k); }
}
Object.defineProperty(globalThis, "window", { value: { localStorage: new LS() }, configurable: true });

const ids = (secId: string, local = NACIONAL) =>
  montarPaginaInicial(carregarBase(), local, new Date()).find((s) => s.secao.id === secId)?.eventos.map((e) => e.evento.id) ?? [];

describe("página inicial e divulgação", () => {
  beforeEach(() => restaurarBase());

  it("evento cancelado sai dos destaques públicos, mas a configuração é preservada", () => {
    expect(ids("sec-destaques")).toContain("evt-serra-verde");
    mutarBase((b) => { b.eventos.find((e) => e.id === "evt-serra-verde")!.status = "cancelado"; });
    expect(ids("sec-destaques")).not.toContain("evt-serra-verde");
    expect(carregarBase().secoesInicio.find((s) => s.id === "sec-destaques")!.destaques.some((d) => d.eventoId === "evt-serra-verde")).toBe(true);
  });

  it("seção fora do período agendado não aparece", () => {
    mutarBase((b) => { b.secoesInicio.find((s) => s.id === "sec-destaques")!.agendamento = { inicioEm: new Date(Date.now() + 86400000).toISOString() }; });
    expect(ids("sec-destaques")).toEqual([]);
  });

  it("filtro Nordeste mostra só seções nacionais e do Nordeste", () => {
    const secoes = montarPaginaInicial(carregarBase(), { escopo: "regiao", regiao: "Nordeste" }, new Date()).map((s) => s.secao.id);
    expect(secoes).toContain("sec-nordeste");
    expect(secoes).not.toContain("sec-sudeste");
  });

  it("rascunho não aparece na página pública", () => {
    expect(montarPaginaInicial(carregarBase(), NACIONAL, new Date()).some((s) => s.secao.id === "sec-sp")).toBe(false);
  });

  it("rejeita javascript: e aceita http/https", () => {
    expect(validarUrlExterna("javascript:alert(1)")).toBeNull();
    expect(validarUrlExterna("exemplo.com.br")).toBe("https://exemplo.com.br/");
  });

  it("normaliza Instagram e WhatsApp", () => {
    expect(normalizarInstagram("@perfil.x")).toBe("https://www.instagram.com/perfil.x/");
    expect(linkWhatsapp("+55 (11) 99999-0000", "Olá!")).toBe("https://wa.me/5511999990000?text=Ol%C3%A1!");
  });

  it("organizador não pode cadastrar parceiros", async () => {
    const org = carregarBase().usuarios.find((u) => u.perfil === "organizador")!;
    await expect(salvarParceiro(org, { nome: "X", tipo: "apoiador", textoAlt: "", links: [], ativo: true })).rejects.toThrow();
  });
});

describe("métricas de divulgação", async () => {
  const m = await import("@/services/metricas");
  it("clique no destaque seguido da página do evento conta uma visita", () => {
    m.limparMetricas();
    m.registrarVisualizacao("sec-destaques");
    m.registrarCliqueEvento("sec-destaques", "evt-serra-verde");
    m.confirmarVisitaEvento("evt-serra-verde");
    m.confirmarVisitaEvento("evt-serra-verde"); // recarregar não conta de novo
    const r = m.resumirMetricas(m.listarMetricas());
    expect(r.total).toEqual({ v: 1, c: 1, i: 1 });
  });
});
