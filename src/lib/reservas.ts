// Regras puras da reserva com pagamento por PIX (sem rede, sem React).
//
// Fluxo: inscrição paga em evento com PIX configurado vira RESERVA
// ("aguardando_pagamento", válida até `reservaAte`) → participante envia o comprovante
// ("em_analise": a vaga fica presa até a decisão) → organização APROVA ("confirmada")
// ou RECUSA ("recusada"). Reserva sem comprovante no prazo EXPIRA ("expirada").
// Enquanto ocupa vaga, a reserva também prende o cupom/benefício usado; ao expirar,
// ser recusada ou cancelada, ambos são devolvidos (ver services/inscricoes.ts).
import type { Evento, Inscricao, StatusInscricao } from "@/lib/domain/types";

export const PRAZO_PADRAO_HORAS = 48;
export const PRAZO_MINIMO_HORAS = 1;
export const PRAZO_MAXIMO_HORAS = 168; // 7 dias

/** Status que representam uma reserva com pagamento pendente. */
export const STATUS_PENDENTES: readonly StatusInscricao[] = ["aguardando_pagamento", "em_analise"];
export const pendente = (i: Pick<Inscricao, "status">) => STATUS_PENDENTES.includes(i.status);

const instante = (agora: Date | number) => (typeof agora === "number" ? agora : agora.getTime());

/** Reserva sem comprovante cujo prazo já passou (ainda não varrida para "expirada"). */
export function reservaVencida(i: Pick<Inscricao, "status" | "reservaAte">, agora: Date | number = Date.now()): boolean {
  return i.status === "aguardando_pagamento" && !!i.reservaAte && Date.parse(i.reservaAte) <= instante(agora);
}

/**
 * A inscrição ocupa vaga? Confirmadas sempre; reservas enquanto válidas; com comprovante
 * enviado, até a organização decidir. É a base de TODA contagem de capacidade.
 */
export function ocupaVaga(i: Pick<Inscricao, "status" | "reservaAte">, agora: Date | number = Date.now()): boolean {
  if (i.status === "confirmada" || i.status === "em_analise") return true;
  return i.status === "aguardando_pagamento" && !reservaVencida(i, agora);
}

/** Status mostrado nas telas: reserva vencida aparece como expirada antes mesmo da varredura. */
export function statusEfetivo(i: Pick<Inscricao, "status" | "reservaAte">, agora: Date | number = Date.now()): StatusInscricao {
  return reservaVencida(i, agora) ? "expirada" : i.status;
}

/** O evento cobra por PIX manual? (Inscrições gratuitas e cortesias são confirmadas na hora.) */
export function exigePagamento(evento: Pick<Evento, "pagamento">, valorFinalCentavos: number): boolean {
  return !!evento.pagamento?.chavePix?.trim() && valorFinalCentavos > 0;
}

export function prazoDaReserva(evento: Pick<Evento, "pagamento">, agora: Date = new Date()): string {
  const horas = evento.pagamento?.prazoHoras ?? PRAZO_PADRAO_HORAS;
  return new Date(agora.getTime() + horas * 3_600_000).toISOString();
}

/** Valida a configuração de PIX do evento (devolve mensagens de erro). */
export function validarPagamento(p: Evento["pagamento"]): string[] {
  if (!p) return [];
  const erros: string[] = [];
  if (!p.chavePix.trim()) erros.push("Informe a chave PIX.");
  if (p.chavePix.trim().length > 120) erros.push("Chave PIX muito longa.");
  if (!p.titular.trim()) erros.push("Informe o titular da conta que recebe o PIX.");
  if (!Number.isInteger(p.prazoHoras) || p.prazoHoras < PRAZO_MINIMO_HORAS || p.prazoHoras > PRAZO_MAXIMO_HORAS) {
    erros.push(`O prazo para pagamento deve ser de ${PRAZO_MINIMO_HORAS} a ${PRAZO_MAXIMO_HORAS} horas.`);
  }
  if ((p.instrucoes ?? "").length > 500) erros.push("Instruções de pagamento: no máximo 500 caracteres.");
  return erros;
}

export const ROTULO_STATUS_INSCRICAO: Record<StatusInscricao, string> = {
  confirmada: "Confirmada",
  cancelada: "Cancelada",
  estornada: "Estornada",
  aguardando_pagamento: "Aguardando pagamento",
  em_analise: "Comprovante em análise",
  recusada: "Pagamento recusado",
  expirada: "Reserva expirada",
};

/** Ações possíveis sobre o pagamento de uma inscrição (quem pode fazer é decidido no serviço). */
export function podeEnviarComprovante(i: Pick<Inscricao, "status" | "reservaAte">, agora: Date | number = Date.now()): boolean {
  return (i.status === "aguardando_pagamento" && !reservaVencida(i, agora)) || i.status === "em_analise";
}
export function podeDecidirPagamento(i: Pick<Inscricao, "status" | "reservaAte">, agora: Date | number = Date.now()): boolean {
  return i.status === "em_analise" || (i.status === "aguardando_pagamento" && !reservaVencida(i, agora));
}
