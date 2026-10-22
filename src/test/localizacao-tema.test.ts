import { describe, expect, it } from "vitest";
import { aplicarLeituraDoAparelho, buscarEstados, buscarLocalidades, CIDADES_BASE, casarLocalidade, filtrarEventos, paraEstado, rotuloCurto, temaEfetivo } from "@/lib/localizacao";
import type { Evento } from "@/lib/domain/types";

describe("tema", () => {
  it("visitante sempre usa o escuro", () => {
    expect(temaEfetivo(false, "light")).toBe("dark");
  });
  it("conta sem preferência usa o escuro", () => {
    expect(temaEfetivo(true, undefined)).toBe("dark");
  });
  it("conta com TAN usa o claro", () => {
    expect(temaEfetivo(true, "light")).toBe("light");
  });
});

describe("localização", () => {
  const manual = { modo: "manual" as const, local: { escopo: "cidade" as const, cidade: "Itu", uf: "SP" } };
  const lido = { escopo: "cidade" as const, cidade: "Campinas", uf: "SP" };
  it("leitura automática não sobrescreve escolha manual", () => {
    expect(aplicarLeituraDoAparelho(manual, lido, false)).toEqual(manual);
  });
  it("ação explícita volta para a localização atual", () => {
    expect(aplicarLeituraDoAparelho(manual, lido, true)).toEqual({ modo: "atual", local: lido });
  });
  it("busca ignora acentos e aceita UF", () => {
    expect(buscarLocalidades(CIDADES_BASE, "sao jose")[0]).toEqual({ cidade: "São José dos Campos", uf: "SP" });
    expect(buscarLocalidades(CIDADES_BASE, "pr").every((l) => l.uf === "PR")).toBe(true);
  });
  it("cidade do aparelho usa a grafia conhecida", () => {
    expect(casarLocalidade(CIDADES_BASE, "Sao Paulo", "SP").cidade).toBe("São Paulo");
  });
});

describe("filtro por estado", () => {
  it("busca estado por nome sem acento ou por UF", () => {
    expect(buscarEstados("sao paulo")[0]).toEqual({ uf: "SP", nome: "São Paulo" });
    expect(buscarEstados("rj")[0]?.uf).toBe("RJ");
    expect(buscarEstados("")).toHaveLength(27);
  });
  it("local salvo por cidade vira o estado dela", () => {
    expect(paraEstado({ escopo: "cidade", cidade: "Itu", uf: "SP" })).toEqual({ escopo: "estado", uf: "SP" });
    expect(paraEstado({ escopo: "nacional" })).toEqual({ escopo: "nacional" });
  });
  it("estado mostra eventos de todas as cidades dele e nenhum de fora", () => {
    const ev = (id: string, cidade: string, uf: string) => ({ id, nome: id, cidade, uf, organizacaoId: "o", inicioEm: "2030-01-01T00:00:00Z" }) as unknown as Evento;
    const r = filtrarEventos([ev("a", "Itu", "SP"), ev("b", "Campinas", "SP"), ev("c", "Niterói", "RJ")], { escopo: "estado", uf: "SP" }, { busca: "", periodo: "" }, () => "", new Date("2029-01-01"));
    expect(r.map((e) => e.id)).toEqual(["a", "b"]);
  });
  it("rótulo mostra o nome do estado", () => {
    expect(rotuloCurto({ escopo: "estado", uf: "MG" })).toBe("Minas Gerais (MG)");
  });
});
