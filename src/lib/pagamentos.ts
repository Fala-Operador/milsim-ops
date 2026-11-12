// Regras puras do pagamento online de ingressos (Stripe Checkout).
// Uma inscrição paga nasce "pendente" com a vaga reservada; vira "confirmada" quando o
// Stripe confirma o pagamento, ou "cancelada" quando a reserva expira ou o pagamento falha.
import type { Inscricao, PagamentoInscricao } from "@/lib/domain/types";
import { tr } from "@/i18n/lib/pagamentos";

/**
 * Duração da reserva de vaga; a sessão de checkout expira no mesmo instante. O Stripe
 * exige pelo menos 30 minutos entre a criação da sessão e a expiração: a folga de 2
 * minutos cobre o tempo entre gravar a reserva e criar a sessão.
 */
export const RESERVA_MINUTOS = 32;

export function fimDaReserva(agora = new Date()): string {
  return new Date(agora.getTime() + RESERVA_MINUTOS * 60_000).toISOString();
}

/** Menor prazo que o Stripe aceita para uma Checkout Session (30 min) mais 1 minuto de folga. */
export const PRAZO_MINIMO_SESSAO_MS = 31 * 60_000;

/**
 * Prazo de uma Checkout Session nova para um pagamento que vence em `prazo`. O Stripe recusa
 * sessão que expira em menos de 30 minutos. Por isso, quando falta menos que isso (troca da forma
 * de pagamento no meio da reserva), o prazo passa a ser `agora + minutos`. Sem esta regra, a
 * troca falhava com "Não foi possível abrir o pagamento agora".
 */
export function prazoDaNovaSessao(prazo: string, agora = new Date(), minutos = RESERVA_MINUTOS): string {
  if (new Date(prazo).getTime() - agora.getTime() >= PRAZO_MINIMO_SESSAO_MS) return prazo;
  return new Date(agora.getTime() + minutos * 60_000).toISOString();
}

/**
 * Reserva ainda segura a vaga: aguardando dentro do prazo, ou pagamento assíncrono
 * (boleto) já enviado — este só se resolve pelo webhook, nunca expira por tempo aqui.
 */
export function reservaVigente(i: Pick<Inscricao, "status" | "pagamento">, agora = new Date()): boolean {
  if (i.status !== "pendente" || !i.pagamento) return false;
  if (i.pagamento.status === "processando") return true;
  return i.pagamento.status === "aguardando" && new Date(i.pagamento.expiraEm) > agora;
}

/**
 * Sessão de checkout expirada só libera a vaga quando o prazo da reserva acabou. Antes disso a
 * expiração veio da troca da forma de pagamento (a sessão antiga é fechada antes de abrir a
 * nova) e a reserva continua com a pessoa. A sessão expira no mesmo instante da reserva.
 */
export function expiracaoLiberaReserva(i: Pick<Inscricao, "status" | "pagamento">, agora = new Date()): boolean {
  return !(i.status === "pendente" && i.pagamento?.status === "aguardando" && new Date(i.pagamento.expiraEm) > agora);
}

/** Inscrição que consome vaga: confirmada ou com reserva de pagamento vigente. */
export function ocupaVaga(i: Pick<Inscricao, "status" | "pagamento">, agora = new Date()): boolean {
  return i.status === "confirmada" || reservaVigente(i, agora);
}

/** Pagamento que já entrou e precisa de reembolso no Stripe ao cancelar. */
export function exigeEstornoOnline(i: Pick<Inscricao, "pagamento">): boolean {
  return i.pagamento?.status === "pago";
}

/** Estorno marcado na base e ainda não executado no Stripe. */
export const estornoPendente = (i: Pick<Inscricao, "pagamento">) => i.pagamento?.status === "estorno_pendente";

export const ROTULO_PAGAMENTO: Record<PagamentoInscricao["status"], string> = {
  get aguardando() { return tr("aguardando_pagamento"); },
  get processando() { return tr("pagamento_em_processamento"); },
  get pago() { return tr("pago"); },
  get expirado() { return tr("reserva_expirada"); },
  get falhou() { return tr("pagamento_nao_aprovado"); },
  get cancelado() { return tr("reserva_cancelada"); },
  get estorno_pendente() { return tr("reembolso_em_andamento"); },
  get estornado() { return tr("reembolsado"); },
};

/** O que outras pessoas podem saber do pagamento: só o necessário para contar vagas. */
export function pagamentoAnonimo(p: PagamentoInscricao | undefined): PagamentoInscricao | undefined {
  return p && { provedor: p.provedor, status: p.status, valorCentavos: 0, expiraEm: p.expiraEm };
}

/**
 * Titular e organização veem situação e valores, nunca os identificadores da transação.
 * Destino e taxa do repasse só aparecem para a organização do evento.
 */
export function pagamentoSemIds(p: PagamentoInscricao | undefined, manterDestino = false): PagamentoInscricao | undefined {
  if (!p) return p;
  const { sessaoId: _s, intencaoId: _i, reembolsoId: _r, contaDestino, taxaCentavos, ...resto } = p;
  return manterDestino ? { ...resto, contaDestino, taxaCentavos } : resto;
}
