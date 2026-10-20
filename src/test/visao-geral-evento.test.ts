import { describe, expect, it } from "vitest";
import { baseVazia } from "@/lib/persistencia";
import { cancelamentosDoEvento, visaoGeralEvento } from "@/lib/visaoGeralEvento";
import type { RegistroCheckin } from "@/lib/checkin";
import type { BaseDados, Chamado, Evento, Inscricao } from "@/lib/domain/types";

const AGORA = new Date("2026-10-20T12:00:00Z");

const evento = {
  id: "e1",
  capacidadeTotal: 10,
  tipos: [{ id: "t1", nome: "Padrão", quantidadeMaxima: 8 }, { id: "t2", nome: "VIP", quantidadeMaxima: 2, arquivado: true }],
  exercitos: [{ id: "a", nome: "Azul", capacidade: 5 }, { id: "v", nome: "Vermelho", capacidade: 5 }],
} as Evento;

const ins = (id: string, status: Inscricao["status"], extra: Partial<Inscricao> = {}) =>
  ({ id, eventoId: "e1", usuarioId: "u", tipoId: "t1", exercitoId: "a", status, origem: "plataforma", criadoEm: "2026-10-01T00:00:00Z", ...extra }) as Inscricao;

const entrada = (id: string, inscricaoId: string, extra: Partial<RegistroCheckin> = {}) =>
  ({ id, eventoId: "e1", inscricaoId, tipo: "entrada", em: "2026-10-20T08:00:00Z", sync: "sincronizado", ...extra }) as RegistroCheckin;

const chamado = (id: string, status: Chamado["status"], atualizadoEm: string, eventoId = "e1") =>
  ({ id, eventoId, solicitanteId: "u", status, mensagens: [], criadoEm: atualizadoEm, atualizadoEm }) as unknown as Chamado;

function montar(p: Partial<BaseDados>): BaseDados {
  return { ...baseVazia(), eventos: [evento], ...p };
}

describe("visão geral do evento (admin)", () => {
  it("evento inexistente devolve null", () => {
    expect(visaoGeralEvento(montar({}), "outro", AGORA)).toBeNull();
  });

  it("conta ingressos por status e ignora outros eventos e reservas vencidas", () => {
    const base = montar({
      inscricoes: [
        ins("1", "confirmada"),
        ins("2", "confirmada", { tipoId: "t2", exercitoId: "v", origem: "cortesia" }),
        ins("3", "estornada", { pagamento: { status: "estornado" } as Inscricao["pagamento"] }),
        ins("4", "cancelada"),
        ins("5", "pendente", { pagamento: { status: "aguardando", expiraEm: "2026-10-20T13:00:00Z" } as Inscricao["pagamento"] }),
        ins("6", "pendente", { pagamento: { status: "aguardando", expiraEm: "2026-10-20T11:00:00Z" } as Inscricao["pagamento"] }),
        ins("7", "confirmada", { eventoId: "e2" }),
      ],
    });
    const v = visaoGeralEvento(base, "e1", AGORA)!;
    expect(v.ingressos).toEqual({ confirmados: 2, aguardandoPagamento: 1, cancelados: 1, estornados: 1, capacidade: 10, ocupacao: 20 });
    expect(v.porTipo.map((t) => [t.id, t.vendidos, t.limite, t.arquivado])).toEqual([["t1", 1, 8, false], ["t2", 1, 2, true]]);
    expect(v.porOrigem).toMatchObject({ plataforma: 1, cortesia: 1 });
    expect(v.pagamentos.reembolsados).toBe(1);
  });

  it("check-in conta só entradas vigentes de inscrições confirmadas", () => {
    const base = montar({
      inscricoes: [ins("1", "confirmada"), ins("2", "confirmada", { exercitoId: "v" }), ins("3", "estornada")],
      checkins: [
        entrada("c1", "1"),
        entrada("c2", "2"),
        { ...entrada("r2", "2"), tipo: "reversao", revertidoId: "c2" },
        entrada("c3", "3"),
      ],
    });
    const v = visaoGeralEvento(base, "e1", AGORA)!;
    expect(v.checkin).toEqual({ presentes: 1, confirmados: 2, percentual: 50 });
    expect(v.porExercito.map((x) => [x.id, x.confirmados, x.presentes])).toEqual([["a", 1, 1], ["v", 1, 0]]);
  });

  it("suporte: só chamados do evento, abertos à parte e mais recentes primeiro", () => {
    const base = montar({
      chamados: [
        chamado("c1", "resolvido", "2026-10-10T00:00:00Z"),
        chamado("c2", "aberto", "2026-10-15T00:00:00Z"),
        chamado("c3", "aberto", "2026-10-16T00:00:00Z", "e2"),
      ],
    });
    const v = visaoGeralEvento(base, "e1", AGORA)!;
    expect(v.suporte.total).toBe(2);
    expect(v.suporte.emAberto).toBe(1);
    expect(v.suporte.porStatus).toEqual({ resolvido: 1, aberto: 1 });
    expect(v.suporte.chamados.map((c) => c.id)).toEqual(["c2", "c1"]);
  });

  it("contestação em aberto e reembolso pendente aparecem nos pagamentos", () => {
    const base = montar({
      inscricoes: [
        ins("1", "confirmada", { pagamento: { status: "pago", disputa: { status: "aberta" } } as Inscricao["pagamento"] }),
        ins("2", "confirmada", { pagamento: { status: "pago", disputa: { status: "ganha" } } as Inscricao["pagamento"] }),
        ins("3", "estornada", { pagamento: { status: "estorno_pendente" } as Inscricao["pagamento"] }),
      ],
    });
    expect(visaoGeralEvento(base, "e1", AGORA)!.pagamentos).toEqual({ pagosOnline: 2, reembolsosPendentes: 1, reembolsados: 0, contestacoesAbertas: 1 });
  });

  it("cancelamentos e estornos mais recentes primeiro", () => {
    const base = montar({
      inscricoes: [
        ins("1", "cancelada", { canceladoEm: "2026-10-02T00:00:00Z" }),
        ins("2", "confirmada"),
        ins("3", "estornada", { canceladoEm: "2026-10-05T00:00:00Z" }),
      ],
    });
    expect(cancelamentosDoEvento(base, "e1").map((i) => i.id)).toEqual(["3", "1"]);
  });
});
