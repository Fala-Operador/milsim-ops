import { beforeEach, describe, expect, it } from "vitest";
import { restaurarBase } from "./baseTeste";
import type { BaseDados, Usuario } from "@/lib/domain/types";
import { POSICAO_LISTAGEM } from "@/lib/domain/types";
import { impulsosDaOrganizacao, pendenciasUso, planosDeImpulso, statusDoImpulso } from "@/lib/impulsos";
import { campanhasNaPosicao } from "@/lib/impulsionamento";
import { NACIONAL } from "@/lib/divulgacao";
import { visaoParaUsuario } from "@/lib/visao";
import {
  cancelarImpulsoNaBase, confirmarImpulsoNaBase, criarCompraImpulsoNaBase, registrarReembolsoImpulsoNaBase,
  salvarPlanosImpulsoNaBase, usarImpulsoNaBase,
} from "@/services/impulsos";

let base: BaseDados;
let org: Usuario;
let admin: Usuario;
const agora = new Date();
const HORA = 3_600_000;
const DIA = 24 * HORA;
const EVENTO = "evt-amazonia"; // publicado, termina em ~70 dias

beforeEach(() => {
  base = restaurarBase();
  org = base.usuarios.find((u) => u.id === "usr-organizador")!;
  admin = base.usuarios.find((u) => u.id === "usr-admin")!;
  for (const e of base.eventos) e.imagemUrl = "https://exemplo.com/capa.jpg";
});

function comprado(planoId: "24h" | "7d" | "30d" = "7d", quando = agora) {
  const i = criarCompraImpulsoNaBase(base, org, planoId, { pagamentoOnline: true }, quando);
  confirmarImpulsoNaBase(base, i.id, { sessaoId: "cs_1", intencaoId: "pi_1" }, quando);
  return i;
}

describe("tipos de impulso", () => {
  it("seis tipos com preço padrão e validade de 30 dias", () => {
    const planos = planosDeImpulso(base);
    expect(planos.map((p) => p.id)).toEqual(["24h", "3d", "5d", "7d", "15d", "30d"]);
    expect(planos.map((p) => p.duracaoHoras)).toEqual([24, 72, 120, 168, 360, 720]);
    expect(planos.every((p) => p.validadeDias === 30 && p.ativo && p.precoCentavos > 0)).toBe(true);
  });

  it("administração muda preço e validade; compras já feitas mantêm os valores da compra", () => {
    const antes = comprado("7d");
    salvarPlanosImpulsoNaBase(base, admin, [{ id: "7d", precoCentavos: 5000, validadeDias: 14, ativo: true }]);
    const p = planosDeImpulso(base).find((x) => x.id === "7d")!;
    expect([p.precoCentavos, p.validadeDias]).toEqual([5000, 14]);
    expect([antes.precoCentavos, antes.validadeDias]).toEqual([4490, 30]);
    expect(() => salvarPlanosImpulsoNaBase(base, admin, [{ id: "7d", precoCentavos: 5000, validadeDias: 0, ativo: true }])).toThrow(/validade/);
  });

  it("tipo fora de venda não pode ser comprado", () => {
    salvarPlanosImpulsoNaBase(base, admin, [{ id: "24h", precoCentavos: 990, validadeDias: 30, ativo: false }]);
    expect(() => criarCompraImpulsoNaBase(base, org, "24h", { pagamentoOnline: true })).toThrow(/não está à venda/);
  });
});

describe("compra", () => {
  it("só o organizador compra, para a própria organização", () => {
    const participante = base.usuarios.find((u) => u.perfil === "participante")!;
    expect(() => criarCompraImpulsoNaBase(base, participante, "7d", { pagamentoOnline: true })).toThrow(/organização/);
    expect(() => criarCompraImpulsoNaBase(base, admin, "7d", { pagamentoOnline: true })).toThrow(/organização/);
    expect(criarCompraImpulsoNaBase(base, org, "7d", { pagamentoOnline: true }).organizacaoId).toBe("org-bravo");
  });

  it("aguarda o pagamento e, pago, vale 30 dias a partir do pagamento", () => {
    const i = criarCompraImpulsoNaBase(base, org, "7d", { pagamentoOnline: true }, agora);
    expect(statusDoImpulso(i, agora)).toBe("aguardando_pagamento");
    const pago = new Date(agora.getTime() + 10 * 60_000);
    confirmarImpulsoNaBase(base, i.id, { sessaoId: "cs_1", intencaoId: "pi_1" }, pago);
    confirmarImpulsoNaBase(base, i.id, {}, new Date(pago.getTime() + DIA)); // repetido: nada muda
    expect(i.status).toBe("disponivel");
    expect(i.expiraEm).toBe(new Date(pago.getTime() + 30 * DIA).toISOString());
    expect(statusDoImpulso(i, new Date(pago.getTime() + 30 * DIA + 1))).toBe("expirado");
    expect(base.notificacoes.filter((n) => n.titulo === "Impulso disponível")).toHaveLength(1);
  });

  it("sem pagamentos online, só tipos gratuitos; gratuito já fica disponível", () => {
    expect(() => criarCompraImpulsoNaBase(base, org, "7d", { pagamentoOnline: false })).toThrow(/pagamentos online/);
    salvarPlanosImpulsoNaBase(base, admin, [{ id: "24h", precoCentavos: 0, validadeDias: 30, ativo: true }]);
    expect(criarCompraImpulsoNaBase(base, org, "24h", { pagamentoOnline: false }).status).toBe("disponivel");
  });

  it("compra não paga some da lista depois do prazo do checkout ou quando a sessão expira", () => {
    const a = criarCompraImpulsoNaBase(base, org, "7d", { pagamentoOnline: true }, agora);
    const b = criarCompraImpulsoNaBase(base, org, "3d", { pagamentoOnline: true }, agora);
    cancelarImpulsoNaBase(base, b.id);
    expect(impulsosDaOrganizacao(base, "org-bravo", agora).map((i) => i.id)).toEqual([a.id]);
    expect(impulsosDaOrganizacao(base, "org-bravo", new Date(agora.getTime() + 2 * HORA))).toHaveLength(0);
  });
});

describe("uso", () => {
  it("cria campanha ativa nos destaques e na listagem pelo período do impulso", () => {
    const i = comprado("7d");
    const c = usarImpulsoNaBase(base, org, i.id, EVENTO, agora);
    expect(c.posicoes).toEqual(["sec-destaques", POSICAO_LISTAGEM]);
    expect(c.abrangencia).toEqual(NACIONAL);
    expect(new Date(c.fimEm).getTime() - new Date(c.inicioEm).getTime()).toBe(7 * DIA);
    expect(i.status).toBe("usado");
    expect(c.impulsoId).toBe(i.id);
    expect(campanhasNaPosicao(base, POSICAO_LISTAGEM, NACIONAL, new Date(agora.getTime() + HORA)).map((x) => x.id)).toContain(c.id);
    expect(() => usarImpulsoNaBase(base, org, i.id, EVENTO, agora)).toThrow(/não está disponível/);
  });

  it("segundo impulso no mesmo evento começa quando o anterior termina", () => {
    const a = usarImpulsoNaBase(base, org, comprado("7d").id, EVENTO, agora);
    const b = usarImpulsoNaBase(base, org, comprado("24h").id, EVENTO, agora);
    expect(b.inicioEm).toBe(a.fimEm);
  });

  it("termina junto com o evento quando o evento acaba antes", () => {
    const e = base.eventos.find((x) => x.id === EVENTO)!;
    e.fimEm = new Date(agora.getTime() + 2 * DIA).toISOString();
    const c = usarImpulsoNaBase(base, org, comprado("7d").id, EVENTO, agora);
    expect(c.fimEm).toBe(e.fimEm);
  });

  it("não usa impulso expirado, em evento de rascunho, sem imagem ou de outra organização", () => {
    const i = comprado("7d");
    expect(pendenciasUso(base, i, base.eventos.find((e) => e.id === EVENTO), new Date(agora.getTime() + 31 * DIA))[0]).toMatch(/expirou/);
    expect(() => usarImpulsoNaBase(base, org, i.id, "evt-raposa", agora)).toThrow(/publicada/);
    base.eventos.find((e) => e.id === EVENTO)!.imagemUrl = undefined;
    expect(() => usarImpulsoNaBase(base, org, i.id, EVENTO, agora)).toThrow(/imagem/);
    base.eventos.find((e) => e.id === "evt-cerrado")!.organizacaoId = "org-outra";
    expect(() => usarImpulsoNaBase(base, org, i.id, "evt-cerrado", agora)).toThrow(/sua organização/);
  });

  it("reembolso cancela o impulso e encerra a campanha", () => {
    const i = comprado("7d");
    const c = usarImpulsoNaBase(base, org, i.id, EVENTO, agora);
    registrarReembolsoImpulsoNaBase(base, i.id);
    expect(i.status).toBe("reembolsado");
    expect(c.status).toBe("encerrado");
  });
});

describe("visão", () => {
  it("compras só para a organização (sem ids do Stripe) e a administração; preços para todos", () => {
    const i = comprado("7d");
    usarImpulsoNaBase(base, org, i.id, EVENTO, agora);
    const participante = base.usuarios.find((u) => u.perfil === "participante")!;
    const vOrg = visaoParaUsuario(base, org);
    expect(vOrg.impulsosComprados[0]!.sessaoId).toBeUndefined();
    expect(vOrg.impulsosComprados[0]!.intencaoId).toBeUndefined();
    expect(visaoParaUsuario(base, admin).impulsosComprados[0]!.intencaoId).toBe("pi_1");
    const vPub = visaoParaUsuario(base, participante);
    expect(vPub.impulsosComprados).toHaveLength(0);
    expect(vPub.impulsionamentos.every((c) => c.impulsoId === undefined)).toBe(true);
    expect(visaoParaUsuario(base, null).planosImpulso).toEqual(base.planosImpulso);
  });
});
