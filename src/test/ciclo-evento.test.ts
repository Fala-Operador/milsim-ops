// Ciclo do evento: depois do término, a operação vira "concluido" sozinha, e quem fez check-in
// passa a contar como "participou" (insígnias e recompensas deixam de ficar travadas).
import { beforeEach, describe, expect, it } from "vitest";
import { restaurarBase } from "@/test/baseTeste";
import { concluirEventosEncerrados, deveConcluir, eventosParaConcluir } from "@/lib/cicloEvento";
import { participacoesDoUsuario } from "@/lib/participacao";
import { recalcularProgressao } from "@/services/progressao";
import type { BaseDados, Evento } from "@/lib/domain/types";

const AGORA = new Date("2026-10-23T12:00:00Z");
const antes = (h: number) => new Date(AGORA.getTime() - h * 3_600_000).toISOString();
const depois = (h: number) => new Date(AGORA.getTime() + h * 3_600_000).toISOString();
const ev = (status: Evento["status"], fimEm: string) => ({ status, fimEm }) as Pick<Evento, "status" | "fimEm">;
let n = 0;
const novoId = () => `aud-${++n}`;

describe("quando concluir", () => {
  it("publicado ou com inscrições encerradas, depois do término", () => {
    expect(deveConcluir(ev("publicado", antes(1)), AGORA)).toBe(true);
    expect(deveConcluir(ev("inscricoes_encerradas", antes(1)), AGORA)).toBe(true);
    expect(deveConcluir(ev("publicado", AGORA.toISOString()), AGORA)).toBe(true);
  });

  it("não mexe em evento que ainda não terminou nem em rascunho, cancelado, arquivado ou já concluído", () => {
    expect(deveConcluir(ev("publicado", depois(1)), AGORA)).toBe(false);
    for (const s of ["rascunho", "cancelado", "arquivado", "concluido"] as const) {
      expect(deveConcluir(ev(s, antes(48)), AGORA), s).toBe(false);
    }
    expect(deveConcluir(ev("publicado", "data inválida"), AGORA)).toBe(false);
  });
});

describe("conclusão na base", () => {
  let base: BaseDados;
  const PART = "usr-participante";
  const EVT = "evt-trovao";

  beforeEach(() => {
    base = restaurarBase();
    base.insignias.push({
      id: "ins-primeira", nome: "Primeira operação", descricao: "", icone: "🎖️", criterio: { tipo: "operacoes", meta: 1 },
      ativa: true, versao: 1, criadoEm: "", atualizadoEm: "",
    });
    // Evento real que terminou ontem mas ficou "publicado" (o caso de hoje em produção).
    const e = base.eventos.find((x) => x.id === EVT)!;
    e.status = "publicado";
    e.fimEm = antes(20);
    const ins = base.inscricoes.find((i) => i.id === "ins-hist-1")!;
    ins.usuarioId = PART;
    ins.status = "confirmada";
    base.checkins.push({
      id: "c1", eventoId: EVT, inscricaoId: "ins-hist-1", tipo: "entrada", origem: "qr", operadorId: "op", operadorNome: "Op",
      dispositivoId: "d", em: antes(26), sync: "sincronizado",
    });
  });

  it("antes da conclusão a presença não conta; depois conta e a insígnia é concedida", () => {
    expect(participacoesDoUsuario(base, PART).find((p) => p.eventoId === EVT)?.estado).toBe("participando");
    expect(eventosParaConcluir(base, AGORA).map((e) => e.id)).toContain(EVT);

    const ids = concluirEventosEncerrados(base, AGORA, novoId);
    recalcularProgressao(base, AGORA);

    expect(ids).toContain(EVT);
    expect(base.eventos.find((e) => e.id === EVT)!.status).toBe("concluido");
    expect(participacoesDoUsuario(base, PART).find((p) => p.eventoId === EVT)?.estado).toBe("participou");
    expect(base.concessoesInsignia.some((c) => c.usuarioId === PART && c.insigniaId === "ins-primeira")).toBe(true);
  });

  it("registra na auditoria como sistema e é idempotente", () => {
    concluirEventosEncerrados(base, AGORA, novoId);
    const registros = base.auditoria.filter((a) => a.acao === "conclusao_automatica_evento" && a.entidadeId === EVT);
    expect(registros).toHaveLength(1);
    expect(registros[0]!.autorId).toBe("sistema");
    expect(concluirEventosEncerrados(base, AGORA, novoId)).toEqual([]);
    expect(base.auditoria.filter((a) => a.acao === "conclusao_automatica_evento" && a.entidadeId === EVT)).toHaveLength(1);
  });

  it("evento que ainda não terminou continua publicado", () => {
    base.eventos.find((x) => x.id === EVT)!.fimEm = depois(5);
    expect(concluirEventosEncerrados(base, AGORA, novoId)).not.toContain(EVT);
    expect(base.eventos.find((e) => e.id === EVT)!.status).toBe("publicado");
  });
});
