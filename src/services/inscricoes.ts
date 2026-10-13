// Regras de inscrição, vagas, cupons, cortesias e cancelamento.
import { carregarBase, mutarBase, latencia, ErroDominio, gerarId, gerarCodigo } from "./db";
import { idadeEmAnos } from "@/lib/domain/validators";
import { gerarTokenEntrada } from "@/lib/checkin";
import { descontoDoBeneficio, statusVoucher } from "@/lib/participacao";
import { restaurarVoucherDaInscricao } from "@/services/progressao";
import type { Cupom, Evento, Inscricao, Usuario } from "@/lib/domain/types";
import { descontoCupom, disponibilidadeTipo, normalizarCodigoCupom, situacaoCupom, TEXTO_MOTIVO } from "@/lib/vendas";

export function inscricoesAtivasDoEvento(base: ReturnType<typeof carregarBase>, eventoId: string) {
  return base.inscricoes.filter((i) => i.eventoId === eventoId && i.status === "confirmada");
}

export function inscricaoAtivaDoUsuario(
  base: ReturnType<typeof carregarBase>,
  eventoId: string,
  usuarioId: string,
): Inscricao | undefined {
  return base.inscricoes.find(
    (i) => i.eventoId === eventoId && i.usuarioId === usuarioId && i.status === "confirmada",
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
}

/**
 * Confirmação atômica: valida conjuntamente elegibilidade, duplicidade,
 * evento, capacidades, lote, cupom/cortesia — tudo em uma única operação.
 */
export async function confirmarInscricao(dados: DadosInscricao): Promise<Inscricao> {
  await latencia(500);
  return mutarBase((base) => {
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
    const inscricao: Inscricao = {
      id: gerarId("ins"),
      eventoId: evento.id,
      usuarioId: usuario.id,
      tipoId: tipo.id,
      loteId,
      exercitoId: exercito.id,
      codigo: gerarCodigo("OP"),
      tokenEntrada: gerarTokenEntrada(),
      status: "confirmada",
      origem: dados.origem ?? (dados.cortesiaId ? "cortesia" : "plataforma"),
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

    if (valorFinal > 0) {
      base.movimentacoes.push({
        id: gerarId("mov"),
        eventoId: evento.id,
        inscricaoId: inscricao.id,
        tipo: "inscricao",
        valorCentavos: valorFinal,
        descricao: `Inscrição confirmada — ${tipo.nome}`,
        criadoEm: new Date().toISOString(),
      });
    }
    if (descontoCentavos > 0) {
      base.movimentacoes.push({
        id: gerarId("mov"),
        eventoId: evento.id,
        inscricaoId: inscricao.id,
        tipo: "desconto_cupom",
        valorCentavos: 0,
        descricao: voucherUsado
          ? `Benefício de recompensa aplicado (${descontoCentavos / 100} reais)`
          : `Desconto de cupom aplicado (${descontoCentavos / 100} reais)`,
        criadoEm: new Date().toISOString(),
      });
    }

    base.notificacoes.push({
      id: gerarId("not"),
      usuarioId: usuario.id,
      titulo: "Inscrição confirmada",
      corpo: `Sua inscrição em ${evento.nome} foi confirmada.`,
      link: "/app/ingressos",
      lida: false,
      criadoEm: new Date().toISOString(),
    });

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
    const inscricao = base.inscricoes.find((i) => i.id === inscricaoId);
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
