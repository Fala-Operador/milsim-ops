// Repasse às organizações (Stripe Connect): situação da conta, destino e taxa da cobrança,
// e o que a visão revela da conta de recebimento.
import { describe, it, expect, beforeEach } from "vitest";
import { restaurarBase } from "@/test/baseTeste";
import { confirmarInscricao, confirmarPagamentoNaBase } from "@/services/inscricoes";
import { definirTaxaPlataformaNaBase, descartarContaDeOutroModoNaBase, registrarRecebimentoNaBase } from "@/services/repasses";
import { contaDeOutroModo, destinoInvalido, mensagemDeFalhaStripe, MSG_FALHA_STRIPE } from "@/lib/stripe";
import { contaParaRepasse, descreverCronograma, MCC_EVENTOS, perfilComercialPadrao, precisaPerfilComercial, recebimentoDaConta, resumoRepasse, resumoSaldo, taxaDaPlataforma, taxaPlataforma, type ContaStripe } from "@/lib/repasses";
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
  definirTaxaPlataformaNaBase(base, 10, "usr-admin");
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
  confirmarInscricao({ eventoId: EVT, usuarioId: "usr-participante", tipoId: "tp-a", exercitoId: "ex-a" }, { pagamentoOnline: true });

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

describe("taxa configurada pela administração", () => {
  it("valida, grava em configurações e audita", () => {
    expect(() => definirTaxaPlataformaNaBase(base, 60, "usr-admin")).toThrow(/entre 0% e 50%/);
    expect(() => definirTaxaPlataformaNaBase(base, 8.555, "usr-admin")).toThrow(/duas casas/);
    definirTaxaPlataformaNaBase(base, 8.5, "usr-admin");
    expect(base.configuracoes).toHaveLength(1);
    expect(taxaDaPlataforma(base)).toBe(8.5);
    expect(base.auditoria.at(-1)).toMatchObject({ acao: "taxa_plataforma", justificativa: "Taxa da plataforma alterada de 10% para 8.5%." });
  });

  it("nova taxa vale para reservas novas; as já feitas mantêm a sua", async () => {
    registrarRecebimentoNaBase(base, org().id, contaAtiva);
    const antes = await reservar();
    definirTaxaPlataformaNaBase(base, 5, "usr-admin");
    expect(base.inscricoes.find((i) => i.id === antes.id)?.pagamento?.taxaCentavos).toBe(2000);
    base.inscricoes = base.inscricoes.filter((i) => i.id !== antes.id);
    expect((await reservar()).pagamento?.taxaCentavos).toBe(1000);
  });

  it("taxa chega à administração e aos organizadores, não aos participantes", () => {
    expect(visaoParaUsuario(base, usuario("usr-admin")).configuracoes).toHaveLength(1);
    expect(visaoParaUsuario(base, usuario("usr-organizador")).configuracoes).toHaveLength(1);
    expect(visaoParaUsuario(base, usuario("usr-participante")).configuracoes).toHaveLength(0);
    expect(visaoParaUsuario(base, null).configuracoes).toHaveLength(0);
  });
});

describe("saldo e saques da conta conectada", () => {
  const conta: ContaStripe = {
    id: "acct_1",
    settings: { payouts: { schedule: { interval: "weekly", weekly_anchor: "monday", delay_days: 2 } } },
    external_accounts: { data: [{ object: "bank_account", bank_name: "Banco X", last4: "1234", default_for_currency: true }] },
  };

  it("soma só o saldo em reais e escolhe o próximo saque pela chegada", () => {
    const r = resumoSaldo(
      { available: [{ amount: 5000, currency: "brl" }, { amount: 900, currency: "usd" }], pending: [{ amount: 1200, currency: "brl" }] },
      [
        { id: "po_3", amount: 300, currency: "brl", arrival_date: 1_800_000_000, status: "pending" },
        { id: "po_2", amount: 200, currency: "brl", arrival_date: 1_700_000_000, status: "in_transit" },
        { id: "po_1", amount: 100, currency: "brl", arrival_date: 1_600_000_000, status: "failed", failure_message: "Conta encerrada" },
      ],
      conta,
    );
    expect(r.disponivelCentavos).toBe(5000);
    expect(r.aLiberarCentavos).toBe(1200);
    expect(r.proximoSaque?.id).toBe("po_2");
    expect(r.saques.map((s) => s.status)).toEqual(["pending", "in_transit", "failed"]);
    expect(r.saques[2]?.falha).toBe("Conta encerrada");
    expect(r.banco).toBe("Banco X •••• 1234");
  });

  it("descreve o cronograma em português", () => {
    expect(descreverCronograma(conta.settings?.payouts?.schedule)).toBe("Semanal, toda segunda-feira (cada venda fica disponível 2 dias depois)");
    expect(descreverCronograma({ interval: "daily" })).toBe("Diário");
    expect(descreverCronograma(undefined)).toBe("Definido pelo Stripe");
  });

  it("sem saques nem banco, o resumo fica vazio", () => {
    const r = resumoSaldo({}, [], { id: "acct_2" });
    expect(r).toMatchObject({ disponivelCentavos: 0, aLiberarCentavos: 0, saques: [], proximoSaque: undefined, banco: undefined });
  });
});

describe("perfil comercial enviado ao Stripe", () => {
  it("usa o endereço público do site, o ramo de recreação e uma descrição com o nome", () => {
    const p = perfilComercialPadrao("Fala Operador", "https://milsimops.falaoperador.com.br");
    expect(p).toEqual({
      name: "Fala Operador",
      mcc: MCC_EVENTOS,
      product_description: "Ingressos para eventos de airsoft organizados por Fala Operador, vendidos pelo Milsim Ops.",
      url: "https://milsimops.falaoperador.com.br",
    });
  });

  it("vai sem site em endereço local, que o Stripe recusa", () => {
    expect(perfilComercialPadrao("Org", "http://localhost:3000").url).toBeUndefined();
    expect(perfilComercialPadrao("Org", "https://localhost").url).toBeUndefined();
  });

  it("completa só contas em cadastro que ainda não têm site nem descrição", () => {
    expect(precisaPerfilComercial({ id: "acct_1" })).toBe(true);
    expect(precisaPerfilComercial({ id: "acct_1", business_profile: { url: "https://x.com" } })).toBe(false);
    expect(precisaPerfilComercial({ id: "acct_1", business_profile: { product_description: "Eventos" } })).toBe(false);
    expect(precisaPerfilComercial({ id: "acct_1", details_submitted: true })).toBe(false);
  });
});

describe("troca do modo do Stripe (teste → produção)", () => {
  const msgTeste = "No such account: 'acct_1'; a similar object exists in test mode, but a live mode key was used to make this request.";

  it("reconhece a conta que só existe no outro modo", () => {
    expect(contaDeOutroModo(404, msgTeste)).toBe(true);
    expect(contaDeOutroModo(404, "No such account: 'acct_1'")).toBe(false);
    expect(contaDeOutroModo(400, msgTeste)).toBe(false);
  });

  it("explica erros de configuração em vez de pedir para tentar de novo", () => {
    expect(mensagemDeFalhaStripe(401, "Invalid API Key provided")).toMatch(/STRIPE_SERVER_API_KEY/);
    expect(mensagemDeFalhaStripe(403, "The provided key does not have the required permissions")).toMatch(/permissão/);
    expect(mensagemDeFalhaStripe(400, "You can only create new accounts if you've signed up for Connect")).toMatch(/Connect ainda não está ativado/);
    expect(mensagemDeFalhaStripe(400, "Invalid email")).toBe("Stripe: Invalid email");
    expect(mensagemDeFalhaStripe(0, "fetch failed")).toBe(MSG_FALHA_STRIPE);
    expect(mensagemDeFalhaStripe(500, "erro")).toBe(MSG_FALHA_STRIPE);
  });

  it("checkout com destino de outro modo cai para a venda na plataforma", () => {
    expect(destinoInvalido(400, "No such destination: 'acct_1'")).toBe(true);
    expect(destinoInvalido(404, msgTeste)).toBe(true);
    expect(destinoInvalido(400, "Amount must be at least R$0.50")).toBe(false);
  });

  it("esquece só a conta de outro modo registrada na organização", () => {
    registrarRecebimentoNaBase(base, org().id, contaAtiva);
    descartarContaDeOutroModoNaBase(base, org().id, "acct_outra");
    expect(org().recebimento?.contaId).toBe("acct_1");
    descartarContaDeOutroModoNaBase(base, org().id, "acct_1");
    expect(org().recebimento).toBeUndefined();
  });
});
