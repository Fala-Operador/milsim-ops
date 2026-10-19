import { describe, expect, it } from "vitest";
import { agrupar, chaveOrigem, filtrar, indicadores, resumoVendas, type RegistroAnalytics, type VendaAnalisada } from "@/lib/analytics";
import { montarRelatorio, relatorioParaCsv } from "@/lib/relatorioMetricas";

const r = (id: string, tipo: RegistroAnalytics["tipo"], origem: RegistroAnalytics["origem"], em: number, campanhaId?: string): RegistroAnalytics =>
  ({ id, tipo, eventoId: "e1", visitanteId: id, sessaoId: id, origem, em, campanhaId });
const regs = [r("1", "visita", "destaques", 100), r("2", "visita", "campanha", 100, "c1"), r("3", "visita", "destaques", 9999)];

function csv(origem?: string) {
  const f = filtrar(regs, { desde: 0, ate: 1000, origem });
  return relatorioParaCsv(montarRelatorio({
    evento: "Ev", periodo: "p", origem: origem ?? "Todas", ind: indicadores(f, regs),
    porOrigem: agrupar(f, regs, chaveOrigem), porSecao: [], porEvento: [],
    nomeOrigem: (k) => k, nomeSecao: (k) => k, nomeEvento: (k) => k, geradoEm: "agora",
  }));
}

describe("exportação de métricas", () => {
  it("respeita o período", () => expect(csv()).toContain("Visitas;2"));
  it("respeita a campanha", () => {
    const c = csv("cmp:c1");
    expect(c).toContain("Visitas;1");
    expect(c).toContain("cmp:c1;");
    expect(c).not.toContain("destaques;");
  });
});

describe("métricas de venda", () => {
  const dia = Date.UTC(2026, 9, 10);
  const venda = (extra: Partial<VendaAnalisada>): VendaAnalisada => ({
    eventoId: "e1", status: "confirmada", valorCentavos: 10000, descontoCentavos: 0, criadoEm: new Date(dia).toISOString(), ...extra,
  });

  it("soma receita confirmada do período, ticket médio e pago online", () => {
    const r = resumoVendas(
      [
        venda({ pagamento: { status: "pago", valorCentavos: 9000, pagoEm: new Date(dia + 1000).toISOString() }, descontoCentavos: 1000 }),
        venda({}),
        venda({ status: "cancelada" }),
        venda({ descontoCentavos: 10000 }), // desconto integral não é pedido pago
        venda({ eventoId: "e2" }),
        venda({ criadoEm: new Date(dia - 10 * 86400000).toISOString() }),
      ],
      { eventoIds: new Set(["e1"]), desde: dia - 86400000, ate: dia + 86400000 },
    );
    expect(r).toEqual({ receitaCentavos: 19000, pedidos: 2, ticketMedioCentavos: 9500, pagoOnlineCentavos: 9000 });
  });

  it("sem vendas, ticket médio fica vazio", () => {
    expect(resumoVendas([], { eventoIds: new Set(["e1"]), desde: 0, ate: dia }).ticketMedioCentavos).toBeNull();
  });
});
