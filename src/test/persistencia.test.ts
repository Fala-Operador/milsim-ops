// Conversão BaseDados ↔ tabelas do Supabase e cálculo do lote de mudanças.
import { describe, it, expect } from "vitest";
import { criarBaseInicial } from "@/data/seed";
import {
  baseDasTabelas, calcularMudancas, daLinha, mudancasDeInsercao, paraCamel, paraLinha, paraSnake, type TabelasExportadas,
} from "@/lib/persistencia";

/** Simula o banco: aplica o lote de inserção e devolve o que exportar_base devolveria. */
function exportar(lote: ReturnType<typeof mudancasDeInsercao>): TabelasExportadas {
  return Object.fromEntries(Object.entries(lote).map(([t, m]) => [t, JSON.parse(JSON.stringify(m.gravar))]));
}

describe("nomes de colunas", () => {
  it("camelCase ↔ snake_case", () => {
    expect(paraSnake("descricaoResumida")).toBe("descricao_resumida");
    expect(paraCamel("valor_centavos")).toBe("valorCentavos");
    expect(paraCamel(paraSnake("tokenEntrada"))).toBe("tokenEntrada");
  });
});

describe("linhas", () => {
  it("campos ausentes não viram colunas e null volta como ausente", () => {
    const linha = paraLinha({ id: "x", complemento: undefined, exercitos: [{ id: "a" }] });
    expect(linha).toEqual({ id: "x", exercitos: [{ id: "a" }] });
    expect(daLinha({ id: "x", imagem_url: null })).toEqual({ id: "x" });
  });

  it("timestamptz do Postgres volta no formato de toISOString", () => {
    const obj = daLinha<{ criadoEm: string; dataNascimento: string }>({
      criado_em: "2026-10-13T14:50:18.889+00:00",
      data_nascimento: "1995-01-01",
    });
    expect(obj.criadoEm).toBe("2026-10-13T14:50:18.889Z");
    expect(obj.dataNascimento).toBe("1995-01-01");
  });
});

describe("base inteira", () => {
  it("ida e volta pelas tabelas preserva a base demonstrativa", () => {
    const base = criarBaseInicial();
    const devolta = baseDasTabelas(exportar(mudancasDeInsercao(base)));
    expect(JSON.parse(JSON.stringify(devolta))).toEqual(JSON.parse(JSON.stringify(base)));
  });

  it("sem alterações não gera lote", () => {
    const base = criarBaseInicial();
    expect(calcularMudancas(base, structuredClone(base))).toEqual({});
  });

  it("grava só o registro alterado e exclui o removido", () => {
    const antes = criarBaseInicial();
    const depois = structuredClone(antes);
    depois.notificacoes[0]!.lida = !depois.notificacoes[0]!.lida;
    const removido = depois.cupons.pop()!;
    const lote = calcularMudancas(antes, depois);
    expect(Object.keys(lote).sort()).toEqual(["cupons", "notificacoes"]);
    expect(lote["notificacoes"]!.gravar).toHaveLength(1);
    expect(lote["notificacoes"]!.gravar[0]!["id"]).toBe(depois.notificacoes[0]!.id);
    expect(lote["cupons"]!.excluir).toEqual([{ id: removido.id }]);
  });

  it("visitas da comunidade usam chave composta (usuário, evento)", () => {
    const antes = criarBaseInicial();
    const depois = structuredClone(antes);
    depois.visitasComunidade["usr-ana:evt-serra-verde"] = "2026-01-01T00:00:00.000Z";
    const lote = calcularMudancas(antes, depois);
    expect(lote["visitas_comunidade"]!.gravar).toEqual([
      { usuario_id: "usr-ana", evento_id: "evt-serra-verde", visto_em: "2026-01-01T00:00:00.000Z" },
    ]);
  });
});
