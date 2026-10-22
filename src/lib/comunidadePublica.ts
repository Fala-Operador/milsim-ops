// Vitrine pública das comunidades: qualquer pessoa vê QUE a comunidade existe (porta de entrada),
// mas o conteúdo continua só para inscritos confirmados, organização e administração.
// Aqui se decide o que acontece ao tentar entrar: acessar, fazer login, inscrever-se ou nada.
import { reservaVigente } from "@/lib/pagamentos";
import { papelNoEvento } from "@/services/comunidade";
import type { BaseDados, Evento, Usuario } from "@/lib/domain/types";

export type AcessoComunidade =
  | "entrar" // membro confirmado ou gestão
  | "login" // visitante: entra e volta para decidir
  | "inscrever" // logado sem inscrição, evento com inscrições abertas
  | "pagamento_pendente" // reserva aguardando pagamento: a vaga ainda não é dela
  | "encerrada" // inscrições encerradas ou evento concluído, sem acesso
  | "indisponivel"; // evento inexistente, cancelado ou invisível

/** Eventos cuja comunidade aparece na vitrine para quem ainda não participa. */
const ABERTOS = new Set<Evento["status"]>(["publicado", "inscricoes_encerradas"]);

export function acessoAComunidade(base: BaseDados, usuario: Usuario | null, eventoId: string, agora: Date = new Date()): AcessoComunidade {
  const evento = base.eventos.find((e) => e.id === eventoId);
  if (!evento || evento.status === "cancelado" || evento.status === "arquivado" || evento.status === "rascunho") {
    return papelNoEvento(base, usuario, eventoId) ? "entrar" : "indisponivel";
  }
  if (papelNoEvento(base, usuario, eventoId)) return "entrar";
  if (!usuario?.ativo) return "login";
  const reserva = base.inscricoes.some((i) => i.eventoId === eventoId && i.usuarioId === usuario.id && reservaVigente(i, agora));
  if (reserva) return "pagamento_pendente";
  return evento.status === "publicado" && new Date(evento.fimEm) > agora ? "inscrever" : "encerrada";
}

export interface ItemVitrine {
  evento: Evento;
  acesso: AcessoComunidade;
  /** Inscrições confirmadas (o total já é público pelas vagas do evento). */
  confirmados: number;
}

/**
 * Comunidades da vitrine: as de eventos públicos que ainda não terminaram, mais as que a pessoa já
 * acessa (mesmo de eventos encerrados). As dela primeiro; depois, as próximas operações.
 */
export function comunidadesVitrine(base: BaseDados, usuario: Usuario | null, agora: Date = new Date()): ItemVitrine[] {
  return base.eventos
    .map((evento) => ({ evento, acesso: acessoAComunidade(base, usuario, evento.id, agora) }))
    .filter(({ evento, acesso }) => acesso === "entrar" || (ABERTOS.has(evento.status) && new Date(evento.fimEm) > agora))
    .map(({ evento, acesso }) => ({
      evento,
      acesso,
      confirmados: base.inscricoes.filter((i) => i.eventoId === evento.id && i.status === "confirmada").length,
    }))
    .sort((a, b) => Number(b.acesso === "entrar") - Number(a.acesso === "entrar") || a.evento.inicioEm.localeCompare(b.evento.inicioEm));
}
