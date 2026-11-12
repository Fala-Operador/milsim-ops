// Escolha da forma de pagamento: meios ativos lidos do Stripe, limites de valor de cada meio,
// meio de uma sessão aberta e checkout criado só com o meio escolhido.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { metodoDaSessao, metodosDaConfiguracao, metodosParaValor, type ConfiguracaoMetodos } from "@/lib/stripe";
import { expiracaoLiberaReserva, prazoDaNovaSessao } from "@/lib/pagamentos";
import { expiracaoCancelaImpulso, prazoPagamentoImpulso, statusDoImpulso } from "@/lib/impulsos";
import { registrarSessaoImpulsoNaBase } from "@/services/impulsos";
import {
  criarSessaoCheckout, criarSessaoCheckoutImpulso, diagnosticoMetodosPagamento, limparCacheMetodos, metodosDePagamentoAtivos,
} from "@/server/stripe.server";
import type { BaseDados, ImpulsoComprado, Inscricao } from "@/lib/domain/types";

const pref = (on: boolean, disponivel = on) => ({ available: disponivel, display_preference: { preference: on ? "on" : "off", value: on ? "on" : "off" } });

const padrao: ConfiguracaoMetodos = {
  id: "pmc_padrao", active: true, is_default: true,
  card: pref(true), boleto: pref(true), pix: pref(true, false), apple_pay: pref(true), klarna: pref(false),
};

describe("meios ativos na configuração do Stripe", () => {
  it("usa a configuração padrão ativa e só os meios disponíveis, na ordem do site", () => {
    const outra: ConfiguracaoMetodos = { id: "pmc_outra", active: true, is_default: false, card: pref(true), pix: pref(true) };
    expect(metodosDaConfiguracao([outra, padrao])).toEqual(["card", "boleto"]);
    expect(metodosDaConfiguracao([{ ...padrao, pix: pref(true) }])).toEqual(["card", "pix", "boleto"]);
  });

  it("ignora configurações de contas conectadas e inativas", () => {
    expect(metodosDaConfiguracao([{ ...padrao, parent: "pmc_pai" }])).toEqual([]);
    expect(metodosDaConfiguracao([{ ...padrao, active: false }])).toEqual([]);
    expect(metodosDaConfiguracao([])).toEqual([]);
  });

  it("respeita os limites de valor de cada meio", () => {
    const todos = ["card", "pix", "boleto"] as const;
    expect(metodosParaValor([...todos], 499)).toEqual(["card", "pix"]);
    expect(metodosParaValor([...todos], 500)).toEqual(["card", "pix", "boleto"]);
    expect(metodosParaValor([...todos], 5_000_000)).toEqual(["card", "pix"]);
    expect(metodosParaValor([...todos], 49)).toEqual([]);
  });

  it("reconhece o meio de uma sessão restrita a um só meio", () => {
    expect(metodoDaSessao({ id: "cs", payment_method_types: ["pix"] })).toBe("pix");
    expect(metodoDaSessao({ id: "cs", payment_method_types: ["card", "boleto"] })).toBeUndefined();
    expect(metodoDaSessao({ id: "cs" })).toBeUndefined();
  });
});

describe("sessão expirada pela troca da forma de pagamento", () => {
  const reserva = (expiraEm: string) => ({ status: "pendente", pagamento: { provedor: "stripe", status: "aguardando", valorCentavos: 100, expiraEm } }) as Pick<Inscricao, "status" | "pagamento">;
  it("não libera a vaga enquanto a reserva vale; libera depois do prazo", () => {
    const agora = new Date("2026-11-06T12:00:00Z");
    expect(expiracaoLiberaReserva(reserva("2026-11-06T12:20:00Z"), agora)).toBe(false);
    expect(expiracaoLiberaReserva(reserva("2026-11-06T11:59:59Z"), agora)).toBe(true);
  });
});

describe("prazo da sessão nova (o Stripe exige 30 minutos)", () => {
  const agora = new Date("2026-11-06T12:00:00Z");
  it("mantém o prazo quando ainda falta mais de 31 minutos", () => {
    expect(prazoDaNovaSessao("2026-11-06T12:32:00Z", agora)).toBe("2026-11-06T12:32:00Z");
  });
  it("estende o prazo numa troca tardia da forma de pagamento", () => {
    expect(prazoDaNovaSessao("2026-11-06T12:10:00Z", agora)).toBe("2026-11-06T12:32:00.000Z");
    expect(prazoDaNovaSessao("2026-11-06T12:30:59Z", agora)).toBe("2026-11-06T12:32:00.000Z");
  });
});

describe("impulso: troca da forma de pagamento", () => {
  const impulso = (criadoEm: string, extra: Partial<ImpulsoComprado> = {}) =>
    ({ id: "imp-1", status: "aguardando_pagamento", criadoEm, precoCentavos: 1000, ...extra }) as ImpulsoComprado;

  it("sessão expirada no prazo de pagamento não cancela a compra; depois do prazo, cancela", () => {
    const agora = new Date("2026-11-06T12:00:00Z");
    expect(expiracaoCancelaImpulso(impulso("2026-11-06T11:30:00Z"), agora)).toBe(false);
    expect(expiracaoCancelaImpulso(impulso("2026-11-06T10:59:00Z"), agora)).toBe(true);
    expect(expiracaoCancelaImpulso(impulso("2026-11-06T11:30:00Z", { status: "processando" }), agora)).toBe(true);
  });

  it("a sessão nova só substitui a que ela trocou", () => {
    const base = { impulsosComprados: [impulso("2026-11-06T11:30:00Z", { sessaoId: "cs_velha" })] } as unknown as BaseDados;
    expect(registrarSessaoImpulsoNaBase(base, "imp-1", "cs_outra").sessaoId).toBe("cs_velha");
    expect(registrarSessaoImpulsoNaBase(base, "imp-1", "cs_nova", "cs_velha").sessaoId).toBe("cs_nova");
    expect(registrarSessaoImpulsoNaBase(base, "imp-1", "cs_x", "cs_velha").sessaoId).toBe("cs_nova");
  });

  it("troca tardia estende o prazo para pagar; a compra não vence antes da sessão nova", () => {
    const base = { impulsosComprados: [impulso("2026-11-06T11:20:00Z", { sessaoId: "cs_velha" })] } as unknown as BaseDados;
    const i = base.impulsosComprados[0]!;
    expect(prazoPagamentoImpulso(i)).toBe("2026-11-06T12:20:00.000Z");
    registrarSessaoImpulsoNaBase(base, "imp-1", "cs_nova", "cs_velha", "2026-11-06T12:32:00.000Z");
    expect(prazoPagamentoImpulso(i)).toBe("2026-11-06T12:32:00.000Z");
    expect(statusDoImpulso(i, new Date("2026-11-06T12:25:00Z"))).toBe("aguardando_pagamento");
    expect(statusDoImpulso(i, new Date("2026-11-06T12:33:00Z"))).toBe("cancelado");
  });

  it("compra que deixou de aguardar o pagamento não aceita sessão nova", () => {
    const base = { impulsosComprados: [impulso("2026-11-06T11:30:00Z", { status: "cancelado", sessaoId: "cs_velha" })] } as unknown as BaseDados;
    expect(registrarSessaoImpulsoNaBase(base, "imp-1", "cs_nova", "cs_velha").sessaoId).toBe("cs_velha");
  });
});

interface Chamada { metodo: string; caminho: string; corpo: string; idempotencia?: string | undefined }

function stripeFalso(resposta: (caminho: string) => Response) {
  const chamadas: Chamada[] = [];
  vi.stubGlobal("fetch", vi.fn(async (url: string, init: RequestInit) => {
    const caminho = url.replace("https://api.stripe.com/v1", "");
    const cab = init.headers as Record<string, string>;
    chamadas.push({ metodo: init.method ?? "GET", caminho, corpo: decodeURIComponent(String(init.body ?? "")), idempotencia: cab["Idempotency-Key"] });
    return resposta(caminho);
  }));
  return chamadas;
}
const ok = (b: unknown) => new Response(JSON.stringify(b), { status: 200 });

describe("Stripe: meios e checkout", () => {
  beforeEach(() => { process.env["STRIPE_SERVER_API_KEY"] = "sk_test_x"; limparCacheMetodos(); });
  afterEach(() => { vi.unstubAllGlobals(); delete process.env["STRIPE_SERVER_API_KEY"]; });

  it("lê os meios ativos uma vez e guarda em cache", async () => {
    const chamadas = stripeFalso(() => ok({ data: [padrao] }));
    expect(await metodosDePagamentoAtivos()).toEqual(["card", "boleto"]);
    expect(await metodosDePagamentoAtivos()).toEqual(["card", "boleto"]);
    expect(chamadas.filter((c) => c.caminho.startsWith("/payment_method_configurations"))).toHaveLength(1);
  });

  it("falha na leitura devolve lista vazia (o checkout segue com os meios do painel)", async () => {
    stripeFalso(() => new Response(JSON.stringify({ error: { message: "x" } }), { status: 500 }));
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await metodosDePagamentoAtivos()).toEqual([]);
  });

  it("o diagnóstico mostra o motivo da falha sem a chave e reconsulta quando pedido", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const chamadas = stripeFalso(() => new Response(JSON.stringify({ error: { message: "The provided key 'rk_live_****abcd' does not have the required permissions" } }), { status: 403 }));
    const d = await diagnosticoMetodosPagamento();
    expect(d.metodos).toEqual([]);
    expect(d.erro).toContain("[chave oculta]");
    expect(d.erro).not.toContain("rk_live");
    await diagnosticoMetodosPagamento();
    await diagnosticoMetodosPagamento(true);
    expect(chamadas).toHaveLength(2);
  });

  const dados = {
    inscricaoId: "ins-1", descricao: "Op", valorCentavos: 15000, expiraEm: "2026-11-06T12:32:00Z",
    urlSucesso: "https://s", urlCancelamento: "https://c",
  };

  it("com meio escolhido, a sessão aceita só ele e a chave muda com a sessão anterior", async () => {
    const chamadas = stripeFalso(() => ok({ id: "cs_novo", url: "https://checkout" }));
    await criarSessaoCheckout({ ...dados, metodo: "pix", sessaoAnterior: "cs_velho" });
    const c = chamadas[0]!;
    expect(c.corpo).toContain("allowed_payment_method_types[0]=pix");
    expect(c.corpo).not.toContain("allowed_payment_method_types[1]");
    expect(c.idempotencia).toBe("checkout-ins-1-pix-cs_velho");
  });

  it("nunca envia payment_method_types, que o Stripe recusa na criação da sessão", async () => {
    const chamadas = stripeFalso(() => ok({ id: "cs", url: "https://checkout" }));
    await criarSessaoCheckout({ ...dados, metodo: "card" });
    expect(chamadas[0]!.corpo).not.toMatch(/(^|&)payment_method_types/);
  });

  it("forma recusada pelo Stripe (400) abre o checkout com os meios do painel", async () => {
    let n = 0;
    const chamadas = stripeFalso(() => (n++ === 0
      ? new Response(JSON.stringify({ error: { code: "parameter_unknown", message: "recusado" } }), { status: 400 })
      : ok({ id: "cs", url: "https://checkout" })));
    const s = await criarSessaoCheckout({ ...dados, metodo: "pix" });
    expect(s.id).toBe("cs");
    expect(chamadas).toHaveLength(2);
    expect(chamadas[1]!.corpo).not.toContain("payment_method_types");
    expect(chamadas[1]!.idempotencia).toBe("checkout-ins-1");
  });

  it("sem meio escolhido mantém a sessão com os meios do painel e a chave de sempre", async () => {
    const chamadas = stripeFalso(() => ok({ id: "cs", url: "https://checkout" }));
    await criarSessaoCheckout(dados);
    expect(chamadas[0]!.corpo).not.toContain("payment_method_types");
    expect(chamadas[0]!.idempotencia).toBe("checkout-ins-1");
  });

  it("checkout do impulso aceita só o meio escolhido, com chave própria da troca", async () => {
    const chamadas = stripeFalso(() => ok({ id: "cs", url: "https://checkout" }));
    await criarSessaoCheckoutImpulso({ impulsoId: "imp-1", descricao: "Impulso", valorCentavos: 1000, expiraEm: "2026-11-06T13:00:00Z", urlSucesso: "https://s", urlCancelamento: "https://c", metodo: "boleto", sessaoAnterior: "cs_velha" });
    await criarSessaoCheckoutImpulso({ impulsoId: "imp-2", descricao: "Impulso", valorCentavos: 1000, expiraEm: "2026-11-06T13:00:00Z", urlSucesso: "https://s", urlCancelamento: "https://c" });
    expect(chamadas[0]!.corpo).toContain("allowed_payment_method_types[0]=boleto");
    expect(chamadas[0]!.idempotencia).toBe("checkout-imp-1-boleto-cs_velha");
    expect(chamadas[1]!.corpo).not.toContain("payment_method_types");
    expect(chamadas[1]!.idempotencia).toBe("checkout-imp-2");
  });
});
