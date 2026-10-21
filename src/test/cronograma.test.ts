import { describe, expect, it } from "vitest";
import { instanteAtividade } from "@/lib/cronograma";
import { validarParaPublicacao } from "@/services/organizador";

describe("instanteAtividade", () => {
  it("interpreta data e horário no fuso do evento, independente do fuso do servidor", () => {
    expect(instanteAtividade("2026-11-21", "08:30", "America/Sao_Paulo").toISOString()).toBe("2026-11-21T11:30:00.000Z");
    expect(instanteAtividade("2026-11-21", "08:30", "America/Manaus").toISOString()).toBe("2026-11-21T12:30:00.000Z");
  });

  it("fuso inválido cai em Brasília; data inválida dá NaN", () => {
    expect(instanteAtividade("2026-11-21", "08:30", "Fuso/Invalido").toISOString()).toBe("2026-11-21T11:30:00.000Z");
    expect(Number.isNaN(instanteAtividade("", "08:30").getTime())).toBe(true);
  });

  it("publicação aceita atividades dentro do período no horário de Brasília", () => {
    const at = (titulo: string, horario: string) => ({ id: titulo, data: "2026-11-21", horario, titulo, descricao: "", ordem: 0 });
    const ev = {
      nome: "x", descricaoResumida: "x", enredo: "x", local: "x", imagemUrl: "x", exercitos: [{}], tipos: [{}],
      inicioEm: "2026-11-21T11:00:00.000Z", fimEm: "2026-11-21T21:00:00.000Z", fuso: "America/Sao_Paulo",
      cronograma: [at("Check-in", "08:30"), at("Game", "09:00"), at("Check-out", "17:59"), at("Tarde demais", "18:30")],
    } as never;
    expect(validarParaPublicacao(ev).filter((m) => m.includes("período"))).toEqual(['Atividade "Tarde demais" fora do período do evento.']);
  });
});
