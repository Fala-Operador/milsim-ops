// Ciclo de vida automático do evento: depois do término, a operação vira "concluido".
// Sem isso, "participou", insígnias e recompensas nunca contavam (dependem de concluido).
// Não há tarefa agendada no servidor: a conclusão é aplicada pela unidade de trabalho
// (src/server/unidade.server.ts) na primeira leitura ou gravação depois do fim do evento.
import type { BaseDados, Evento } from "@/lib/domain/types";

/** Status que terminam sozinhos no fim do evento (rascunho, cancelado e arquivado não mudam). */
const EM_ANDAMENTO = new Set<Evento["status"]>(["publicado", "inscricoes_encerradas"]);

export function deveConcluir(e: Pick<Evento, "status" | "fimEm">, agora: Date = new Date()): boolean {
  const fim = new Date(e.fimEm).getTime();
  return EM_ANDAMENTO.has(e.status) && Number.isFinite(fim) && fim <= agora.getTime();
}

export function eventosParaConcluir(base: Pick<BaseDados, "eventos">, agora: Date = new Date()): Evento[] {
  return base.eventos.filter((e) => deveConcluir(e, agora));
}

/**
 * Conclui na base os eventos já terminados e registra na auditoria (autor "sistema").
 * Idempotente: um evento concluído não volta a ser tocado. Devolve os ids concluídos.
 * O recálculo de participação/insígnias/recompensas é feito por quem grava (mutar), que
 * já roda `recalcularProgressao` quando a coleção de eventos muda.
 */
export function concluirEventosEncerrados(base: Pick<BaseDados, "eventos" | "auditoria">, agora: Date, novoId: () => string): string[] {
  const concluidos: string[] = [];
  for (const e of eventosParaConcluir(base, agora)) {
    e.status = "concluido";
    concluidos.push(e.id);
    base.auditoria.push({
      id: novoId(),
      autorId: "sistema",
      acao: "conclusao_automatica_evento",
      entidade: "evento",
      entidadeId: e.id,
      justificativa: `Operação "${e.nome}" concluída automaticamente após o término (${e.fimEm}).`,
      criadoEm: agora.toISOString(),
    });
  }
  return concluidos;
}
