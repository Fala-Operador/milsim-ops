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

describe("métricas por evento", async () => {
  const a = await import("@/services/analytics");
  const { indicadores, filtrar } = await import("@/lib/analytics");
  const { storage } = await import("@/lib/storage");
  const limpar = () => {
    ["analytics-registros", "analytics-atribuicao", "analytics-fluxos-abertos", "analytics-clique-pendente", "sessao"].forEach((k) => storage.remover(k));
    storage.gravar("analytics-semeado", true);
    a._reiniciarMemoria();
  };
  const doEvento = (id: string) => filtrar(a.listarRegistros(), { eventoIds: new Set([id]) });
  const insc = (id: string, extra = {}) => ({ id, eventoId: "evt-araucaria", origem: "plataforma", ...extra }) as never;

  it("visita direta não cria clique e repetição imediata (Strict Mode) não duplica", () => {
    limpar();
    a.registrarVisita("evt-araucaria", null);
    a.registrarVisita("evt-araucaria", null);
    const r = doEvento("evt-araucaria");
    expect(r.filter((x) => x.tipo === "visita")).toHaveLength(1);
    expect(r.filter((x) => x.tipo === "clique")).toHaveLength(0);
    expect(r[0]!.origem).toBe("direto");
  });

  it("clique no card atribui a origem até a confirmação, sem duplicar", () => {
    limpar();
    a.registrarClique({ eventoId: "evt-araucaria", origem: "regional", secaoId: "sec-sudeste", posicao: 2 });
    a.registrarVisita("evt-araucaria", null);
    a.registrarInicioInscricao("evt-araucaria");
    a.registrarConfirmacao(insc("i-1"));
    a.registrarConfirmacao(insc("i-1"));
    const r = doEvento("evt-araucaria");
    const conf = r.filter((x) => x.tipo === "inscricao_confirmada");
    expect(conf).toHaveLength(1);
    expect(conf[0]!.origem).toBe("regional");
    const ind = indicadores(r, r);
    expect(ind.conclusao).toBe(100);
    expect(ind.conversao).toBe(100);
  });

  it("cortesia e inclusão administrativa ficam fora das confirmações públicas", () => {
    limpar();
    a.registrarConfirmacao(insc("i-2", { cortesiaId: "c1", origem: "cortesia" }));
    a.registrarConfirmacao(insc("i-3", { origem: "admin" }));
    const ind = indicadores(doEvento("evt-araucaria"), []);
    expect([ind.confirmadas, ind.cortesias, ind.inclusoes]).toEqual([0, 1, 1]);
  });

  it("sem denominador a taxa fica indefinida (sem divisão por zero)", () => {
    expect(indicadores([], []).ctr).toBeNull();
  });
});
