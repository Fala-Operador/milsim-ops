import { describe, expect, it } from "vitest";
import { sinalPedeAtualizacao } from "@/services/tempoReal";

describe("sinal de versão do tempo real", () => {
  it("só pede nova busca para versão além da que a tela já tem", () => {
    expect(sinalPedeAtualizacao(11, 10)).toBe(true);
    expect(sinalPedeAtualizacao(10, 10)).toBe(false); // a própria gravação já trouxe esta visão
    expect(sinalPedeAtualizacao(9, 10)).toBe(false);
  });

  it("ignora sinal malformado", () => {
    expect(sinalPedeAtualizacao("11", 10)).toBe(false);
    expect(sinalPedeAtualizacao(undefined, 10)).toBe(false);
    expect(sinalPedeAtualizacao(Number.NaN, 10)).toBe(false);
  });
});
