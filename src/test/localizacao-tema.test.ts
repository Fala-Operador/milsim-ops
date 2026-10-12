import { describe, expect, it } from "vitest";
import { aplicarLeituraDoAparelho, buscarLocalidades, CIDADES_BASE, casarLocalidade, temaEfetivo } from "@/lib/localizacao";

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
