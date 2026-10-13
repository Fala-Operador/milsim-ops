import { describe, expect, it } from "vitest";
import {
  criarPreferencia, erroModalidadeParaPublicar, filtrarPorModalidades, normalizarPreferencia, ordenarEventos,
  resolverAoEntrar, separarPorPreferencia, PREF_PENDENTE, type ModalidadeId,
} from "@/lib/modalidades";

const ev = (id: string, modalidade: ModalidadeId | undefined, dia: number, criado = 0) => ({
  id, modalidade, inicioEm: new Date(2026, 10, dia).toISOString(), criadoEm: new Date(2026, 0, criado + 1).toISOString(),
});
const lista = [ev("a", "milsim", 20, 1), ev("b", "sar", 10, 5), ev("c", undefined, 5, 3), ev("d", "milsim", 8, 2)];
const favMilsim = criarPreferencia(["milsim"]);

describe("modalidades", () => {
  it("publicação exige modalidade; rascunho não é validado aqui", () => {
    expect(erroModalidadeParaPublicar({ modalidade: undefined })).not.toBeNull();
    expect(erroModalidadeParaPublicar({ modalidade: "sar" })).toBeNull();
  });
  it("nenhuma seleção mostra todas; várias = qualquer uma", () => {
    expect(filtrarPorModalidades(lista, [])).toHaveLength(4);
    expect(filtrarPorModalidades(lista, ["sar", "milsim"]).map((e) => e.id)).toEqual(["a", "b", "d"]);
  });
  it("Para você prioriza favoritas por data sem esconder as demais", () => {
    expect(ordenarEventos(lista, "para_voce", favMilsim).map((e) => e.id)).toEqual(["d", "a", "c", "b"]);
  });
  it("ordenação explícita ignora preferências", () => {
    expect(ordenarEventos(lista, "data", favMilsim).map((e) => e.id)).toEqual(["c", "d", "b", "a"]);
    expect(ordenarEventos(lista, "recentes", favMilsim).map((e) => e.id)).toEqual(["b", "c", "d", "a"]);
  });
  it("explorar todas não cria grupo de favoritas", () => {
    expect(separarPorPreferencia(lista, criarPreferencia([])).favoritas).toHaveLength(0);
  });
  it("conta com escolha vence o aparelho; conta sem escolha oferece o aparelho", () => {
    expect(resolverAoEntrar(favMilsim, criarPreferencia(["sar"]))).toEqual({ efetiva: favMilsim, oferecerAparelho: false });
    expect(resolverAoEntrar(PREF_PENDENTE, favMilsim).oferecerAparelho).toBe(true);
  });
  it("descarta modalidades inválidas lidas do armazenamento", () => {
    expect(normalizarPreferencia({ estado: "selecionadas", modalidades: ["xyz"] }).estado).toBe("pendente");
  });
});
