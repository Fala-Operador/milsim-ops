import { describe, expect, it } from "vitest";
import { filtrarInscritos, indicadoresInscritos, ordenarEventos, FILTROS_VAZIOS } from "@/lib/inscritos";
import type { Evento, Inscricao } from "@/lib/domain/types";

const ev = (id: string, inicio: string, fim: string, cap = 120) =>
  ({ id, inicioEm: inicio, fimEm: fim, capacidadeTotal: cap }) as Evento;
const ins = (id: string, status: Inscricao["status"], extra: Partial<Inscricao> = {}) =>
  ({ id, eventoId: "e1", status, codigo: `COD-${id}`, exercitoId: "a", tipoId: "t", ...extra }) as Inscricao;

describe("inscritos", () => {
  it("canceladas e estornadas não ocupam vagas", () => {
    const r = indicadoresInscritos(ev("e1", "2026-11-01", "2026-11-02"), [
      ins("1", "confirmada"), ins("2", "confirmada"), ins("3", "cancelada"), ins("4", "estornada"),
    ]);
    expect(r).toMatchObject({ ativas: 2, disponiveis: 118, capacidade: 120 });
  });

  it("não conta inscrições de outro evento", () => {
    const r = indicadoresInscritos(ev("e1", "a", "b"), [ins("1", "confirmada", { eventoId: "e2" })]);
    expect(r.ativas).toBe(0);
  });

  it("busca por código e filtro de status", () => {
    const lista = [ins("1", "confirmada"), ins("2", "cancelada")];
    expect(filtrarInscritos(lista, { ...FILTROS_VAZIOS, busca: "cod-2" }, () => "")).toHaveLength(1);
    expect(filtrarInscritos(lista, { ...FILTROS_VAZIOS, status: "confirmada" }, () => "")[0]!.id).toBe("1");
  });

  it("próximos eventos primeiro, encerrados depois", () => {
    const agora = new Date("2026-10-12").getTime();
    const ids = ordenarEventos(
      [ev("velho", "2025-01-01", "2025-01-02"), ev("dez", "2026-12-01", "2026-12-02"), ev("nov", "2026-11-01", "2026-11-02")],
      agora,
    ).map((e) => e.id);
    expect(ids).toEqual(["nov", "dez", "velho"]);
  });
});
