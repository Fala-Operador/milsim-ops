// Regras do Perfil do Operador: participação, insígnias, vouchers e privacidade.
import { describe, it, expect, beforeEach } from "vitest";
import { restaurarBase } from "@/test/baseTeste";
import { participacoesDoUsuario, resumir, descontoDoBeneficio } from "@/lib/participacao";
import { recalcularProgressao, restaurarVoucherDaInscricao } from "@/services/progressao";
import { montarPerfil } from "@/lib/perfilSocial";
import { visaoParaUsuario } from "@/lib/visao";
import { confirmarInscricao } from "@/services/inscricoes";
import type { BaseDados, Usuario } from "@/lib/domain/types";

let base: BaseDados;
const PART = "usr-participante";
const u = (id: string) => base.usuarios.find((x) => x.id === id)!;
const entrada = (id: string, inscricaoId: string, eventoId: string, extra = {}) => ({
  id, eventoId, inscricaoId, tipo: "entrada" as const, origem: "qr" as const, operadorId: "op", operadorNome: "Op",
  dispositivoId: "d", em: "2026-01-01T10:00:00.000Z", sync: "sincronizado" as const, ...extra,
});

beforeEach(() => {
  base = restaurarBase();
  base.insignias.push({
    id: "ins-primeira", nome: "Primeira operação", descricao: "", icone: "🎖️", criterio: { tipo: "operacoes", meta: 1 },
    ativa: true, versao: 1, criadoEm: "", atualizadoEm: "",
  });
  const ins = base.inscricoes.find((i) => i.id === "ins-hist-1")!;
  ins.usuarioId = PART;
  ins.status = "confirmada";
});

describe("participação", () => {
  it("inscrição sem check-in em evento concluído não conta", () => {
    expect(resumir(participacoesDoUsuario(base, PART)).operacoes).toBe(0);
  });

  it("check-in vigente em evento concluído conta uma vez", () => {
    base.checkins.push(entrada("c1", "ins-hist-1", "evt-trovao"), entrada("c2", "ins-hist-1", "evt-trovao"));
    expect(resumir(participacoesDoUsuario(base, PART)).operacoes).toBe(1);
  });

  it("check-in revertido deixa de contar", () => {
    base.checkins.push(entrada("c1", "ins-hist-1", "evt-trovao"), { ...entrada("r1", "ins-hist-1", "evt-trovao"), tipo: "reversao", revertidoId: "c1" });
    expect(resumir(participacoesDoUsuario(base, PART)).operacoes).toBe(0);
  });

  it("invalidação administrativa remove a participação", () => {
    base.checkins.push(entrada("c1", "ins-hist-1", "evt-trovao"));
    base.correcoesParticipacao.push({ id: "x", usuarioId: PART, eventoId: "evt-trovao", tipo: "invalidar", justificativa: "fraude", autorId: "usr-admin", criadoEm: "2026-09-01T00:00:00Z" });
    expect(participacoesDoUsuario(base, PART).find((p) => p.eventoId === "evt-trovao")?.estado).toBeUndefined();
  });
});

describe("status Participando / Participou", () => {
  it("inscrição confirmada em evento não finalizado é Participando e não conta", () => {
    base.eventos.find((e) => e.id === "evt-trovao")!.status = "publicado";
    const p = participacoesDoUsuario(base, PART).find((x) => x.eventoId === "evt-trovao");
    expect(p?.estado).toBe("participando");
    expect(resumir(participacoesDoUsuario(base, PART)).estados).toEqual([]);
  });
  it("evento finalizado com check-in válido é Participou", () => {
    base.checkins.push(entrada("c1", "ins-hist-1", "evt-trovao"));
    expect(participacoesDoUsuario(base, PART).find((x) => x.eventoId === "evt-trovao")?.estado).toBe("participou");
  });
  it("evento finalizado sem presença não aparece", () => {
    expect(participacoesDoUsuario(base, PART).find((x) => x.eventoId === "evt-trovao")).toBeUndefined();
  });
  it("inscrição cancelada não aparece como Participando", () => {
    base.eventos.find((e) => e.id === "evt-trovao")!.status = "publicado";
    base.inscricoes.find((i) => i.id === "ins-hist-1")!.status = "cancelada";
    expect(participacoesDoUsuario(base, PART).find((x) => x.eventoId === "evt-trovao")).toBeUndefined();
  });
});

describe("insígnias e vouchers", () => {
  beforeEach(() => {
    base.checkins.push(entrada("c1", "ins-hist-1", "evt-trovao"));
    base.campanhasRecompensa.push({
      id: "cmp", nome: "20%", descricao: "", insigniaId: "ins-primeira", organizacaoId: "org-bravo", tipo: "percentual", valor: 20,
      eventosElegiveis: ["evt-serra-verde"], tiposElegiveis: [], maximo: 10, limitePorParticipante: 1,
      inicioEm: "2020-01-01T00:00:00Z", conquistarAte: "2099-01-01T00:00:00Z", resgatarAte: "2099-06-01T00:00:00Z",
      regras: "", aceitaAnteriores: true, ativa: true, versao: 1, criadoPor: "x", criadoEm: "",
    });
  });

  it("recalcular duas vezes não duplica insígnia nem voucher", () => {
    recalcularProgressao(base);
    recalcularProgressao(base);
    expect(base.concessoesInsignia.filter((c) => c.usuarioId === PART)).toHaveLength(1);
    expect(base.vouchers.filter((v) => v.usuarioId === PART)).toHaveLength(1);
  });

  it("campanha sem retroatividade ignora conquistas anteriores ao início", () => {
    base.campanhasRecompensa[0]!.aceitaAnteriores = false;
    base.campanhasRecompensa[0]!.inicioEm = "2098-01-01T00:00:00Z";
    recalcularProgressao(base);
    expect(base.vouchers).toHaveLength(0);
  });

  it("presença revertida revoga voucher não usado", () => {
    recalcularProgressao(base);
    base.checkins.push({ ...entrada("r1", "ins-hist-1", "evt-trovao"), tipo: "reversao", revertidoId: "c1" });
    recalcularProgressao(base);
    expect(base.vouchers[0]!.status).toBe("revogada");
    expect(base.concessoesInsignia[0]!.revogadaEm).toBeTruthy();
  });

  it("voucher usado com conquista revogada vira ocorrência, sem cancelar nada", () => {
    recalcularProgressao(base);
    base.vouchers[0]!.status = "utilizada";
    base.checkins.push({ ...entrada("r1", "ins-hist-1", "evt-trovao"), tipo: "reversao", revertidoId: "c1" });
    recalcularProgressao(base);
    expect(base.vouchers[0]!.status).toBe("utilizada");
    expect(base.vouchers[0]!.ocorrencia).toBeTruthy();
  });

  it("restaura o benefício quando a inscrição é cancelada no prazo", () => {
    recalcularProgressao(base);
    Object.assign(base.vouchers[0]!, { status: "utilizada", inscricaoId: "ins-x" });
    restaurarVoucherDaInscricao(base, "ins-x", "evento cancelado");
    expect(base.vouchers[0]!.status).toBe("disponivel");
    expect(base.vouchers).toHaveLength(1);
  });

  it("desconto nunca deixa valor negativo", () => {
    expect(descontoDoBeneficio({ tipo: "fixo", valor: 99999 }, 5000)).toBe(5000);
    expect(descontoDoBeneficio({ tipo: "gratuito", valor: 0 }, 5000)).toBe(5000);
    expect(descontoDoBeneficio({ tipo: "percentual", valor: 20 }, 5000)).toBe(1000);
  });

  it("voucher não acumula com cupom", async () => {
    recalcularProgressao(base);
    await expect(confirmarInscricao({
      eventoId: "evt-serra-verde", usuarioId: "usr-admin", tipoId: base.eventos.find((e) => e.id === "evt-serra-verde")!.tipos[0]!.id,
      exercitoId: base.eventos.find((e) => e.id === "evt-serra-verde")!.exercitos[0]!.id, voucherId: (base.vouchers[0]!.usuarioId = "usr-admin", base.vouchers[0]!.id), codigoCupom: "QUALQUER",
    })).rejects.toThrow(/cupom/i);
  });
});

describe("privacidade do perfil", () => {
  beforeEach(() => base.checkins.push(entrada("c1", "ins-hist-1", "evt-trovao")));
  const outro = (): Usuario => u("usr-admin");

  it("blocos começam privados para terceiros e visitantes só veem nome e foto", () => {
    const p = montarPerfil(base, PART, outro())!;
    expect(p.operacoes).toBeUndefined();
    expect(p.mapa).toBeUndefined();
    expect(p.equipamentos).toBeUndefined();
    const vis = montarPerfil(base, PART, null)!;
    expect(vis.restrito).toBe(true);
    expect(vis.social).toBeUndefined();
  });

  it("operação oculta não aparece em contadores nem mapa de terceiros", () => {
    base.perfisOperador.push({ usuarioId: PART, privacidade: { historico: "autenticados", mapa: "autenticados", insignias: "autenticados", equipamentos: "eu", fotos: "eu" }, operacoesOcultas: ["evt-trovao"], introVista: true, atualizadoEm: "" });
    const p = montarPerfil(base, PART, outro())!;
    expect(p.resumo.operacoes).toBe(0);
    expect(p.mapa).toEqual([]);
    expect(montarPerfil(base, PART, u(PART))!.resumo.operacoes).toBe(1);
  });

  it("perfil nunca expõe exército, CPF ou e-mail", () => {
    base.perfisOperador.push({ usuarioId: PART, privacidade: { historico: "autenticados", mapa: "autenticados", insignias: "autenticados", equipamentos: "autenticados", fotos: "autenticados" }, operacoesOcultas: [], introVista: true, atualizadoEm: "" });
    const json = JSON.stringify(montarPerfil(base, PART, outro()));
    expect(json).not.toContain(u(PART).cpf);
    expect(json).not.toContain(u(PART).email);
    expect(json).not.toContain("exercito");
  });

  it("nota fiscal e equipamentos de outra pessoa não chegam ao navegador (nem para admin)", () => {
    base.equipamentos.push({ id: "eq1", usuarioId: PART, marca: "M", tipo: "aeg", modelo: "X", fotos: [], visivel: true, nota: { nome: "nf.pdf", tipo: "application/pdf", tamanho: 1, enviadaEm: "" }, criadoEm: "", atualizadoEm: "" });
    expect(visaoParaUsuario(base, outro()).equipamentos).toEqual([]);
    base.perfisOperador.push({ usuarioId: PART, privacidade: { historico: "eu", mapa: "eu", insignias: "eu", equipamentos: "autenticados", fotos: "eu" }, operacoesOcultas: [], introVista: true, atualizadoEm: "" });
    expect(JSON.stringify(montarPerfil(base, PART, outro()))).not.toContain("nf.pdf");
  });
});
