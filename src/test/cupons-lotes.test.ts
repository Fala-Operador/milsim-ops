// Cupons e lotes: disponibilidade só com lote vigente, cupom separado da disponibilidade.
import { describe, it, expect, beforeEach } from "vitest";
import { restaurarBase } from "@/test/baseTeste";
import { confirmarInscricao, validarCupom } from "@/services/inscricoes";
import { atualizarCupom, criarCupom } from "@/services/organizador";
import { disponibilidadeTipo, resumoCupom, situacaoCupom, validarDadosCupom } from "@/lib/vendas";
import type { BaseDados, Evento } from "@/lib/domain/types";

let base: BaseDados;
const PART = "usr-participante";
const EVT = "evt-teste-cupom";
const dia = 86400000;
const iso = (deslocDias: number) => new Date(Date.now() + deslocDias * dia).toISOString();

function evento(lotes: Evento["lotes"]): Evento {
  return {
    id: EVT, organizacaoId: base.eventos[0]!.organizacaoId, nome: "Operação Teste", descricaoResumida: "", enredo: "",
    inicioEm: iso(30), fimEm: iso(31), fuso: "America/Sao_Paulo", local: "", endereco: "", cidade: "Itu", uf: "SP",
    capacidadeTotal: 50, exercitos: [{ id: "ex-a", nome: "A", capacidade: 25 }],
    tipos: [
      { id: "tp-a", nome: "Padrão", precoBaseCentavos: 9999, quantidadeMaxima: 50 },
      { id: "tp-b", nome: "VIP", precoBaseCentavos: 30000, quantidadeMaxima: 50 },
    ],
    lotes, cronograma: [], status: "publicado", criadoEm: iso(-1), modalidade: base.eventos[0]!.modalidade,
  } as Evento;
}
const loteVigente = (extra: Partial<Evento["lotes"][number]> = {}) => ({
  id: "lt-1", nome: "1º lote", inicioVendas: iso(-1), fimVendas: iso(10), status: "ativo" as const,
  itens: [{ tipoId: "tp-a", precoCentavos: 20000, quantidade: 10 }, { tipoId: "tp-b", precoCentavos: 30000, quantidade: 10 }], ...extra,
});
const novoCupom = async (extra = {}) =>
  criarCupom({ eventoId: EVT, codigo: "FALAOPERADOR", descontoPercentual: 15, limiteUsos: 10, validoDe: iso(-1), validoAte: iso(5), tiposElegiveis: ["tp-a"], ativo: true, ...extra });
const cupom = () => base.cupons.find((c) => c.eventoId === EVT)!;
const inscrever = (codigoCupom?: string, tipoId = "tp-a") =>
  confirmarInscricao({ eventoId: EVT, usuarioId: PART, tipoId, exercitoId: "ex-a", codigoCupom });

beforeEach(() => {
  base = restaurarBase();
  base.eventos.push(evento([loteVigente()]));
});

describe("criação de cupom", () => {
  it("FALAOPERADOR 15% com 10 utilizações é salvo normalizado e com 0 usos", async () => {
    await novoCupom({ codigo: "  falaoperador " });
    expect(cupom()).toMatchObject({ codigo: "FALAOPERADOR", descontoPercentual: 15, limiteUsos: 10, usos: 0 });
  });

  it("código repetido no mesmo evento é recusado", async () => {
    await novoCupom();
    await expect(novoCupom({ codigo: "falaoperador" })).rejects.toThrow(/já existe/i);
  });

  it("valida desconto, limite, datas e tipos", () => {
    const ctx = { codigosExistentes: [], tiposDoEvento: ["tp-a"] };
    const ok = { codigo: "ABC", descontoPercentual: 15, limiteUsos: 10, validoDe: iso(0), validoAte: iso(1), tiposElegiveis: ["tp-a"], ativo: true };
    expect(validarDadosCupom(ok, ctx)).toEqual({});
    expect(validarDadosCupom({ ...ok, descontoPercentual: 0 }, ctx).descontoPercentual).toBeTruthy();
    expect(validarDadosCupom({ ...ok, descontoPercentual: 101 }, ctx).descontoPercentual).toBeTruthy();
    expect(validarDadosCupom({ ...ok, limiteUsos: 0 }, ctx).limiteUsos).toBeTruthy();
    expect(validarDadosCupom({ ...ok, validoAte: iso(-1) }, ctx).validoAte).toBeTruthy();
    expect(validarDadosCupom({ ...ok, tiposElegiveis: [] }, ctx).tiposElegiveis).toBeTruthy();
    // "Sem limite" e "sem término" são opções explícitas, não zero.
    expect(validarDadosCupom({ ...ok, limiteUsos: null, validoAte: null }, ctx)).toEqual({});
  });

  it("resumo legível", () => {
    expect(resumoCupom({ codigo: "falaoperador", descontoPercentual: 15, limiteUsos: 10 }, false)).toBe(
      "FALAOPERADOR concede 15% de desconto, com até 10 utilizações, nos ingressos selecionados desta operação.",
    );
  });
});

describe("aplicação e confirmação", () => {
  it("código em maiúsculas, minúsculas e com espaços é aceito", async () => {
    await novoCupom();
    for (const c of ["FALAOPERADOR", "falaoperador", "  FalaOperador  "]) {
      expect(validarCupom(base, EVT, c, "tp-a").descontoPercentual).toBe(15);
    }
  });

  it("R$ 200 com 15% fica R$ 170 e registra exatamente uma utilização", async () => {
    await novoCupom();
    const ins = await inscrever(" falaoperador ");
    expect(ins.valorCentavos).toBe(20000);
    expect(ins.descontoCentavos).toBe(3000);
    expect(ins.loteId).toBe("lt-1");
    expect(cupom().usos).toBe(1);
  });

  it("segunda confirmação (clique repetido) não duplica inscrição nem uso", async () => {
    await novoCupom();
    await inscrever("FALAOPERADOR");
    await expect(inscrever("FALAOPERADOR")).rejects.toThrow(/inscrição ativa/i);
    expect(cupom().usos).toBe(1);
    expect(base.inscricoes.filter((i) => i.eventoId === EVT)).toHaveLength(1);
  });

  it.each([
    ["ausente", [] as Evento["lotes"], "nao_configurado"],
    ["futuro", [loteVigente({ inicioVendas: iso(2), fimVendas: iso(5) })], "agendado"],
    ["encerrado", [loteVigente({ inicioVendas: iso(-5), fimVendas: iso(-1) })], "encerrado"],
    ["inativo", [loteVigente({ status: "encerrado" })], "inativo"],
  ])("lote %s bloqueia sem consumir o cupom", async (_n, lotes, motivo) => {
    base.eventos.find((e) => e.id === EVT)!.lotes = lotes;
    await novoCupom();
    const d = disponibilidadeTipo(base.eventos.find((e) => e.id === EVT)!, "tp-a", () => 0);
    expect(d.disponivel ? "" : d.motivo).toBe(motivo);
    await expect(inscrever("FALAOPERADOR")).rejects.toThrow(/indisponíveis/i);
    await expect(inscrever("FALAOPERADOR")).rejects.not.toThrow(/cupom/i);
    expect(cupom().usos).toBe(0);
  });

  it("lote esgotado bloqueia sem consumir o cupom", async () => {
    const ev = base.eventos.find((e) => e.id === EVT)!;
    ev.lotes = [loteVigente({ itens: [{ tipoId: "tp-a", precoCentavos: 20000, quantidade: 1 }] })];
    base.inscricoes.push({ ...base.inscricoes[0]!, id: "ins-x", eventoId: EVT, usuarioId: "outro", tipoId: "tp-a", loteId: "lt-1", status: "confirmada" });
    await novoCupom();
    await expect(inscrever("FALAOPERADOR")).rejects.toThrow(/esgotaram/i);
    expect(cupom().usos).toBe(0);
  });

  it("sem lote nunca usa o preço base como alternativa", () => {
    const d = disponibilidadeTipo(evento([]), "tp-a", () => 0);
    expect(d.disponivel).toBe(false);
  });

  it("cupom expirado, inativo, esgotado e de outro evento são recusados", async () => {
    await novoCupom({ validoDe: iso(-5), validoAte: iso(-1) });
    expect(() => validarCupom(base, EVT, "FALAOPERADOR", "tp-a")).toThrow(/expirou/);
    cupom().validoAte = iso(5);
    cupom().ativo = false;
    expect(() => validarCupom(base, EVT, "FALAOPERADOR", "tp-a")).toThrow(/inativo/);
    cupom().ativo = true;
    cupom().usos = 10;
    expect(() => validarCupom(base, EVT, "FALAOPERADOR", "tp-a")).toThrow(/limite/);
    expect(() => validarCupom(base, base.eventos[0]!.id, "FALAOPERADOR", "tp-a")).toThrow(/não encontrado/);
  });

  it("trocar para tipo não elegível recusa o cupom", async () => {
    await novoCupom();
    expect(() => validarCupom(base, EVT, "FALAOPERADOR", "tp-b")).toThrow(/tipo de ingresso/);
  });

  it("situação do cupom sem limite e sem término", () => {
    const c = { id: "c", eventoId: EVT, codigo: "X", descontoPercentual: 10, validoDe: iso(-1), validoAte: null, limiteUsos: null, usos: 999, tiposElegiveis: [], ativo: true };
    expect(situacaoCupom(c)).toBe("ativo");
    expect(situacaoCupom({ ...c, validoDe: iso(1) })).toBe("agendado");
  });

  it("editar o cupom não altera descontos já aplicados", async () => {
    await novoCupom();
    const ins = await inscrever("FALAOPERADOR");
    const { codigo: _c, id: _i, usos: _u, eventoId: _e, ...resto } = cupom();
    await atualizarCupom(cupom().id, { ...resto, descontoPercentual: 50 });
    expect(base.inscricoes.find((i) => i.id === ins.id)!.descontoCentavos).toBe(3000);
    await expect(atualizarCupom(cupom().id, { ...resto, limiteUsos: 0 })).rejects.toThrow();
  });
});
