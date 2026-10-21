import { describe, expect, it } from "vitest";
import { deCampoNoFuso, formatarPeriodoNoFuso, instanteNoFuso as instanteAtividade, paraCampoNoFuso, trocarFuso } from "@/lib/fusoHorario";
import { validarEtapa } from "@/lib/eventoEditor";
import { validarParaPublicacao } from "@/services/organizador";

describe("instanteNoFuso", () => {
  it("interpreta data e horário no fuso do evento, independente do fuso do servidor", () => {
    expect(instanteAtividade("2026-11-21", "08:30", "America/Sao_Paulo").toISOString()).toBe("2026-11-21T11:30:00.000Z");
    expect(instanteAtividade("2026-11-21", "08:30", "America/Manaus").toISOString()).toBe("2026-11-21T12:30:00.000Z");
  });

  it("fuso inválido cai em Brasília; data inválida dá NaN", () => {
    expect(instanteAtividade("2026-11-21", "08:30", "Fuso/Invalido").toISOString()).toBe("2026-11-21T11:30:00.000Z");
    expect(Number.isNaN(instanteAtividade("", "08:30", undefined).getTime())).toBe(true);
  });

  it("publicação aceita atividades dentro do período no horário de Brasília", () => {
    const at = (titulo: string, horario: string) => ({ id: titulo, data: "2026-11-21", horario, titulo, descricao: "", ordem: 0 });
    const ev = {
      nome: "x", descricaoResumida: "x", enredo: "x", local: "x", imagemUrl: "x", exercitos: [{}], tipos: [{}],
      inicioEm: "2026-11-21T11:00:00.000Z", fimEm: "2026-11-21T21:00:00.000Z", fuso: "America/Sao_Paulo",
      lotes: [], cronograma: [at("Check-in", "08:30"), at("Game", "09:00"), at("Check-out", "17:59"), at("Tarde demais", "18:30")],
    } as never;
    expect(validarParaPublicacao(ev).filter((m) => m.includes("período"))).toEqual(['Atividade "Tarde demais" fora do período do evento.']);
  });
});

describe("campos de data e hora no fuso do evento", () => {
  it("converte ida e volta do datetime-local no fuso do evento", () => {
    expect(deCampoNoFuso("2026-11-21T08:00", "America/Sao_Paulo")).toBe("2026-11-21T11:00:00.000Z");
    expect(paraCampoNoFuso("2026-11-21T11:00:00.000Z", "America/Sao_Paulo")).toBe("2026-11-21T08:00");
    expect(paraCampoNoFuso("2026-11-21T11:00:00.000Z", "America/Manaus")).toBe("2026-11-21T07:00");
    expect(deCampoNoFuso("", "America/Sao_Paulo")).toBe("");
  });

  it("trocar o fuso mantém a hora digitada", () => {
    expect(trocarFuso("2026-11-21T11:00:00.000Z", "America/Sao_Paulo", "America/Manaus")).toBe("2026-11-21T12:00:00.000Z");
  });
});

describe("datas do editor em relação ao início e término", () => {
  const base = {
    inicioEm: "2026-11-21T11:00:00.000Z", fimEm: "2026-11-21T21:00:00.000Z", fuso: "America/Sao_Paulo", cronograma: [],
    descricaoResumida: "", enredo: "", local: "", exercitos: [], tipos: [],
  };
  const lote = (fimVendas: string, status = "ativo") => ({ id: "l1", nome: "1º lote", inicioVendas: "2026-10-01T12:00:00.000Z", fimVendas, status, itens: [{ tipoId: "t", precoCentavos: 100, quantidade: 1 }] });

  it("lote que vende depois do término da operação é recusado no servidor e no editor", () => {
    const ev = { ...base, nome: "", lotes: [lote("2026-11-22T12:00:00.000Z")] } as never;
    expect(validarParaPublicacao(ev)).toContain('Lote "1º lote": as vendas devem terminar até o término da operação.');
    const probs = validarEtapa({ ...base, tipos: [{ id: "t", nome: "x", precoBaseCentavos: 0, quantidadeMaxima: 1 }], lotes: [lote("2026-11-22T12:00:00.000Z")] } as never, 4);
    expect(probs.find((p) => p.campo === "lt-fim-l1")?.mensagem).toMatch(/até o término da operação \(21\/11\/2026,? 18:00\)/);
  });

  it("lote arquivado e lote que termina no fim da operação passam", () => {
    const ev = { ...base, nome: "", lotes: [lote("2026-11-22T12:00:00.000Z", "arquivado"), { ...lote("2026-11-21T21:00:00.000Z"), id: "l2" }] } as never;
    expect(validarParaPublicacao(ev).filter((m) => m.startsWith("Lote"))).toEqual([]);
  });

  it("rascunho com início no passado é recusado; publicado não", () => {
    const ev = { ...base, inicioEm: "2020-01-01T11:00:00.000Z", fimEm: "2020-01-01T21:00:00.000Z", local: "x", cidade: "x" };
    expect(validarEtapa({ ...ev, status: "rascunho" } as never, 1).map((p) => p.campo)).toContain("ev-ini");
    expect(validarEtapa({ ...ev, status: "publicado" } as never, 1).map((p) => p.campo)).not.toContain("ev-ini");
  });
});

describe("formatarPeriodoNoFuso", () => {
  it("mesmo dia mostra a data uma vez; dias diferentes mostram as duas", () => {
    expect(formatarPeriodoNoFuso("2026-11-21T11:00:00.000Z", "2026-11-21T13:00:00.000Z", "America/Sao_Paulo")).toBe("21/11/2026 Início às 08:00, fim às 10:00");
    expect(formatarPeriodoNoFuso("2026-11-21T11:00:00.000Z", "2026-11-22T13:00:00.000Z", "America/Sao_Paulo")).toBe("Início em 21/11/2026 às 08:00, fim em 22/11/2026 às 10:00");
  });
});
