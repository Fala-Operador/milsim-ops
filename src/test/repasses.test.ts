// Repasse às organizações (Stripe Connect): situação da conta, destino e taxa da cobrança,
// e o que a visão revela da conta de recebimento.
import { describe, it, expect, beforeEach } from "vitest";
import { restaurarBase } from "@/test/baseTeste";
import { confirmarInscricao, confirmarPagamentoNaBase } from "@/services/inscricoes";
import { registrarRecebimentoNaBase } from "@/services/repasses";
import { contaParaRepasse, recebimentoDaConta, resumoRepasse, taxaPlataforma, type ContaStripe } from "@/lib/repasses";
import { visaoParaUsuario } from "@/lib/visao";
import type { BaseDados, Evento } from "@/lib/domain/types";

let base: BaseDados;
const EVT = "evt-teste-repasse";
const dia = 86400000;
const iso = (d: number) => new Date(Date.now() + d).toISOString();
const usuario = (id: string) => base.usuarios.find((u) => u.id === id)!;
const org = () => base.organizacoes.find((o) => o.id === base.eventos[0]!.organizacaoId)!;
const contaAtiva: ContaStripe = { id: "acct_1", details_submitted: true, payouts_enabled: true, capabilities: { transfers: "active" }, requirements: { currently_due: [] } };

beforeEach(() => {
  base = restaurarBase();
  base.eventos.push({
    id: EVT, organizacaoId: org().id, nome: "Operação Repasse", descricaoResumida: "", enredo: "",
    inicioEm: iso(30 * dia), fimEm: iso(31 * dia), fuso: "America/Sao_Paulo", local: "", endereco: "", cidade: "Itu", uf: "SP",
    capacidadeTotal: 10, exercitos: [{ id: "ex-a", nome: "A", capacidade: 10 }],
    tipos: [{ id: "tp-a", nome: "Padrão", precoBaseCentavos: 20000, quantidadeMaxima: 10 }],
    lotes: [{ id: "lt-1", nome: "1º lote", inicioVendas: iso(-dia), fimVendas: iso(10 * dia), status: "ativo", itens: [{ tipoId: "tp-a", precoCentavos: 20000, quantidade: 10 }] }],
    cronograma: [], status: "publicado", criadoEm: iso(-dia), modalidade: base.eventos[0]!.modalidade,
  } as Evento);
});

const reservar = () =>
  confirmarInscricao({ eventoId: EVT, usuarioId: "usr-participante", tipoId: "tp-a", exercitoId: "ex-a" }, { pagamentoOnline: true, taxaPercentual: 10 });

describe("situação da conta", () => {
  it("traduz o retrato do Stripe", () => {
    expect(recebimentoDaConta({ id: "acct_1" }).status).toBe("pendente");
    expect(recebimentoDaConta({ id: "acct_1", details_submitted: true, requirements: { currently_due: [] } }).status).toBe("em_analise");
    expect(recebimentoDaConta({ id: "acct_1", details_submitted: true, requirements: { currently_due: ["external_account"] } }).status).toBe("restrita");
    expect(recebimentoDaConta(contaAtiva)).toMatchObject({ status: "ativa", transferenciasAtivas: true, saquesAtivos: true });
  });

  it("avisa o responsável uma vez quando ativa e ignora outra conta", () => {
    registrarRecebimentoNaBase(base, org().id, { id: "acct_1" });
    registrarRecebimentoNaBase(base, org().id, contaAtiva);
    registrarRecebimentoNaBase(base, org().id, contaAtiva);
    expect(base.notificacoes.filter((n) => n.titulo === "Recebimentos ativados")).toHaveLength(1);
    registrarRecebimentoNaBase(base, org().id, { ...contaAtiva, id: "acct_outra" });
    expect(org().recebimento?.contaId).toBe("acct_1");
  });

  it("só repassa para conta com transferências ativas", () => {
    expect(contaParaRepasse(org())).toBeUndefined();
    registrarRecebimentoNaBase(base, org().id, { id: "acct_1", details_submitted: true });
    expect(contaParaRepasse(org())).toBeUndefined();
    registrarRecebimentoNaBase(base, org().id, contaAtiva);
    expect(contaParaRepasse(org())).toBe("acct_1");
  });
});

describe("taxa e destino da cobrança", () => {
  it("taxa arredonda para baixo e respeita limites", () => {
    expect(taxaPlataforma(20000, 10)).toBe(2000);
    expect(taxaPlataforma(999, 8.5)).toBe(84);
    expect(taxaPlataforma(1000, 0)).toBe(0);
    expect(taxaPlataforma(1000, 150)).toBe(1000);
  });

  it("sem conta ativa a venda fica na plataforma; com conta ativa vai para a organização", async () => {
    const semConta = await reservar();
    expect(semConta.pagamento).toMatchObject({ contaDestino: undefined, taxaCentavos: undefined });
    registrarRecebimentoNaBase(base, org().id, contaAtiva);
    base.inscricoes = base.inscricoes.filter((i) => i.id !== semConta.id);
    const comConta = await reservar();
    expect(comConta.pagamento).toMatchObject({ contaDestino: "acct_1", taxaCentavos: 2000, valorCentavos: 20000 });
    confirmarPagamentoNaBase(base, comConta.id, { intencaoId: "pi_1" });
    expect(resumoRepasse(base, EVT)).toEqual({ cobrado: 20000, taxas: 2000, repassado: 18000, naPlataforma: 0 });
  });
});

describe("visão", () => {
  it("conta de recebimento só para quem gere a organização; destino do repasse escondido do titular", async () => {
    registrarRecebimentoNaBase(base, org().id, contaAtiva);
    const ins = await reservar();
    const doParticipante = visaoParaUsuario(base, usuario("usr-participante"));
    expect(doParticipante.organizacoes.find((o) => o.id === org().id)?.recebimento).toBeUndefined();
    expect(doParticipante.inscricoes.find((i) => i.id === ins.id)?.pagamento?.contaDestino).toBeUndefined();
    expect(doParticipante.inscricoes.find((i) => i.id === ins.id)?.pagamento?.taxaCentavos).toBeUndefined();
    const doOrganizador = visaoParaUsuario(base, usuario("usr-organizador"));
    expect(doOrganizador.organizacoes.find((o) => o.id === org().id)?.recebimento?.contaId).toBe("acct_1");
    expect(doOrganizador.inscricoes.find((i) => i.id === ins.id)?.pagamento).toMatchObject({ contaDestino: "acct_1", taxaCentavos: 2000 });
    expect(visaoParaUsuario(base, null).organizacoes.find((o) => o.id === org().id)?.recebimento).toBeUndefined();
  });
});
