import { describe, expect, it } from "vitest";
import { faltaDados, lerResultado, sugestoesDisponiveis, type ResumoAnalise } from "@/lib/insights";

const vazio: ResumoAnalise = {
  dataReferencia: "2026-10-13", periodo: "todos", totalEventos: 0, totalInscricoes: 0,
  inscricoesPorMes: {}, inscricoesPorModalidade: {}, inscricoesPorUf: {}, eventos: [],
};

describe("central de análise", () => {
  it("sem eventos não há dados suficientes nem sugestões", () => {
    expect(faltaDados(vazio)).not.toBeNull();
    expect(sugestoesDisponiveis(vazio)).toEqual([]);
  });
  it("só sugere regiões com dois estados ou mais", () => {
    const r = { ...vazio, totalEventos: 1, totalInscricoes: 3, inscricoesPorUf: { SP: 3 } };
    expect(sugestoesDisponiveis(r).some((s) => s.id === "regioes")).toBe(false);
    expect(sugestoesDisponiveis({ ...r, inscricoesPorUf: { SP: 2, PR: 1 } }).some((s) => s.id === "regioes")).toBe(true);
  });
  it("separa observado, evidência e ação", () => {
    const r = lerResultado("## Pontos de atenção\n- Observado: Raposa vazia | Evidência: 0 de 80 vagas | Ação: revisar divulgação");
    expect(r.secoes[0]!.achados[0]).toEqual({ observado: "Raposa vazia", evidencia: "0 de 80 vagas", acao: "revisar divulgação" });
  });
});
