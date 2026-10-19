// Pagamento online (Stripe): reserva de vaga, confirmação idempotente, liberação, reembolso,
// assinatura do webhook e o que a visão revela do pagamento.
import { describe, it, expect, beforeEach } from "vitest";
import { restaurarBase } from "@/test/baseTeste";
import {
  cancelarInscricao,
  confirmarInscricao,
  confirmarPagamentoNaBase,
  liberarReservasVencidas,
  marcarPagamentoProcessando,
  registrarDisputaNaBase,
  registrarReembolsoNaBase,
  registrarResultadoEstornoNaBase,
  resumoFinanceiro,
  vagasRestantes,
} from "@/services/inscricoes";
import { cancelarEvento } from "@/services/organizador";
import { ocupaVaga, reservaVigente } from "@/lib/pagamentos";
import { visaoParaUsuario } from "@/lib/visao";
import { acaoDaSessao, acaoDoEvento, assinarPayload, assinaturaValida, codificarFormulario, disputaDoStripe, problemaDasChaves, statusDaDisputa } from "@/lib/stripe";
import type { BaseDados, Evento, Inscricao } from "@/lib/domain/types";

let base: BaseDados;
const PART = "usr-participante";
const OUTRO = "usr-outro";
const EVT = "evt-teste-stripe";
const dia = 86400000;
const iso = (desloc: number) => new Date(Date.now() + desloc).toISOString();

function evento(capacidade = 2): Evento {
  return {
    id: EVT, organizacaoId: base.eventos[0]!.organizacaoId, nome: "Operação Stripe", descricaoResumida: "", enredo: "",
    inicioEm: iso(30 * dia), fimEm: iso(31 * dia), fuso: "America/Sao_Paulo", local: "", endereco: "", cidade: "Itu", uf: "SP",
    capacidadeTotal: capacidade, exercitos: [{ id: "ex-a", nome: "A", capacidade: 10 }],
    tipos: [{ id: "tp-a", nome: "Padrão", precoBaseCentavos: 15000, quantidadeMaxima: 10 }],
    lotes: [{ id: "lt-1", nome: "1º lote", inicioVendas: iso(-dia), fimVendas: iso(10 * dia), status: "ativo", itens: [{ tipoId: "tp-a", precoCentavos: 15000, quantidade: 10 }] }],
    cronograma: [], status: "publicado", criadoEm: iso(-dia), modalidade: base.eventos[0]!.modalidade,
  } as Evento;
}

const reservar = (usuarioId = PART, extra: { codigoCupom?: string } = {}) =>
  confirmarInscricao({ eventoId: EVT, usuarioId, tipoId: "tp-a", exercitoId: "ex-a", ...extra }, { pagamentoOnline: true });
const ins = (id: string) => base.inscricoes.find((i) => i.id === id)!;

beforeEach(() => {
  base = restaurarBase();
  base.eventos.push(evento());
  const p = base.usuarios.find((u) => u.id === PART)!;
  base.usuarios.push({ ...structuredClone(p), id: OUTRO, email: "outro@exemplo.com", cpf: "52998224725" });
});

describe("reserva", () => {
  it("inscrição paga com Stripe nasce pendente, sem QR e sem movimentação", async () => {
    const i = await reservar();
    expect(i.status).toBe("pendente");
    expect(i.tokenEntrada).toBeUndefined();
    expect(i.pagamento).toMatchObject({ provedor: "stripe", status: "aguardando", valorCentavos: 15000 });
    expect(base.movimentacoes.filter((m) => m.inscricaoId === i.id)).toHaveLength(0);
    expect(resumoFinanceiro(EVT).bruto).toBe(0);
    expect(resumoFinanceiro(EVT).reservasAguardando).toBe(1);
  });

  it("reserva vigente ocupa vaga; vencida não", async () => {
    const i = await reservar();
    const e = base.eventos.find((x) => x.id === EVT)!;
    expect(vagasRestantes(base, e)).toBe(1);
    expect(ocupaVaga(ins(i.id), new Date(Date.now() + 40 * 60_000))).toBe(false);
  });

  it("evento lotado por reservas recusa nova inscrição", async () => {
    base.eventos.find((x) => x.id === EVT)!.capacidadeTotal = 1;
    await reservar();
    await expect(reservar(OUTRO)).rejects.toThrow(/esgotado/i);
  });

  it("sem pagamento online confirma direto, como antes", async () => {
    const i = await confirmarInscricao({ eventoId: EVT, usuarioId: PART, tipoId: "tp-a", exercitoId: "ex-a" });
    expect(i.status).toBe("confirmada");
    expect(i.pagamento).toBeUndefined();
  });

  it("nova tentativa substitui a reserva anterior e devolve o cupom", async () => {
    base.cupons.push({ id: "cup-s", eventoId: EVT, codigo: "DEZ", descontoPercentual: 10, limiteUsos: 5, usos: 0, validoDe: iso(-dia), validoAte: iso(dia), tiposElegiveis: ["tp-a"], ativo: true } as BaseDados["cupons"][number]);
    const a = await reservar(PART, { codigoCupom: "DEZ" });
    expect(base.cupons.find((c) => c.id === "cup-s")!.usos).toBe(1);
    const b = await reservar(PART, { codigoCupom: "DEZ" });
    expect(ins(a.id).status).toBe("cancelada");
    expect(ins(b.id).status).toBe("pendente");
    expect(base.cupons.find((c) => c.id === "cup-s")!.usos).toBe(1);
  });

  it("reenvio com a mesma chave devolve a mesma reserva, sem gastar cupom de novo", async () => {
    base.cupons.push({ id: "cup-i", eventoId: EVT, codigo: "IDEM", descontoPercentual: 10, limiteUsos: 5, usos: 0, validoDe: iso(-dia), validoAte: iso(dia), tiposElegiveis: ["tp-a"], ativo: true } as BaseDados["cupons"][number]);
    const chave = "0f8c7a1e-5b2d-4c3e-9a11-7d6e5f4a3b2c";
    const a = await confirmarInscricao({ eventoId: EVT, usuarioId: PART, tipoId: "tp-a", exercitoId: "ex-a", codigoCupom: "IDEM", clienteId: chave }, { pagamentoOnline: true });
    const b = await confirmarInscricao({ eventoId: EVT, usuarioId: PART, tipoId: "tp-a", exercitoId: "ex-a", codigoCupom: "IDEM", clienteId: chave }, { pagamentoOnline: true });
    expect(b.id).toBe(a.id);
    expect(ins(a.id).status).toBe("pendente");
    expect(base.inscricoes.filter((i) => i.eventoId === EVT)).toHaveLength(1);
    expect(base.cupons.find((c) => c.id === "cup-i")!.usos).toBe(1);
  });

  it("chave de outra pessoa ou malformada é recusada", async () => {
    const chave = "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d";
    await confirmarInscricao({ eventoId: EVT, usuarioId: PART, tipoId: "tp-a", exercitoId: "ex-a", clienteId: chave }, { pagamentoOnline: true });
    await expect(confirmarInscricao({ eventoId: EVT, usuarioId: OUTRO, tipoId: "tp-a", exercitoId: "ex-a", clienteId: chave }, { pagamentoOnline: true })).rejects.toThrow(/chave/i);
    await expect(confirmarInscricao({ eventoId: EVT, usuarioId: OUTRO, tipoId: "tp-a", exercitoId: "ex-a", clienteId: "x;drop" }, { pagamentoOnline: true })).rejects.toThrow(/chave/i);
  });

  it("reservas vencidas são liberadas com folga e devolvem a sessão a expirar", async () => {
    const i = await reservar();
    ins(i.id).pagamento = { ...ins(i.id).pagamento!, sessaoId: "cs_1", expiraEm: iso(-11 * 60_000) };
    expect(liberarReservasVencidas(base, EVT)).toEqual(["cs_1"]);
    expect(ins(i.id)).toMatchObject({ status: "cancelada", pagamento: { status: "expirado" } });
  });
});

describe("confirmação do pagamento", () => {
  it("confirma, gera QR e movimentação; repetir não duplica", async () => {
    const i = await reservar();
    expect(confirmarPagamentoNaBase(base, i.id, { sessaoId: "cs_1", intencaoId: "pi_1" })).toBe("confirmada");
    expect(confirmarPagamentoNaBase(base, i.id, { sessaoId: "cs_1", intencaoId: "pi_1" })).toBe("ja_confirmada");
    expect(ins(i.id)).toMatchObject({ status: "confirmada", pagamento: { status: "pago", intencaoId: "pi_1" } });
    expect(ins(i.id).tokenEntrada).toBeTruthy();
    expect(base.movimentacoes.filter((m) => m.inscricaoId === i.id && m.tipo === "inscricao")).toHaveLength(1);
    expect(resumoFinanceiro(EVT).bruto).toBe(15000);
  });

  it("pagamento assíncrono segura a vaga mesmo depois do prazo", async () => {
    const i = await reservar();
    marcarPagamentoProcessando(base, i.id, { sessaoId: "cs_1" });
    expect(reservaVigente(ins(i.id), new Date(Date.now() + 2 * dia))).toBe(true);
  });

  it("pagamento que chega sem vaga possível vira reembolso", async () => {
    base.eventos.find((x) => x.id === EVT)!.capacidadeTotal = 1;
    const a = await reservar();
    ins(a.id).pagamento!.expiraEm = iso(-20 * 60_000);
    const b = await reservar(OUTRO); // a vaga foi para outra pessoa
    expect(confirmarPagamentoNaBase(base, a.id, { intencaoId: "pi_a" })).toBe("estornar");
    expect(ins(a.id)).toMatchObject({ status: "cancelada", pagamento: { status: "estorno_pendente", intencaoId: "pi_a" } });
    expect(ins(b.id).status).toBe("pendente");
  });

  it("pagamento tardio com vaga sobrando ainda confirma", async () => {
    const i = await reservar();
    ins(i.id).pagamento!.expiraEm = iso(-60_000);
    expect(confirmarPagamentoNaBase(base, i.id, { intencaoId: "pi_1" })).toBe("confirmada");
  });
});

describe("cancelamento e reembolso", () => {
  async function paga(usuarioId = PART): Promise<Inscricao> {
    const i = await reservar(usuarioId);
    confirmarPagamentoNaBase(base, i.id, { sessaoId: `cs_${usuarioId}`, intencaoId: `pi_${usuarioId}` });
    return ins(i.id);
  }

  it("cancelar inscrição paga marca o reembolso e registra o estorno", async () => {
    const i = await paga();
    await cancelarInscricao(i.id, "não poderei ir", PART);
    expect(ins(i.id)).toMatchObject({ status: "estornada", pagamento: { status: "estorno_pendente" } });
    expect(resumoFinanceiro(EVT).reembolsosPendentes).toHaveLength(1);
    registrarResultadoEstornoNaBase(base, i.id, { reembolsoId: "re_1" });
    expect(ins(i.id).pagamento).toMatchObject({ status: "estornado", reembolsoId: "re_1" });
  });

  it("falha no reembolso fica registrada para nova tentativa", async () => {
    const i = await paga();
    await cancelarInscricao(i.id, "motivo", PART);
    registrarResultadoEstornoNaBase(base, i.id, { erro: "saldo insuficiente" });
    expect(ins(i.id).pagamento).toMatchObject({ status: "estorno_pendente", erro: "saldo insuficiente" });
  });

  it("cancelar reserva libera a vaga e devolve a sessão a expirar", async () => {
    const i = await reservar();
    ins(i.id).pagamento!.sessaoId = "cs_x";
    const r = await cancelarInscricao(i.id, "desisti", PART);
    expect(r.sessaoAExpirar).toBe("cs_x");
    expect(ins(i.id).status).toBe("cancelada");
  });

  it("cancelar o evento reembolsa os pagos e libera as reservas", async () => {
    const pago = await paga();
    const reserva = await reservar(OUTRO);
    ins(reserva.id).pagamento!.sessaoId = "cs_r";
    const r = await cancelarEvento(EVT, "chuva", "usr-admin", "admin");
    expect(r).toMatchObject({ canceladas: 1, sessoesAExpirar: ["cs_r"] });
    expect(ins(pago.id).pagamento?.status).toBe("estorno_pendente");
    expect(ins(reserva.id).status).toBe("cancelada");
  });

  it("reembolso integral feito no painel do Stripe cancela o ingresso", async () => {
    const i = await paga();
    registrarReembolsoNaBase(base, i.id, true);
    expect(ins(i.id)).toMatchObject({ status: "estornada", pagamento: { status: "estornado" } });
    expect(base.movimentacoes.some((m) => m.inscricaoId === i.id && m.tipo === "estorno")).toBe(true);
  });
});

describe("visão", () => {
  it("terceiros só veem situação e prazo; titular não recebe ids do Stripe; admin recebe", async () => {
    const i = await reservar();
    ins(i.id).pagamento = { ...ins(i.id).pagamento!, sessaoId: "cs_segredo", intencaoId: "pi_segredo" };
    const doOutro = visaoParaUsuario(base, base.usuarios.find((u) => u.id === OUTRO)!).inscricoes.find((x) => x.id === i.id)!;
    expect(doOutro.pagamento).toEqual({ provedor: "stripe", status: "aguardando", valorCentavos: 0, expiraEm: ins(i.id).pagamento!.expiraEm });
    expect(ocupaVaga(doOutro)).toBe(true);
    const doTitular = visaoParaUsuario(base, base.usuarios.find((u) => u.id === PART)!).inscricoes.find((x) => x.id === i.id)!;
    expect(doTitular.pagamento?.sessaoId).toBeUndefined();
    expect(doTitular.pagamento?.valorCentavos).toBe(15000);
    const doAdmin = visaoParaUsuario(base, base.usuarios.find((u) => u.id === "usr-admin")!).inscricoes.find((x) => x.id === i.id)!;
    expect(doAdmin.pagamento?.sessaoId).toBe("cs_segredo");
  });
});

describe("Stripe: formulário, webhook e sessões", () => {
  it("codifica parâmetros aninhados como a API espera", () => {
    expect(codificarFormulario({ a: 1, m: { k: "v w" }, l: [{ q: 1 }], x: undefined })).toBe("a=1&m%5Bk%5D=v%20w&l%5B0%5D%5Bq%5D=1");
  });

  it("aceita assinatura válida e recusa adulterada, sem cabeçalho ou antiga", async () => {
    const corpo = '{"id":"evt_1","type":"checkout.session.completed"}';
    const t = 1_700_000_000;
    const v1 = await assinarPayload("whsec_teste", t, corpo);
    expect(await assinaturaValida(corpo, `t=${t},v1=${v1}`, "whsec_teste", t + 10)).toBe(true);
    expect(await assinaturaValida(corpo + " ", `t=${t},v1=${v1}`, "whsec_teste", t + 10)).toBe(false);
    expect(await assinaturaValida(corpo, `t=${t},v1=${v1}`, "outro", t + 10)).toBe(false);
    expect(await assinaturaValida(corpo, null, "whsec_teste", t)).toBe(false);
    expect(await assinaturaValida(corpo, `t=${t},v1=${v1}`, "whsec_teste", t + 301)).toBe(false);
  });

  it("traduz eventos e sessões em ações", () => {
    expect(acaoDoEvento("checkout.session.completed", { id: "cs", payment_status: "paid" })).toBe("confirmar");
    expect(acaoDoEvento("checkout.session.completed", { id: "cs", payment_status: "unpaid" })).toBe("processando");
    expect(acaoDoEvento("checkout.session.async_payment_failed", { id: "cs" })).toBe("liberar_falha");
    expect(acaoDoEvento("checkout.session.expired", { id: "cs" })).toBe("liberar_expirada");
    expect(acaoDaSessao({ id: "cs", status: "open", payment_status: "unpaid" })).toBe("nada");
    expect(acaoDaSessao({ id: "cs", status: "expired" })).toBe("liberar_expirada");
  });
});

describe("contestação (chargeback)", () => {
  it("registra a disputa, avisa a organização uma vez e acompanha o desfecho", async () => {
    const i = await reservar();
    confirmarPagamentoNaBase(base, i.id, { intencaoId: "pi_d" });
    const avisos = () => base.notificacoes.filter((n) => n.titulo === "Pagamento contestado").length;
    const antes = avisos();
    const aberta = disputaDoStripe({ id: "dp_1", amount: 15000, status: "needs_response", reason: "fraudulent", created: 1_700_000_000, payment_intent: "pi_d" });
    expect(registrarDisputaNaBase(base, "pi_d", aberta)?.id).toBe(i.id);
    expect(ins(i.id).pagamento?.disputa).toMatchObject({ status: "aberta", valorCentavos: 15000, motivo: "fraudulent" });
    expect(resumoFinanceiro(EVT).disputas.map((x) => x.id)).toEqual([i.id]);
    const ganha = disputaDoStripe({ id: "dp_1", amount: 15000, status: "won", created: 1_700_000_000 });
    registrarDisputaNaBase(base, "pi_d", ganha);
    expect(ins(i.id).pagamento?.disputa?.status).toBe("ganha");
    expect(avisos() - antes).toBe(base.organizacoes.find((o) => o.id === base.eventos[0]!.organizacaoId)?.responsavelId ? 1 : 0);
    expect(registrarDisputaNaBase(base, "pi_outro", ganha)).toBeUndefined();
  });

  it("traduz as situações do Stripe", () => {
    expect(statusDaDisputa("warning_needs_response")).toBe("aberta");
    expect(statusDaDisputa("under_review")).toBe("em_analise");
    expect(statusDaDisputa("lost")).toBe("perdida");
    expect(statusDaDisputa("warning_closed")).toBe("encerrada");
  });
});

describe("chaves do Stripe", () => {
  const conta = "51NxYzAbCdEfGhIj";
  it("aceita chaves da mesma conta e do mesmo modo", () => {
    expect(problemaDasChaves(`sk_test_${conta}aaa`, `pk_test_${conta}bbb`)).toBe("");
    expect(problemaDasChaves(`rk_live_${conta}aaa`, `pk_live_${conta}bbb`)).toBe("");
    expect(problemaDasChaves(`sk_test_${conta}aaa`, undefined)).toBe("");
  });

  it("aponta modo trocado, conta diferente e chave no lugar errado", () => {
    expect(problemaDasChaves(`sk_live_${conta}a`, `pk_test_${conta}b`)).toMatch(/produção.*teste/);
    expect(problemaDasChaves(`sk_test_${conta}a`, "pk_test_51OutraContaQualquer")).toMatch(/contas Stripe diferentes/);
    expect(problemaDasChaves(`sk_test_${conta}a`, `sk_test_${conta}b`)).toMatch(/pk_test_/);
    expect(problemaDasChaves(`pk_test_${conta}a`, `pk_test_${conta}b`)).toMatch(/STRIPE_SECRET_KEY/);
  });
});
