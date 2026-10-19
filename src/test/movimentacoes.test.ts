// Abas, filtros, ordenação e totais das movimentações do financeiro.
import { describe, it, expect } from "vitest";
import {
  FILTROS_INICIAIS,
  filtrarMovimentacoes,
  filtrosAtivos,
  linhasDeMovimentacao,
  resumoPorAba,
  type FiltrosMovimentacao,
} from "@/lib/movimentacoes";
import type { Inscricao, Movimentacao } from "@/lib/domain/types";

const mov = (id: string, tipo: Movimentacao["tipo"], valor: number, dia: string, inscricaoId?: string, descricao = id): Movimentacao =>
  ({ id, eventoId: "evt", tipo, valorCentavos: valor, descricao, criadoEm: `${dia}T12:00:00.000Z`, inscricaoId });
const ins = (id: string, codigo: string, desconto: number, online: boolean) =>
  ({ id, codigo, descontoCentavos: desconto, pagamento: online ? ({ provedor: "stripe" } as Inscricao["pagamento"]) : undefined });

const linhas = linhasDeMovimentacao(
  [
    mov("m1", "inscricao", 10200, "2026-10-01", "i1", "Inscrição confirmada — Forças Especiais"),
    mov("m2", "desconto_cupom", 0, "2026-10-01", "i1", "Desconto de cupom aplicado (18 reais)"),
    mov("m3", "inscricao", 5950, "2026-10-05", "i2", "Inscrição confirmada — Tático (pago via Stripe)"),
    mov("m4", "estorno", -5950, "2026-10-07", "i2", "Estorno integral — cancelamento"),
    mov("m5", "ajuste", 500, "2026-10-09", undefined, "Ajuste manual"),
  ],
  [ins("i1", "OP-AAA111", 1800, false), ins("i2", "OP-BBB222", 0, true)],
);
const com = (p: Partial<FiltrosMovimentacao>) => ({ ...FILTROS_INICIAIS, ...p });

describe("linhas", () => {
  it("traz código, meio de pagamento e o valor real do desconto (gravado como 0)", () => {
    const d = linhas.find((l) => l.id === "m2")!;
    expect(d).toMatchObject({ codigoInscricao: "OP-AAA111", online: false, descontoCentavos: 1800 });
    expect(linhas.find((l) => l.id === "m3")).toMatchObject({ online: true, descontoCentavos: undefined });
    expect(linhas.find((l) => l.id === "m5")!.codigoInscricao).toBeUndefined();
  });
});

describe("abas e totais", () => {
  it("conta e soma cada aba; descontos somam o valor concedido", () => {
    const r = resumoPorAba(linhas, FILTROS_INICIAIS);
    expect(r.todas).toEqual({ quantidade: 5, totalCentavos: 10200 + 5950 - 5950 + 500 });
    expect(r.inscricao).toEqual({ quantidade: 2, totalCentavos: 16150 });
    expect(r.desconto_cupom).toEqual({ quantidade: 1, totalCentavos: 1800 });
    expect(r.estorno).toEqual({ quantidade: 1, totalCentavos: -5950 });
    expect(r.ajuste).toEqual({ quantidade: 1, totalCentavos: 500 });
  });

  it("a aba filtra pelo tipo", () => {
    expect(filtrarMovimentacoes(linhas, com({ aba: "estorno" })).map((l) => l.id)).toEqual(["m4"]);
  });

  it("as contagens das abas respeitam busca, período e meio", () => {
    const r = resumoPorAba(linhas, com({ meio: "online" }));
    expect(r.todas.quantidade).toBe(2);
    expect(r.inscricao.quantidade).toBe(1);
    expect(r.desconto_cupom.quantidade).toBe(0);
  });
});

describe("filtros", () => {
  it("busca sem acento por descrição e por código da inscrição", () => {
    expect(filtrarMovimentacoes(linhas, com({ busca: "tatico" })).map((l) => l.id)).toEqual(["m3"]);
    expect(filtrarMovimentacoes(linhas, com({ busca: "op-bbb" })).map((l) => l.id).sort()).toEqual(["m3", "m4"]);
  });

  it("período inclui os dois extremos", () => {
    expect(filtrarMovimentacoes(linhas, com({ de: "2026-10-05", ate: "2026-10-07" })).map((l) => l.id).sort()).toEqual(["m3", "m4"]);
    expect(filtrarMovimentacoes(linhas, com({ ate: "2026-10-01" }))).toHaveLength(2);
  });

  it("meio de pagamento separa Stripe do restante", () => {
    expect(filtrarMovimentacoes(linhas, com({ meio: "manual" })).map((l) => l.id).sort()).toEqual(["m1", "m2", "m5"]);
  });

  it("conta só os filtros em uso", () => {
    expect(filtrosAtivos(FILTROS_INICIAIS)).toBe(0);
    expect(filtrosAtivos(com({ busca: " x ", de: "2026-10-01", ordem: "antigas", aba: "estorno" }))).toBe(2);
  });
});

describe("ordenação", () => {
  it("mais recentes, mais antigas e maior valor (estorno e desconto pelo módulo do valor)", () => {
    expect(filtrarMovimentacoes(linhas, FILTROS_INICIAIS)[0]!.id).toBe("m5");
    expect(filtrarMovimentacoes(linhas, com({ ordem: "antigas" }))[0]!.id).toBe("m1");
    expect(filtrarMovimentacoes(linhas, com({ ordem: "maior_valor" })).map((l) => l.id)).toEqual(["m1", "m4", "m3", "m2", "m5"]);
  });
});
