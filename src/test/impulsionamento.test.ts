import { beforeEach, describe, expect, it } from "vitest";
import { restaurarBase } from "./baseTeste";
import type { BaseDados, Impulsionamento } from "@/lib/domain/types";
import { POSICAO_LISTAGEM } from "@/lib/domain/types";
import { campanhasNaPosicao, diagnosticarPosicao, metricasCampanha, pendenciasAtivacao, statusExibido } from "@/lib/impulsionamento";
import { eventosDaSecao, NACIONAL } from "@/lib/divulgacao";
import { visaoParaUsuario } from "@/lib/visao";

let base: BaseDados;
const agora = new Date();
const dia = 86400000;

function campanha(p: Partial<Impulsionamento> = {}): Impulsionamento {
  const e = base.eventos.find((x) => x.status === "publicado" && new Date(x.fimEm) > agora)!;
  return {
    id: `imp-${Math.random()}`, eventoId: e.id, nome: "Teste", objetivo: "divulgacao", posicoes: [POSICAO_LISTAGEM],
    abrangencia: NACIONAL, inicioEm: new Date(agora.getTime() - dia).toISOString(),
    fimEm: new Date(Math.min(agora.getTime() + 2 * dia, new Date(e.fimEm).getTime() - 1000)).toISOString(),
    fuso: "America/Sao_Paulo", prioridade: "normal", ordem: 0, status: "ativo", criadoPor: "adm",
    criadoEm: agora.toISOString(), atualizadoEm: agora.toISOString(), ...p,
  };
}

beforeEach(() => { base = restaurarBase(); });

describe("impulsionamento", () => {
  it("fica agendado antes do início e ativo durante o período", () => {
    const c = campanha({ inicioEm: new Date(agora.getTime() + dia).toISOString() });
    expect(statusExibido(base, c, agora)).toBe("agendado");
    expect(statusExibido(base, campanha(), agora)).toBe("ativo");
  });

  it("pausar remove da exibição sem mexer no evento", () => {
    const c = campanha({ status: "pausado" });
    base.impulsionamentos = [c];
    expect(campanhasNaPosicao(base, POSICAO_LISTAGEM, NACIONAL, agora)).toHaveLength(0);
    expect(base.eventos.find((e) => e.id === c.eventoId)!.status).toBe("publicado");
  });

  it("evento cancelado suspende a campanha", () => {
    const c = campanha();
    base.impulsionamentos = [c];
    base.eventos.find((e) => e.id === c.eventoId)!.status = "cancelado";
    expect(statusExibido(base, c, agora)).toBe("suspenso");
    expect(campanhasNaPosicao(base, POSICAO_LISTAGEM, NACIONAL, agora)).toHaveLength(0);
  });

  it("campanhas sobrepostas do mesmo evento aparecem uma vez, a de prioridade alta vence", () => {
    const a = campanha({ id: "a" });
    const b = campanha({ id: "b", prioridade: "alta" });
    base.impulsionamentos = [a, b];
    const r = campanhasNaPosicao(base, POSICAO_LISTAGEM, NACIONAL, agora);
    expect(r.map((c) => c.id)).toEqual(["b"]);
  });

  it("abrangência regional não aparece em outra região", () => {
    base.impulsionamentos = [campanha({ abrangencia: { escopo: "regiao", regiao: "Norte" } })];
    expect(campanhasNaPosicao(base, POSICAO_LISTAGEM, { escopo: "estado", uf: "SP" }, agora)).toHaveLength(0);
    expect(campanhasNaPosicao(base, POSICAO_LISTAGEM, { escopo: "estado", uf: "AM" }, agora)).toHaveLength(1);
  });

  it("seção recebe a campanha sozinha e não duplica a curadoria", () => {
    const secao = base.secoesInicio.find((s) => s.tipo === "destaques")!;
    const c = campanha({ posicoes: [secao.id] });
    secao.destaques = [{ id: "d1", eventoId: c.eventoId, posicao: 1, agendamento: {} }];
    base.impulsionamentos = [c];
    const cards = eventosDaSecao(base, secao, NACIONAL, agora);
    expect(cards.filter((x) => x.evento.id === c.eventoId)).toHaveLength(1);
    expect(cards[0]!.campanhaId).toBe(c.id);
  });

  it("não ativa campanha que passa do término do evento", () => {
    const c = campanha();
    const e = base.eventos.find((x) => x.id === c.eventoId)!;
    const erros = pendenciasAtivacao(base, { ...c, fimEm: new Date(new Date(e.fimEm).getTime() + dia).toISOString() }, agora);
    expect(erros.join(" ")).toContain("após o término");
  });

  it("visitante não recebe rascunhos nem nome interno", () => {
    base.impulsionamentos = [campanha({ id: "r", status: "rascunho" }), campanha({ id: "x" })];
    const v = visaoParaUsuario(base, null);
    expect(v.impulsionamentos.map((c) => c.id)).toEqual(["x"]);
    expect(v.impulsionamentos[0]!.nome).toBe("");
  });
});

describe("impulsionamento — métricas e prévia", () => {
  it("conta só os registros da campanha e calcula CTR", () => {
    const regs = [
      { tipo: "exibicao", campanhaId: "imp-a" }, { tipo: "exibicao", campanhaId: "imp-a" },
      { tipo: "exibicao", campanhaId: "imp-a" }, { tipo: "exibicao", campanhaId: "imp-a" },
      { tipo: "clique", campanhaId: "imp-a" }, { tipo: "visita", campanhaId: "imp-a" },
      { tipo: "inscricao_confirmada", campanhaId: "imp-a" }, { tipo: "clique", campanhaId: "imp-b" },
    ];
    const m = metricasCampanha(regs, "imp-a");
    expect(m).toMatchObject({ exibicoes: 4, cliques: 1, visitas: 1, inscricoes: 1, ctr: 25, conversao: 100 });
    expect(metricasCampanha(regs, "imp-x").ctr).toBeNull();
  });
  it("explica posição não escolhida, área e precedência", () => {
    const a = campanha({ id: "a", prioridade: "alta" });
    const b = campanha({ id: "b" });
    const fora = campanha({ id: "c", abrangencia: { escopo: "regiao", regiao: "Norte" } });
    base.impulsionamentos = [a, b, fora];
    const d = diagnosticarPosicao(base, POSICAO_LISTAGEM, { escopo: "estado", uf: "SP" }, agora);
    expect(d.find((x) => x.campanha.id === "a")).toMatchObject({ aparece: true, ordem: 1 });
    expect(d.find((x) => x.campanha.id === "b")!.motivos[0]).toContain("precedência");
    expect(d.find((x) => x.campanha.id === "c")!.motivos[0]).toContain("abrangência");
    expect(diagnosticarPosicao(base, "sec-outra", NACIONAL, agora).every((x) => !x.aparece)).toBe(true);
  });
});
