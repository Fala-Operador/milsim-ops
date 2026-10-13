// Regras que passaram a rodar no servidor: conta do participante e aceite da fila do check-in.
import { describe, it, expect, beforeEach } from "vitest";
import { carregarBase } from "@/services/db";
import { restaurarBase } from "@/test/baseTeste";
import {
  abrirChamado, enviarEntregaMissao, marcarNotificacoesLidas, responderChamado, solicitarPrivacidade,
} from "@/services/conta";
import { aplicarSincronizacao } from "@/services/checkin";
import { confirmarInscricao } from "@/services/inscricoes";
import type { RegistroCheckin } from "@/lib/checkin";

const u = (id: string) => carregarBase().usuarios.find((x) => x.id === id)!;

beforeEach(() => restaurarBase());

describe("missões", () => {
  it("só quem é destinatário pode entregar", () => {
    const missao = carregarBase().missoes[0]!;
    expect(() => enviarEntregaMissao(u("usr-admin"), missao.id, "texto")).toThrow(/não é destinada/);
  });
});

describe("suporte", () => {
  it("terceiros não respondem chamados alheios; a organização do evento responde", () => {
    const ev = carregarBase().eventos.find((e) => e.id === "evt-serra-verde")!;
    const c = abrirChamado(u("usr-participante"), { assunto: "Dúvida", categoria: "Logística", descricao: "Onde fica?", eventoId: ev.id });
    expect(() => responderChamado(u("usr-ana"), c.id, "intromissão")).toThrow(/não participa/);
    responderChamado(u("usr-organizador"), c.id, "Fica no km 12.");
    const atual = carregarBase().chamados.find((x) => x.id === c.id)!;
    expect(atual.mensagens).toHaveLength(2);
    expect(atual.status).toBe("aguardando_participante");
  });
});

describe("privacidade e notificações", () => {
  it("solicitação notifica os administradores", () => {
    const antes = carregarBase().notificacoes.length;
    solicitarPrivacidade(u("usr-participante"), "exportacao", "Quero meus dados");
    expect(carregarBase().notificacoes.length).toBe(antes + 1);
  });

  it("marcar todas da plataforma é exclusivo do admin", () => {
    expect(() => marcarNotificacoesLidas(u("usr-participante"), true)).toThrow();
    marcarNotificacoesLidas(u("usr-admin"), true);
    expect(carregarBase().notificacoes.every((n) => n.lida)).toBe(true);
  });
});

describe("inscrição", () => {
  it("gera token de entrada na confirmação", async () => {
    const insc = await confirmarInscricao({ eventoId: "evt-araucaria", usuarioId: "usr-ana", tipoId: carregarBase().eventos.find((e) => e.id === "evt-araucaria")!.tipos[0]!.id, exercitoId: carregarBase().eventos.find((e) => e.id === "evt-araucaria")!.exercitos[0]!.id });
    expect(insc.tokenEntrada).toMatch(/^T[A-Z2-9]{20}$/);
  });
});

describe("sincronização do check-in", () => {
  const op = (extra: Partial<RegistroCheckin> = {}): RegistroCheckin => {
    const insc = carregarBase().inscricoes.find((i) => i.eventoId === "evt-serra-verde" && i.status === "confirmada")!;
    return {
      id: "ck-1", eventoId: "evt-serra-verde", inscricaoId: insc.id, tipo: "entrada", origem: "qr",
      operadorId: "usr-organizador", operadorNome: "Org", dispositivoId: "disp-1", em: new Date().toISOString(), sync: "pendente", ...extra,
    };
  };

  it("aceita a entrada e é idempotente", () => {
    const [r1] = aplicarSincronizacao(u("usr-organizador"), [op()]);
    const [r2] = aplicarSincronizacao(u("usr-organizador"), [op()]);
    expect(r1!.sync).toBe("sincronizado");
    expect(r2!.sync).toBe("sincronizado");
    expect(carregarBase().checkins).toHaveLength(1);
  });

  it("segunda entrada do mesmo ingresso vira conflito preservado", () => {
    aplicarSincronizacao(u("usr-organizador"), [op()]);
    const [r] = aplicarSincronizacao(u("usr-organizador"), [op({ id: "ck-2" })]);
    expect(r!.sync).toBe("conflito");
    expect(carregarBase().checkins).toHaveLength(2);
  });

  it("participante não sincroniza; registro de outro operador é sinalizado", () => {
    expect(() => aplicarSincronizacao(u("usr-participante"), [op()])).toThrow(/não tem acesso/);
    const [r] = aplicarSincronizacao(u("usr-admin"), [op()]);
    expect(r!.sync).toBe("conflito");
  });
});
