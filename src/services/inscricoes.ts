// Regras de inscrição, vagas, cupons, cortesias e cancelamento.
import { carregarBase, mutarBase, latencia, ErroDominio, gerarId, gerarCodigo } from "./db";
import { idadeEmAnos } from "@/lib/domain/validators";
import { gerarTokenEntrada } from "@/lib/checkin";
import { descontoDoBeneficio, statusVoucher } from "@/lib/participacao";
import { restaurarVoucherDaInscricao } from "@/services/progressao";
import type { Cupom, Evento, Inscricao, Usuario } from "@/lib/domain/types";
import { ocupaVaga, exigePagamento, prazoDaReserva, pendente, podeEnviarComprovante, podeDecidirPagamento, reservaVencida } from "@/lib/reservas";
import { descontoCupom, disponibilidadeTipo, normalizarCodigoCupom, situacaoCupom, TEXTO_MOTIVO } from "@/lib/vendas";

export function inscricoesAtivasDoEvento(base: ReturnType<typeof carregarBase>, eventoId: string) {
  return base.inscricoes.filter((i) => i.eventoId === eventoId && ocupaVaga(i));
}

export function inscricaoAtivaDoUsuario(
  base: ReturnType<typeof carregarBase>,
  eventoId: string,
  usuarioId: string,
): Inscricao | undefined {
  return base.inscricoes.find(
    (i) => i.eventoId === eventoId && i.usuarioId === usuarioId && ocupaVaga(i),
  );
}

export function ocupacaoExercito(base: ReturnType<typeof carregarBase>, eventoId: string, exercitoId: string) {
  return inscricoesAtivasDoEvento(base, eventoId).filter((i) => i.exercitoId === exercitoId).length;
}

export function ocupacaoTipo(base: ReturnType<typeof carregarBase>, eventoId: string, tipoId: string) {
  return inscricoesAtivasDoEvento(base, eventoId).filter((i) => i.tipoId === tipoId).length;
}

export function ocupacaoLote(base: ReturnType<typeof carregarBase>, eventoId: string, loteId: string, tipoId: string) {
  return inscricoesAtivasDoEvento(base, eventoId).filter(
    (i) => i.loteId === loteId && i.tipoId === tipoId,
  ).length;
}

export function vagasRestantes(base: ReturnType<typeof carregarBase>, evento: Evento): number {
  return evento.capacidadeTotal - inscricoesAtivasDoEvento(base, evento.id).length;
}

export function loteVigente(evento: Evento, tipoId: string) {
  const agora = new Date();
  return evento.lotes.find(
    (l) =>
      l.status === "ativo" &&
      new Date(l.inicioVendas) <= agora &&
      agora <= new Date(l.fimVendas) &&
      l.itens.some((it) => it.tipoId === tipoId),
  );
}

/** Disponibilidade do tipo considerando as inscrições já confirmadas. */
export function disponibilidadeNaBase(base: ReturnType<typeof carregarBase>, evento: Evento, tipoId: string, agora = new Date()) {
  return disponibilidadeTipo(
    evento,
    tipoId,
    (loteId, t) => ocupacaoLote(base, evento.id, loteId, t),
    agora,
    ocupacaoTipo(base, evento.id, tipoId),
  );
}

export function validarCupom(
  base: ReturnType<typeof carregarBase>,
  eventoId: string,
  codigo: string,
  tipoId: string,
): Cupom {
  const codigoNorm = normalizarCodigoCupom(codigo);
  const cupom = base.cupons.find(
    (c) => c.eventoId === eventoId && c.codigo === codigoNorm,
  );
  if (!cupom) throw new ErroDominio("cupom_invalido", "Cupom não encontrado para esta operação.");
  const situacao = situacaoCupom(cupom);
  if (situacao === "inativo") throw new ErroDominio("cupom_inativo", "Este cupom está inativo.");
  if (situacao === "esgotado") throw new ErroDominio("cupom_esgotado", "Este cupom atingiu o limite de utilizações.");
  if (situacao === "agendado") throw new ErroDominio("cupom_agendado", "Este cupom ainda não está valendo.");
  if (situacao === "expirado") throw new ErroDominio("cupom_expirado", "Este cupom expirou.");
  if (!cupom.tiposElegiveis.includes(tipoId)) {
    throw new ErroDominio("cupom_tipo", "Este cupom não vale para o tipo de ingresso escolhido.");
  }
  return cupom;
}

export interface DadosInscricao {
  eventoId: string;
  usuarioId: string;
  tipoId: string;
  exercitoId: string;
  codigoCupom?: string | undefined;
  cortesiaId?: string | undefined;
  voucherId?: string | undefined;
  origem?: Inscricao["origem"];
  /**
   * Chave de idempotência gerada pelo navegador para esta tentativa: repetir a mesma
   * chamada (rede caiu, duplo clique) devolve a inscrição já criada em vez de falhar.
   */
  clienteId?: string | undefined;
}

const CHAVE_CLIENTE = /^[A-Za-z0-9-]{8,64}$/;
const agoraIso = () => new Date().toISOString();

function notificar(base: ReturnType<typeof carregarBase>, usuarioId: string, titulo: string, corpo: string, link: string) {
  base.notificacoes.push({ id: gerarId("not"), usuarioId, titulo, corpo, link, lida: false, criadoEm: agoraIso() });
}

/** Devolve o que a reserva prendia: um uso do cupom e o benefício de recompensa. */
function liberarReserva(base: ReturnType<typeof carregarBase>, inscricao: Inscricao, motivo: string) {
  if (inscricao.cupomId) {
    const cupom = base.cupons.find((c) => c.id === inscricao.cupomId);
    if (cupom) cupom.usos = Math.max(0, cupom.usos - 1);
  }
  restaurarVoucherDaInscricao(base, inscricao.id, motivo);
}

/**
 * Varre reservas cujo prazo passou: viram "expirada" e devolvem vaga, cupom e benefício.
 * Idempotente; roda dentro de toda transação que cria reservas ou decide pagamentos.
 */
export function expirarReservas(base: ReturnType<typeof carregarBase>, agora = new Date()): number {
  let n = 0;
  for (const i of base.inscricoes) {
    if (!reservaVencida(i, agora)) continue;
    i.status = "expirada";
    i.canceladoEm = agora.toISOString();
    i.motivoCancelamento = "Prazo para envio do comprovante encerrado.";
    liberarReserva(base, i, "reserva expirada");
    const evento = base.eventos.find((e) => e.id === i.eventoId);
    notificar(base, i.usuarioId, "Reserva expirada",
      `O prazo para enviar o comprovante de ${evento?.nome ?? "o evento"} terminou e a vaga foi liberada.`, "/app/ingressos");
    n++;
  }
  return n;
}

/** Lançamentos financeiros da inscrição paga (na confirmação direta ou na aprovação do PIX). */
function lancarPagamento(base: ReturnType<typeof carregarBase>, inscricao: Inscricao, descricao: string) {
  const valorFinal = Math.max(0, inscricao.valorCentavos - inscricao.descontoCentavos);
  if (valorFinal > 0) {
    base.movimentacoes.push({
      id: gerarId("mov"), eventoId: inscricao.eventoId, inscricaoId: inscricao.id, tipo: "inscricao",
      valorCentavos: valorFinal, descricao, criadoEm: agoraIso(),
    });
  }
  if (inscricao.descontoCentavos > 0) {
    base.movimentacoes.push({
      id: gerarId("mov"), eventoId: inscricao.eventoId, inscricaoId: inscricao.id, tipo: "desconto_cupom", valorCentavos: 0,
      descricao: inscricao.voucherId
        ? `Benefício de recompensa aplicado (${inscricao.descontoCentavos / 100} reais)`
        : `Desconto de cupom aplicado (${inscricao.descontoCentavos / 100} reais)`,
      criadoEm: agoraIso(),
    });
  }
}

/**
 * Confirmação atômica: valida conjuntamente elegibilidade, duplicidade,
 * evento, capacidades, lote, cupom/cortesia — tudo em uma única operação.
 */
export async function confirmarInscricao(dados: DadosInscricao): Promise<Inscricao> {
  await latencia(500);
  return mutarBase((base) => {
    let id = gerarId("ins");
    if (dados.clienteId !== undefined) {
      if (!CHAVE_CLIENTE.test(dados.clienteId)) throw new ErroDominio("chave", "Chave de operação inválida.");
      id = `ins-${dados.clienteId}`;
      const repetida = base.inscricoes.find((i) => i.id === id);
      if (repetida) {
        // Mesma tentativa reenviada: devolve o resultado original, sem efeito novo.
        if (repetida.usuarioId !== dados.usuarioId || repetida.eventoId !== dados.eventoId) {
          throw new ErroDominio("chave", "Chave de operação inválida.");
        }
        return repetida;
      }
    }
    expirarReservas(base);
    const evento = base.eventos.find((e) => e.id === dados.eventoId);
    if (!evento) throw new ErroDominio("evento", "Evento não encontrado.");
    if (evento.status !== "publicado") {
      throw new ErroDominio("evento_indisponivel", "Evento não está disponível para inscrição.");
    }
    const usuario = base.usuarios.find((u) => u.id === dados.usuarioId);
    if (!usuario) throw new ErroDominio("usuario", "Usuário não encontrado.");

    // Elegibilidade: 15–17 anos precisam de autorização do responsável aprovada
    const idade = idadeEmAnos(usuario.dataNascimento);
    if (idade < 18 && usuario.autorizacaoResponsavel !== "aprovada") {
      throw new ErroDominio(
        "autorizacao_pendente",
        "Participantes de 15 a 17 anos precisam da autorização do responsável aprovada antes de se inscrever.",
      );
    }

    // Uma única inscrição ativa por evento (vale para todas as origens)
    if (inscricaoAtivaDoUsuario(base, dados.eventoId, dados.usuarioId)) {
      throw new ErroDominio("duplicada", "Você já possui uma inscrição ativa neste evento.");
    }

    const tipo = evento.tipos.find((t) => t.id === dados.tipoId && !t.arquivado);
    if (!tipo) throw new ErroDominio("tipo", "Tipo de ingresso indisponível.");
    const exercito = evento.exercitos.find((e) => e.id === dados.exercitoId);
    if (!exercito) throw new ErroDominio("exercito", "Exército inválido.");

    // Capacidades: uma inscrição consome uma vaga em cada limite aplicável
    if (vagasRestantes(base, evento) <= 0) throw new ErroDominio("lotado", "Evento esgotado.");
    if (ocupacaoExercito(base, evento.id, exercito.id) >= exercito.capacidade) {
      throw new ErroDominio("exercito_lotado", `O ${exercito.nome} não possui vagas.`);
    }
    if (ocupacaoTipo(base, evento.id, tipo.id) >= tipo.quantidadeMaxima) {
      throw new ErroDominio("tipo_lotado", "Este tipo de ingresso esgotou.");
    }

    let valorCentavos = tipo.precoBaseCentavos;
    let loteId: string | undefined;
    let cupomId: string | undefined;
    let descontoCentavos = 0;
    let voucherUsado: (typeof base.vouchers)[number] | undefined;

    if (dados.cortesiaId) {
      // Resgate de cortesia: e-mail deve corresponder; sem lote comercial; sem cupom
      const cortesia = base.cortesias.find((c) => c.id === dados.cortesiaId);
      if (!cortesia || cortesia.eventoId !== evento.id) {
        throw new ErroDominio("cortesia", "Cortesia inválida.");
      }
      if (cortesia.status !== "pendente") throw new ErroDominio("cortesia_usada", "Cortesia já utilizada ou indisponível.");
      if (new Date() > new Date(cortesia.validade)) {
        cortesia.status = "expirada";
        throw new ErroDominio("cortesia_expirada", "Cortesia expirada.");
      }
      if (cortesia.emailConvidado !== usuario.email) {
        throw new ErroDominio("cortesia_email", "Esta cortesia foi emitida para outro e-mail.");
      }
      if (dados.codigoCupom) throw new ErroDominio("cupom_cortesia", "Cortesias não aceitam cupom.");
      if (dados.voucherId) throw new ErroDominio("voucher_cortesia", "Cortesias não aceitam benefício de recompensa.");
      if (cortesia.tipoId !== tipo.id) throw new ErroDominio("cortesia_tipo", "Tipo de ingresso diferente do convite.");
      cortesia.status = "resgatada";
      valorCentavos = 0;
    } else {
      const disp = disponibilidadeNaBase(base, evento, tipo.id);
      if (!disp.disponivel) {
        throw new ErroDominio("lote", `As inscrições deste ingresso estão indisponíveis: ${TEXTO_MOTIVO[disp.motivo]}.`);
      }
      const lote = disp.lote;
      const item = lote.itens.find((it) => it.tipoId === tipo.id)!;
      loteId = lote.id;
      valorCentavos = item.precoCentavos;

      if (dados.voucherId) {
        if (dados.codigoCupom) throw new ErroDominio("voucher_cupom", "O benefício não pode ser combinado com cupom.");
        const v = base.vouchers.find((x) => x.id === dados.voucherId && x.usuarioId === usuario.id);
        if (!v || statusVoucher(v) !== "disponivel") throw new ErroDominio("voucher", "Benefício indisponível ou fora da validade.");
        const campanha = base.campanhasRecompensa.find((c) => c.id === v.campanhaId);
        if (!campanha?.ativa) throw new ErroDominio("voucher_campanha", "A campanha deste benefício não está ativa.");
        if (evento.organizacaoId !== v.beneficio.organizacaoId || !v.beneficio.eventosElegiveis.includes(evento.id)) {
          throw new ErroDominio("voucher_evento", "Este benefício não vale para este evento.");
        }
        if (v.beneficio.tiposElegiveis.length && !v.beneficio.tiposElegiveis.includes(tipo.id)) {
          throw new ErroDominio("voucher_tipo", "Este benefício não vale para este tipo de ingresso.");
        }
        descontoCentavos = descontoDoBeneficio(v.beneficio, valorCentavos);
        voucherUsado = v;
      } else if (dados.codigoCupom) {
        const cupom = validarCupom(base, evento.id, dados.codigoCupom, tipo.id);
        descontoCentavos = descontoCupom(valorCentavos, cupom.descontoPercentual);
        cupom.usos += 1; // uso contabilizado somente na confirmação
        cupomId = cupom.id;
      }
    }

    const valorFinal = Math.max(0, valorCentavos - descontoCentavos);
    const origem = dados.origem ?? (dados.cortesiaId ? "cortesia" : "plataforma");
    // Inscrição paga pela plataforma em evento com PIX vira reserva até o comprovante ser aprovado.
    const reserva = origem === "plataforma" && exigePagamento(evento, valorFinal);
    const inscricao: Inscricao = {
      id,
      eventoId: evento.id,
      usuarioId: usuario.id,
      tipoId: tipo.id,
      loteId,
      exercitoId: exercito.id,
      codigo: gerarCodigo("OP"),
      tokenEntrada: gerarTokenEntrada(),
      status: reserva ? "aguardando_pagamento" : "confirmada",
      origem,
      reservaAte: reserva ? prazoDaReserva(evento) : undefined,
      valorCentavos,
      descontoCentavos,
      cupomId,
      cortesiaId: dados.cortesiaId,
      voucherId: voucherUsado?.id,
      criadoEm: new Date().toISOString(),
    };
    base.inscricoes.push(inscricao);
    if (voucherUsado) {
      // Consumido só aqui, junto com a confirmação (mesma transação).
      voucherUsado.status = "utilizada";
      voucherUsado.inscricaoId = inscricao.id;
      voucherUsado.usadoEm = inscricao.criadoEm;
      voucherUsado.motivo = undefined;
    }

    if (reserva) {
      // Sem lançamento financeiro: só entra quando a organização aprovar o comprovante.
      notificar(base, usuario.id, "Vaga reservada",
        `Envie o comprovante do PIX de ${evento.nome} até ${new Date(inscricao.reservaAte!).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}.`,
        "/app/ingressos");
    } else {
      lancarPagamento(base, inscricao, `Inscrição confirmada — ${tipo.nome}`);
      notificar(base, usuario.id, "Inscrição confirmada", `Sua inscrição em ${evento.nome} foi confirmada.`, "/app/ingressos");
    }

    return inscricao;
  });
}

/** Cancelamento/estorno integral: invalida ingresso, libera vaga, mantém histórico. */
export async function cancelarInscricao(
  inscricaoId: string,
  motivo: string,
  autorId: string,
): Promise<void> {
  await latencia();
  if (!motivo.trim()) throw new ErroDominio("motivo", "Informe a justificativa do cancelamento.");
  mutarBase((base) => {
    expirarReservas(base);
    const inscricao = base.inscricoes.find((i) => i.id === inscricaoId);
    if (inscricao && pendente(inscricao)) {
      // Reserva sem pagamento aprovado: não há estorno, só devolve vaga, cupom e benefício.
      inscricao.status = "cancelada";
      inscricao.canceladoEm = agoraIso();
      inscricao.motivoCancelamento = motivo;
      liberarReserva(base, inscricao, "reserva cancelada");
      notificar(base, inscricao.usuarioId, "Reserva cancelada", "Sua reserva foi cancelada e a vaga foi liberada.", "/app/ingressos");
      base.auditoria.push({
        id: gerarId("aud"), autorId, acao: "cancelamento_reserva", entidade: "inscricao",
        entidadeId: inscricao.id, justificativa: motivo, criadoEm: agoraIso(),
      });
      return;
    }
    if (!inscricao || inscricao.status !== "confirmada") {
      throw new ErroDominio("inscricao", "Inscrição não encontrada ou já cancelada.");
    }
    inscricao.status = "estornada";
    inscricao.canceladoEm = new Date().toISOString();
    inscricao.motivoCancelamento = motivo;
    restaurarVoucherDaInscricao(base, inscricao.id, "inscrição cancelada");

    const valorFinal = inscricao.valorCentavos - inscricao.descontoCentavos;
    if (valorFinal > 0) {
      base.movimentacoes.push({
        id: gerarId("mov"),
        eventoId: inscricao.eventoId,
        inscricaoId: inscricao.id,
        tipo: "estorno",
        valorCentavos: -valorFinal,
        descricao: "Estorno integral — cancelamento",
        criadoEm: new Date().toISOString(),
      });
    }
    base.notificacoes.push({
      id: gerarId("not"),
      usuarioId: inscricao.usuarioId,
      titulo: "Inscrição cancelada",
      corpo: "Sua inscrição foi cancelada e o estorno integral foi registrado.",
      link: "/app/ingressos",
      lida: false,
      criadoEm: new Date().toISOString(),
    });
    base.auditoria.push({
      id: gerarId("aud"),
      autorId,
      acao: "cancelamento_inscricao",
      entidade: "inscricao",
      entidadeId: inscricao.id,
      justificativa: motivo,
      criadoEm: new Date().toISOString(),
    });
  });
}

// ---------- Pagamento por PIX manual ----------

/**
 * Registra o comprovante já gravado no bucket privado. Reenviar enquanto está em análise
 * troca o arquivo (o anterior é devolvido para o chamador apagar do Storage).
 */
export function registrarComprovante(
  base: ReturnType<typeof carregarBase>,
  inscricaoId: string,
  usuarioId: string,
  comprovante: NonNullable<Inscricao["comprovante"]>,
): { anterior?: string } {
  expirarReservas(base);
  const inscricao = base.inscricoes.find((i) => i.id === inscricaoId && i.usuarioId === usuarioId);
  if (!inscricao) throw new ErroDominio("inscricao", "Inscrição não encontrada.");
  if (!podeEnviarComprovante(inscricao)) {
    throw new ErroDominio("comprovante_prazo", inscricao.status === "expirada"
      ? "O prazo desta reserva terminou. Faça uma nova inscrição."
      : "Esta inscrição não aceita comprovante.");
  }
  const anterior = inscricao.comprovante?.caminho;
  inscricao.comprovante = comprovante;
  inscricao.status = "em_analise";
  const evento = base.eventos.find((e) => e.id === inscricao.eventoId);
  if (evento) {
    for (const u of base.usuarios.filter((x) => x.organizacaoId === evento.organizacaoId && x.ativo)) {
      notificar(base, u.id, "Comprovante para analisar", `Novo comprovante de PIX em ${evento.nome}.`, "/organizacao/inscritos");
    }
  }
  return anterior ? { anterior } : {};
}

/** Aprova o pagamento: a reserva vira inscrição confirmada. Repetir não tem efeito novo. */
export function aprovarPagamento(base: ReturnType<typeof carregarBase>, inscricaoId: string, autorId: string): Inscricao {
  expirarReservas(base);
  const inscricao = base.inscricoes.find((i) => i.id === inscricaoId);
  if (!inscricao) throw new ErroDominio("inscricao", "Inscrição não encontrada.");
  if (inscricao.status === "confirmada" && inscricao.decididoEm) return inscricao;
  if (!podeDecidirPagamento(inscricao)) {
    throw new ErroDominio("pagamento_decidido", "Este pagamento não está mais aguardando análise.");
  }
  const tipo = base.eventos.find((e) => e.id === inscricao.eventoId)?.tipos.find((t) => t.id === inscricao.tipoId);
  inscricao.status = "confirmada";
  inscricao.decididoPor = autorId;
  inscricao.decididoEm = agoraIso();
  lancarPagamento(base, inscricao, `Inscrição confirmada (PIX aprovado) — ${tipo?.nome ?? "ingresso"}`);
  const evento = base.eventos.find((e) => e.id === inscricao.eventoId);
  notificar(base, inscricao.usuarioId, "Pagamento aprovado", `Sua inscrição em ${evento?.nome ?? "o evento"} foi confirmada.`, "/app/ingressos");
  base.auditoria.push({
    id: gerarId("aud"), autorId, acao: "aprovacao_pagamento", entidade: "inscricao",
    entidadeId: inscricao.id, justificativa: "Comprovante de PIX aprovado", criadoEm: agoraIso(),
  });
  return inscricao;
}

/** Recusa o pagamento: libera vaga, cupom e benefício. Repetir não tem efeito novo. */
export function recusarPagamento(base: ReturnType<typeof carregarBase>, inscricaoId: string, motivo: string, autorId: string): Inscricao {
  if (!motivo.trim()) throw new ErroDominio("motivo", "Informe o motivo da recusa.");
  expirarReservas(base);
  const inscricao = base.inscricoes.find((i) => i.id === inscricaoId);
  if (!inscricao) throw new ErroDominio("inscricao", "Inscrição não encontrada.");
  if (inscricao.status === "recusada") return inscricao;
  if (!podeDecidirPagamento(inscricao)) {
    throw new ErroDominio("pagamento_decidido", "Este pagamento não está mais aguardando análise.");
  }
  inscricao.status = "recusada";
  inscricao.decididoPor = autorId;
  inscricao.decididoEm = agoraIso();
  inscricao.canceladoEm = inscricao.decididoEm;
  inscricao.motivoCancelamento = motivo.trim();
  liberarReserva(base, inscricao, "pagamento recusado");
  const evento = base.eventos.find((e) => e.id === inscricao.eventoId);
  notificar(base, inscricao.usuarioId, "Pagamento recusado",
    `O comprovante de ${evento?.nome ?? "o evento"} foi recusado: ${motivo.trim()}`, "/app/ingressos");
  base.auditoria.push({
    id: gerarId("aud"), autorId, acao: "recusa_pagamento", entidade: "inscricao",
    entidadeId: inscricao.id, justificativa: motivo.trim(), criadoEm: agoraIso(),
  });
  return inscricao;
}

/** Resumo financeiro derivado dos registros de origem (sem números fixos). */
export function resumoFinanceiro(eventoId: string) {
  const base = carregarBase();
  const inscricoes = inscricoesAtivasDoEvento(base, eventoId);
  const movs = base.movimentacoes.filter((m) => m.eventoId === eventoId);
  const bruto = inscricoes.reduce((s, i) => s + i.valorCentavos, 0);
  const descontos = inscricoes.reduce((s, i) => s + i.descontoCentavos, 0);
  const estornos = movs.filter((m) => m.tipo === "estorno").reduce((s, m) => s + Math.abs(m.valorCentavos), 0);
  const ajustes = movs.filter((m) => m.tipo === "ajuste").reduce((s, m) => s + m.valorCentavos, 0);
  const cortesiasResgatadas = base.cortesias.filter(
    (c) => c.eventoId === eventoId && c.status === "resgatada",
  ).length;
  const integralmenteDescontadas = inscricoes.filter(
    (i) => i.descontoCentavos >= i.valorCentavos && i.valorCentavos > 0,
  ).length;
  return {
    inscritosAtivos: inscricoes.length,
    bruto,
    descontos,
    ajustes,
    estornos,
    // Líquido sem descontar a mesma operação duas vezes
    liquido: bruto - descontos - estornos + ajustes,
    cortesiasEmitidas: base.cortesias.filter((c) => c.eventoId === eventoId).length,
    cortesiasResgatadas,
    cuponsUtilizados: base.cupons.filter((c) => c.eventoId === eventoId).reduce((s, c) => s + c.usos, 0),
    integralmenteDescontadas,
    movimentacoes: movs,
  };
}

export type { Usuario };
