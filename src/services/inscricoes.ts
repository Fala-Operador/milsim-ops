// Regras de inscrição, vagas, cupons, cortesias e cancelamento.
import { carregarBase, mutarBase, latencia, ErroDominio, gerarId, gerarCodigo } from "./db";
import { idadeEmAnos, normalizarEmail, somenteDigitos } from "@/lib/domain/validators";
import { gerarTokenEntrada } from "@/lib/checkin";
import { descontoDoBeneficio, statusVoucher } from "@/lib/participacao";
import { restaurarVoucherDaInscricao } from "@/services/progressao";
import { exigeEstornoOnline, fimDaReserva, ocupaVaga, reservaVigente } from "@/lib/pagamentos";
import { contaParaRepasse, MSG_SEM_RECEBIMENTO, taxaDaPlataforma, taxaDoComprador, taxaPlataforma } from "@/lib/repasses";
import type {
  BaseDados,
  Cupom,
  DisputaPagamento,
  Evento,
  Inscricao,
  PagamentoInscricao,
  Usuario,
} from "@/lib/domain/types";
import {
  descontoCupom,
  disponibilidadeTipo,
  normalizarCodigoCupom,
  situacaoCupom,
  TEXTO_MOTIVO,
} from "@/lib/vendas";

/** Inscrições confirmadas (financeiro, presença). Para vagas, use inscricoesQueOcupamVaga. */
export function inscricoesAtivasDoEvento(base: ReturnType<typeof carregarBase>, eventoId: string) {
  return base.inscricoes.filter((i) => i.eventoId === eventoId && i.status === "confirmada");
}

/** Inscrições que consomem vaga: confirmadas e reservas de pagamento vigentes. */
export function inscricoesQueOcupamVaga(
  base: ReturnType<typeof carregarBase>,
  eventoId: string,
  agora = new Date(),
) {
  return base.inscricoes.filter((i) => i.eventoId === eventoId && ocupaVaga(i, agora));
}

export function inscricaoAtivaDoUsuario(
  base: ReturnType<typeof carregarBase>,
  eventoId: string,
  usuarioId: string,
): Inscricao | undefined {
  return base.inscricoes.find(
    // Só confirmada: a reserva pendente da própria pessoa é substituída numa nova tentativa.
    (i) => i.eventoId === eventoId && i.usuarioId === usuarioId && i.status === "confirmada",
  );
}

export function ocupacaoExercito(
  base: ReturnType<typeof carregarBase>,
  eventoId: string,
  exercitoId: string,
) {
  return inscricoesQueOcupamVaga(base, eventoId).filter((i) => i.exercitoId === exercitoId).length;
}

export function ocupacaoTipo(
  base: ReturnType<typeof carregarBase>,
  eventoId: string,
  tipoId: string,
) {
  return inscricoesQueOcupamVaga(base, eventoId).filter((i) => i.tipoId === tipoId).length;
}

export function ocupacaoLote(
  base: ReturnType<typeof carregarBase>,
  eventoId: string,
  loteId: string,
  tipoId: string,
) {
  return inscricoesQueOcupamVaga(base, eventoId).filter(
    (i) => i.loteId === loteId && i.tipoId === tipoId,
  ).length;
}

export function vagasRestantes(base: ReturnType<typeof carregarBase>, evento: Evento): number {
  return evento.capacidadeTotal - inscricoesQueOcupamVaga(base, evento.id).length;
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

/** Disponibilidade do tipo considerando as inscrições confirmadas e as reservas vigentes. */
export function disponibilidadeNaBase(
  base: ReturnType<typeof carregarBase>,
  evento: Evento,
  tipoId: string,
  agora = new Date(),
) {
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
  const cupom = base.cupons.find((c) => c.eventoId === eventoId && c.codigo === codigoNorm);
  if (!cupom) throw new ErroDominio("cupom_invalido", "Cupom não encontrado para esta operação.");
  const situacao = situacaoCupom(cupom);
  if (situacao === "inativo") throw new ErroDominio("cupom_inativo", "Este cupom está inativo.");
  if (situacao === "esgotado")
    throw new ErroDominio("cupom_esgotado", "Este cupom atingiu o limite de utilizações.");
  if (situacao === "agendado")
    throw new ErroDominio("cupom_agendado", "Este cupom ainda não está valendo.");
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
export interface OpcoesInscricao {
  /**
   * Cobrança online (Stripe) disponível: inscrições com valor a pagar nascem "pendente",
   * com a vaga reservada até o pagamento ser confirmado. Sem ela, confirma direto.
   */
  pagamentoOnline?: boolean;
}

/** Folga depois do fim da reserva antes de liberá-la por tempo (o Stripe pode avisar com atraso). */
const FOLGA_LIBERACAO_MS = 10 * 60_000;

/**
 * Libera uma reserva de pagamento: cancela a inscrição pendente e devolve o uso do
 * cupom e o benefício de recompensa. Devolve a sessão do Stripe a expirar, se houver.
 */
export function liberarReservaNaBase(
  base: BaseDados,
  inscricao: Inscricao,
  motivo: string,
  status: "expirado" | "falhou" | "cancelado" = "expirado",
  agora = new Date(),
): string | undefined {
  if (inscricao.status !== "pendente") return undefined;
  inscricao.status = "cancelada";
  inscricao.canceladoEm = agora.toISOString();
  inscricao.motivoCancelamento = motivo;
  if (inscricao.pagamento) inscricao.pagamento = { ...inscricao.pagamento, status };
  if (inscricao.cupomId) {
    const cupom = base.cupons.find((c) => c.id === inscricao.cupomId);
    if (cupom) cupom.usos = Math.max(0, cupom.usos - 1);
  }
  restaurarVoucherDaInscricao(base, inscricao.id, motivo, agora);
  return inscricao.pagamento?.sessaoId;
}

/** Libera as reservas do evento cujo prazo acabou (com folga). Devolve as sessões a expirar. */
export function liberarReservasVencidas(
  base: BaseDados,
  eventoId?: string,
  agora = new Date(),
): string[] {
  const limite = new Date(agora.getTime() - FOLGA_LIBERACAO_MS);
  const sessoes: string[] = [];
  for (const i of base.inscricoes) {
    if (i.status !== "pendente" || (eventoId && i.eventoId !== eventoId)) continue;
    if (i.pagamento?.status !== "aguardando" || new Date(i.pagamento.expiraEm) > limite) continue;
    const s = liberarReservaNaBase(base, i, "Prazo para pagamento encerrado", "expirado", agora);
    if (s) sessoes.push(s);
  }
  return sessoes;
}

/**
 * Pagamento de uma reserva nova: a cobrança nasce com destino à conta da organização
 * (repasse automático menos a taxa). Sem conta de recebimento ativa não há venda.
 */
function pagamentoInicial(
  base: BaseDados,
  evento: Evento,
  valorCentavos: number,
  agora: Date,
): PagamentoInscricao {
  const org = base.organizacoes.find((o) => o.id === evento.organizacaoId);
  const contaDestino = contaParaRepasse(org);
  if (!contaDestino) throw new ErroDominio("sem_recebimento", MSG_SEM_RECEBIMENTO);
  // Taxa de serviço do comprador, definida pela organização: somada ao ingresso e repassada a ela.
  const taxaComprador = taxaPlataforma(valorCentavos, taxaDoComprador(org));
  return {
    provedor: "stripe",
    status: "aguardando",
    valorCentavos,
    expiraEm: fimDaReserva(agora),
    contaDestino,
    taxaCentavos: taxaPlataforma(valorCentavos, taxaDaPlataforma(base)),
    taxaCompradorCentavos: taxaComprador || undefined,
  };
}

/** Movimentações e aviso de uma inscrição que acabou de ser confirmada. */
function registrarConfirmacaoNaBase(
  base: BaseDados,
  inscricao: Inscricao,
  evento: Evento,
  agora: string,
) {
  const tipo = evento.tipos.find((t) => t.id === inscricao.tipoId);
  const valorFinal = Math.max(0, inscricao.valorCentavos - inscricao.descontoCentavos);
  if (valorFinal > 0) {
    base.movimentacoes.push({
      id: gerarId("mov"),
      eventoId: evento.id,
      inscricaoId: inscricao.id,
      tipo: "inscricao",
      valorCentavos: valorFinal,
      descricao: `Inscrição confirmada — ${tipo?.nome ?? "ingresso"}${inscricao.pagamento ? " (pago via Stripe)" : ""}`,
      criadoEm: agora,
    });
  }
  if (inscricao.descontoCentavos > 0) {
    base.movimentacoes.push({
      id: gerarId("mov"),
      eventoId: evento.id,
      inscricaoId: inscricao.id,
      tipo: "desconto_cupom",
      valorCentavos: 0,
      descricao: inscricao.voucherId
        ? `Benefício de recompensa aplicado (${inscricao.descontoCentavos / 100} reais)`
        : `Desconto de cupom aplicado (${inscricao.descontoCentavos / 100} reais)`,
      criadoEm: agora,
    });
  }
  base.notificacoes.push({
    id: gerarId("not"),
    usuarioId: inscricao.usuarioId,
    titulo: "Inscrição confirmada",
    corpo: inscricao.pagamento
      ? `Pagamento aprovado. Sua inscrição em ${evento.nome} foi confirmada.`
      : `Sua inscrição em ${evento.nome} foi confirmada.`,
    link: "/app/ingressos",
    lida: false,
    criadoEm: agora,
  });
}

/**
 * Inscrição atômica: valida conjuntamente elegibilidade, duplicidade, evento,
 * capacidades, lote, cupom/cortesia — tudo em uma única operação. Com pagamento
 * online e valor a pagar, reserva a vaga ("pendente"); senão confirma na hora.
 */
export async function confirmarInscricao(
  dados: DadosInscricao,
  opcoes: OpcoesInscricao = {},
): Promise<Inscricao> {
  await latencia(500);
  return mutarBase((base) => {
    const agora = new Date();
    let id = gerarId("ins");
    if (dados.clienteId !== undefined) {
      if (!CHAVE_CLIENTE.test(dados.clienteId)) throw new ErroDominio("chave", "Chave de operação inválida.");
      id = `ins-${dados.clienteId}`;
      const repetida = base.inscricoes.find((i) => i.id === id);
      if (repetida) {
        // Mesma tentativa reenviada (rede caiu, duplo clique): devolve o resultado original.
        // Se for uma reserva aberta, a API reabre a mesma sessão de checkout.
        if (repetida.usuarioId !== dados.usuarioId || repetida.eventoId !== dados.eventoId) {
          throw new ErroDominio("chave", "Chave de operação inválida.");
        }
        return repetida;
      }
    }
    const evento = base.eventos.find((e) => e.id === dados.eventoId);
    if (!evento) throw new ErroDominio("evento", "Evento não encontrado.");
    // Inclusão manual pela gestão vale também com as inscrições encerradas (quem pagou por fora).
    const manual = dados.origem === "organizador" || dados.origem === "admin";
    if (evento.status !== "publicado" && !(manual && evento.status === "inscricoes_encerradas")) {
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
    // Reservas: as vencidas do evento liberam vaga; uma nova tentativa substitui a anterior
    // da própria pessoa, exceto se um pagamento dela já estiver em processamento.
    liberarReservasVencidas(base, evento.id, agora);
    for (const anterior of base.inscricoes.filter(
      (i) => i.eventoId === evento.id && i.usuarioId === usuario.id && i.status === "pendente",
    )) {
      if (anterior.pagamento?.status === "processando") {
        throw new ErroDominio(
          "pagamento_processando",
          "Você já tem um pagamento em processamento para este evento. Aguarde a confirmação.",
        );
      }
      liberarReservaNaBase(
        base,
        anterior,
        "Substituída por uma nova tentativa de inscrição",
        "cancelado",
        agora,
      );
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
      if (cortesia.status !== "pendente")
        throw new ErroDominio("cortesia_usada", "Cortesia já utilizada ou indisponível.");
      if (agora > new Date(cortesia.validade)) {
        cortesia.status = "expirada";
        throw new ErroDominio("cortesia_expirada", "Cortesia expirada.");
      }
      if (cortesia.emailConvidado !== usuario.email) {
        throw new ErroDominio("cortesia_email", "Esta cortesia foi emitida para outro e-mail.");
      }
      if (dados.codigoCupom)
        throw new ErroDominio("cupom_cortesia", "Cortesias não aceitam cupom.");
      if (dados.voucherId)
        throw new ErroDominio("voucher_cortesia", "Cortesias não aceitam benefício de recompensa.");
      if (cortesia.tipoId !== tipo.id)
        throw new ErroDominio("cortesia_tipo", "Tipo de ingresso diferente do convite.");
      cortesia.status = "resgatada";
      valorCentavos = 0;
    } else {
      const disp = disponibilidadeNaBase(base, evento, tipo.id, agora);
      if (!disp.disponivel) {
        throw new ErroDominio(
          "lote",
          `As inscrições deste ingresso estão indisponíveis: ${TEXTO_MOTIVO[disp.motivo]}.`,
        );
      }
      const lote = disp.lote;
      const item = lote.itens.find((it) => it.tipoId === tipo.id)!;
      loteId = lote.id;
      valorCentavos = item.precoCentavos;

      if (dados.voucherId) {
        if (dados.codigoCupom)
          throw new ErroDominio("voucher_cupom", "O benefício não pode ser combinado com cupom.");
        const v = base.vouchers.find((x) => x.id === dados.voucherId && x.usuarioId === usuario.id);
        if (!v || statusVoucher(v) !== "disponivel")
          throw new ErroDominio("voucher", "Benefício indisponível ou fora da validade.");
        const campanha = base.campanhasRecompensa.find((c) => c.id === v.campanhaId);
        if (!campanha?.ativa)
          throw new ErroDominio("voucher_campanha", "A campanha deste benefício não está ativa.");
        if (
          evento.organizacaoId !== v.beneficio.organizacaoId ||
          !v.beneficio.eventosElegiveis.includes(evento.id)
        ) {
          throw new ErroDominio("voucher_evento", "Este benefício não vale para este evento.");
        }
        if (v.beneficio.tiposElegiveis.length && !v.beneficio.tiposElegiveis.includes(tipo.id)) {
          throw new ErroDominio(
            "voucher_tipo",
            "Este benefício não vale para este tipo de ingresso.",
          );
        }
        descontoCentavos = descontoDoBeneficio(v.beneficio, valorCentavos);
        voucherUsado = v;
      } else if (dados.codigoCupom) {
        const cupom = validarCupom(base, evento.id, dados.codigoCupom, tipo.id);
        descontoCentavos = descontoCupom(valorCentavos, cupom.descontoPercentual);
        // Uso contabilizado na confirmação ou na reserva (devolvido se a reserva for liberada).
        cupom.usos += 1;
        cupomId = cupom.id;
      }
    }

    const valorFinal = Math.max(0, valorCentavos - descontoCentavos);
    const pagarOnline = !!opcoes.pagamentoOnline && valorFinal > 0;
    const criadoEm = agora.toISOString();
    const inscricao: Inscricao = {
      id,
      eventoId: evento.id,
      usuarioId: usuario.id,
      tipoId: tipo.id,
      loteId,
      exercitoId: exercito.id,
      codigo: gerarCodigo("OP"),
      // O QR de entrada só existe para inscrição confirmada.
      tokenEntrada: pagarOnline ? undefined : gerarTokenEntrada(),
      status: pagarOnline ? "pendente" : "confirmada",
      origem: dados.origem ?? (dados.cortesiaId ? "cortesia" : "plataforma"),
      valorCentavos,
      descontoCentavos,
      cupomId,
      cortesiaId: dados.cortesiaId,
      voucherId: voucherUsado?.id,
      pagamento: pagarOnline ? pagamentoInicial(base, evento, valorFinal, agora) : undefined,
      criadoEm,
    };
    base.inscricoes.push(inscricao);
    if (voucherUsado) {
      // Consumido junto com a confirmação ou a reserva (mesma transação).
      voucherUsado.status = "utilizada";
      voucherUsado.inscricaoId = inscricao.id;
      voucherUsado.usadoEm = criadoEm;
      voucherUsado.motivo = undefined;
    }
    if (!pagarOnline) registrarConfirmacaoNaBase(base, inscricao, evento, criadoEm);
    return inscricao;
  });
}

/** Mensagens da inscrição reescritas para quem inclui outra pessoa (a original fala com o titular). */
const MENSAGEM_INCLUSAO: Record<string, string> = {
  duplicada: "Esta pessoa já possui uma inscrição ativa neste evento.",
  autorizacao_pendente:
    "Esta pessoa tem de 15 a 17 anos e ainda não tem a autorização do responsável aprovada.",
  pagamento_processando: "Esta pessoa tem um pagamento em processamento para este evento. Aguarde a confirmação.",
};

export const LIMITE_INCLUSAO_MANUAL = 50;

export interface DadosInclusaoManual {
  eventoId: string;
  tipoId: string;
  exercitoId: string;
  observacao?: string | undefined;
  /** Organização: e-mail ou CPF de uma conta existente. */
  identificador?: string | undefined;
  /** Admin: contas escolhidas na lista (só a administração recebe todos os usuários na visão). */
  usuarioIds?: string[] | undefined;
}

function contasDaInclusao(base: BaseDados, dados: DadosInclusaoManual, autor: Usuario): Usuario[] {
  if (dados.usuarioIds?.length) {
    if (autor.perfil !== "admin") {
      throw new ErroDominio("permissao", "Só a administração escolhe participantes pela lista.");
    }
    const ids = [...new Set(dados.usuarioIds)];
    if (ids.length > LIMITE_INCLUSAO_MANUAL) {
      throw new ErroDominio("limite", `Inclua no máximo ${LIMITE_INCLUSAO_MANUAL} participantes por vez.`);
    }
    return ids.map((id) => {
      const u = base.usuarios.find((x) => x.id === id);
      if (!u?.ativo) throw new ErroDominio("participante", "Uma das contas selecionadas não existe ou está desativada.");
      return u;
    });
  }
  const chave = (dados.identificador ?? "").trim();
  if (!chave) throw new ErroDominio("participante", "Informe ao menos um participante.");
  const cpf = somenteDigitos(chave);
  const usuario = chave.includes("@")
    ? base.usuarios.find((u) => u.email === normalizarEmail(chave))
    : cpf.length === 11
      ? base.usuarios.find((u) => u.cpf === cpf)
      : undefined;
  if (!usuario?.ativo) {
    throw new ErroDominio("participante", "Nenhuma conta ativa encontrada com este e-mail ou CPF.");
  }
  return [usuario];
}

/**
 * Inclusão manual pela gestão do evento (organização dona ou admin), para quem combinou o
 * pagamento por fora. Cada pessoa entra como cortesia já resgatada (sem valor): respeita idade,
 * inscrição única e capacidade, mas não exige lote aberto. A origem registra quem incluiu.
 * No servidor é tudo ou nada: se uma pessoa não puder entrar, ninguém do lote é incluído.
 */
export async function incluirParticipantes(dados: DadosInclusaoManual, autor: Usuario): Promise<Inscricao[]> {
  const base = carregarBase();
  const evento = base.eventos.find((e) => e.id === dados.eventoId);
  if (!evento) throw new ErroDominio("evento", "Evento não encontrado.");
  const tipo = evento.tipos.find((t) => t.id === dados.tipoId && !t.arquivado);
  if (!tipo) throw new ErroDominio("tipo", "Tipo de ingresso indisponível.");
  const usuarios = contasDaInclusao(base, dados, autor);
  const origem = autor.perfil === "admin" ? "admin" : "organizador";
  const agora = new Date().toISOString();

  const inscricoes: Inscricao[] = [];
  for (const usuario of usuarios) {
    const cortesiaId = gerarId("cor");
    mutarBase((b) => {
      b.cortesias.push({
        id: cortesiaId,
        eventoId: evento.id,
        nomeConvidado: usuario.nomeCompleto,
        emailConvidado: usuario.email,
        tipoId: tipo.id,
        exercitoId: dados.exercitoId,
        validade: new Date(Date.now() + 60_000).toISOString(),
        codigo: gerarCodigo("CORT"),
        status: "pendente",
        criadoEm: agora,
      });
    });
    try {
      inscricoes.push(
        await confirmarInscricao({
          eventoId: evento.id,
          usuarioId: usuario.id,
          tipoId: tipo.id,
          exercitoId: dados.exercitoId,
          cortesiaId,
          origem,
        }),
      );
    } catch (e) {
      // No servidor a unidade de trabalho já descarta tudo; aqui a cortesia sai explicitamente.
      mutarBase((b) => {
        b.cortesias = b.cortesias.filter((c) => c.id !== cortesiaId);
      });
      if (!(e instanceof ErroDominio)) throw e;
      const mensagem = MENSAGEM_INCLUSAO[e.codigo] ?? e.message;
      // Com várias pessoas, diz qual delas impediu a inclusão.
      throw new ErroDominio(e.codigo, usuarios.length > 1 ? `${usuario.nomeCompleto}: ${mensagem}` : mensagem);
    }
  }

  mutarBase((b) => {
    const observacao = dados.observacao?.trim();
    for (const ins of inscricoes) {
      const nome = usuarios.find((u) => u.id === ins.usuarioId)!.nomeCompleto;
      b.auditoria.push({
        id: gerarId("aud"),
        autorId: autor.id,
        acao: "inclusao_manual",
        entidade: "inscricao",
        entidadeId: ins.id,
        justificativa: `${nome} incluído(a) em "${evento.nome}" como cortesia${observacao ? ` — ${observacao}` : ""}.`,
        criadoEm: agora,
      });
    }
    // Inclusão feita pela administração: a organização dona fica sabendo (um aviso por lote).
    if (origem === "admin") {
      const nomes = usuarios.map((u) => u.nomeCompleto).join(", ");
      const quem = usuarios.length === 1 ? nomes : `${usuarios.length} participantes (${nomes})`;
      for (const o of b.usuarios.filter((u) => u.perfil === "organizador" && u.organizacaoId === evento.organizacaoId && u.ativo)) {
        b.notificacoes.push({
          id: gerarId("not"),
          usuarioId: o.id,
          titulo: usuarios.length === 1 ? "Participante incluído pela administração" : "Participantes incluídos pela administração",
          corpo: `A administração incluiu ${quem} em ${evento.nome} (${tipo.nome}, cortesia).`,
          link: "/organizacao/inscritos",
          lida: false,
          criadoEm: agora,
        });
      }
    }
  });
  return inscricoes;
}

export type ResultadoPagamento =
  | "confirmada" // pagamento aplicado agora
  | "ja_confirmada" // aviso repetido (webhook + retorno do checkout)
  | "estornar" // pagamento chegou sem vaga possível: reembolso marcado
  | "ignorada"; // inscrição desconhecida ou sem pagamento online

/** A vaga ainda cabe se a inscrição ocupar o lugar dela (sem contar a própria). */
function cabeNoEvento(base: BaseDados, evento: Evento, ins: Inscricao, agora: Date): boolean {
  const outras = inscricoesQueOcupamVaga(base, evento.id, agora).filter((i) => i.id !== ins.id);
  const exercito = evento.exercitos.find((e) => e.id === ins.exercitoId);
  const tipo = evento.tipos.find((t) => t.id === ins.tipoId);
  return (
    outras.length < evento.capacidadeTotal &&
    (!exercito ||
      outras.filter((i) => i.exercitoId === exercito.id).length < exercito.capacidade) &&
    (!tipo || outras.filter((i) => i.tipoId === tipo.id).length < tipo.quantidadeMaxima)
  );
}

/**
 * Aplica um pagamento aprovado pelo Stripe (webhook ou retorno do checkout). Idempotente.
 * Se a reserva já foi liberada e a vaga não cabe mais, ou o evento deixou de estar
 * publicado, marca o reembolso integral em vez de confirmar.
 */
export function confirmarPagamentoNaBase(
  base: BaseDados,
  inscricaoId: string,
  stripe: { sessaoId?: string | undefined; intencaoId?: string | undefined },
  agora = new Date(),
): ResultadoPagamento {
  const ins = base.inscricoes.find((i) => i.id === inscricaoId);
  if (!ins?.pagamento) return "ignorada";
  const p = ins.pagamento;
  if (p.status === "pago" || p.status === "estorno_pendente" || p.status === "estornado")
    return "ja_confirmada";
  const evento = base.eventos.find((e) => e.id === ins.eventoId);
  const iso = agora.toISOString();
  const dados = {
    sessaoId: stripe.sessaoId ?? p.sessaoId,
    intencaoId: stripe.intencaoId ?? p.intencaoId,
    pagoEm: iso,
    erro: undefined,
  };

  const outraAtiva = base.inscricoes.some(
    (i) =>
      i.id !== ins.id &&
      i.eventoId === ins.eventoId &&
      i.usuarioId === ins.usuarioId &&
      i.status === "confirmada",
  );
  const podeConfirmar =
    ins.status === "pendente" &&
    !!evento &&
    evento.status === "publicado" &&
    !outraAtiva &&
    (reservaVigente(ins, agora) || cabeNoEvento(base, evento, ins, agora));

  if (podeConfirmar) {
    ins.status = "confirmada";
    ins.tokenEntrada ??= gerarTokenEntrada();
    ins.pagamento = { ...p, ...dados, status: "pago" };
    registrarConfirmacaoNaBase(base, ins, evento!, iso);
    return "confirmada";
  }

  // Dinheiro entrou sem vaga possível: devolve tudo. A inscrição não conta no financeiro.
  if (ins.status === "pendente")
    liberarReservaNaBase(base, ins, "Pagamento recebido sem vaga disponível", "expirado", agora);
  ins.pagamento = { ...ins.pagamento!, ...dados, status: "estorno_pendente" };
  base.notificacoes.push({
    id: gerarId("not"),
    usuarioId: ins.usuarioId,
    titulo: "Pagamento será reembolsado",
    corpo: `Recebemos seu pagamento para ${evento?.nome ?? "o evento"}, mas a reserva da vaga não estava mais válida. O valor será reembolsado integralmente.`,
    link: "/app/ingressos",
    lida: false,
    criadoEm: iso,
  });
  return "estornar";
}

/** Pagamento assíncrono (ex.: boleto) enviado: mantém a vaga até o Stripe responder. */
export function marcarPagamentoProcessando(
  base: BaseDados,
  inscricaoId: string,
  stripe: { sessaoId?: string | undefined; intencaoId?: string | undefined },
): void {
  const ins = base.inscricoes.find((i) => i.id === inscricaoId);
  if (!ins?.pagamento || ins.status !== "pendente" || ins.pagamento.status !== "aguardando") return;
  ins.pagamento = {
    ...ins.pagamento,
    status: "processando",
    sessaoId: stripe.sessaoId ?? ins.pagamento.sessaoId,
    intencaoId: stripe.intencaoId ?? ins.pagamento.intencaoId,
  };
}

/** Estorno de inscrição confirmada: registra no financeiro e, se paga no Stripe, marca o reembolso. */
function estornarNaBase(
  base: BaseDados,
  inscricao: Inscricao,
  motivo: string,
  descricao: string,
  agora: string,
  motivoVoucher: string,
): void {
  inscricao.status = "estornada";
  inscricao.canceladoEm = agora;
  inscricao.motivoCancelamento = motivo;
  restaurarVoucherDaInscricao(base, inscricao.id, motivoVoucher);
  if (exigeEstornoOnline(inscricao))
    inscricao.pagamento = { ...inscricao.pagamento!, status: "estorno_pendente", erro: undefined };
  const valorFinal = inscricao.valorCentavos - inscricao.descontoCentavos;
  if (valorFinal > 0) {
    base.movimentacoes.push({
      id: gerarId("mov"),
      eventoId: inscricao.eventoId,
      inscricaoId: inscricao.id,
      tipo: "estorno",
      valorCentavos: -valorFinal,
      descricao,
      criadoEm: agora,
    });
  }
}

/**
 * Cancelamento. Inscrição confirmada: estorno integral (invalida ingresso, libera vaga,
 * mantém histórico; se paga no Stripe, o reembolso é feito logo depois pela API).
 * Reserva aguardando pagamento: libera a vaga sem cobrança.
 */
export async function cancelarInscricao(
  inscricaoId: string,
  motivo: string,
  autorId: string,
): Promise<{ sessaoAExpirar?: string | undefined }> {
  await latencia();
  if (!motivo.trim()) throw new ErroDominio("motivo", "Informe a justificativa do cancelamento.");
  return mutarBase((base) => {
    const inscricao = base.inscricoes.find((i) => i.id === inscricaoId);
    const agora = new Date().toISOString();
    if (inscricao?.status === "pendente") {
      if (inscricao.pagamento?.status === "processando") {
        throw new ErroDominio(
          "pagamento_processando",
          "O pagamento desta reserva já está em processamento. Aguarde a confirmação para cancelar.",
        );
      }
      const sessaoAExpirar = liberarReservaNaBase(base, inscricao, motivo, "cancelado");
      base.auditoria.push({
        id: gerarId("aud"),
        autorId,
        acao: "cancelamento_reserva",
        entidade: "inscricao",
        entidadeId: inscricao.id,
        justificativa: motivo,
        criadoEm: agora,
      });
      return { sessaoAExpirar };
    }
    if (!inscricao || inscricao.status !== "confirmada") {
      throw new ErroDominio("inscricao", "Inscrição não encontrada ou já cancelada.");
    }
    estornarNaBase(
      base,
      inscricao,
      motivo,
      "Estorno integral — cancelamento",
      agora,
      "inscrição cancelada",
    );
    base.notificacoes.push({
      id: gerarId("not"),
      usuarioId: inscricao.usuarioId,
      titulo: "Inscrição cancelada",
      corpo: inscricao.pagamento
        ? "Sua inscrição foi cancelada e o reembolso integral foi solicitado ao meio de pagamento."
        : "Sua inscrição foi cancelada e o estorno integral foi registrado.",
      link: "/app/ingressos",
      lida: false,
      criadoEm: agora,
    });
    base.auditoria.push({
      id: gerarId("aud"),
      autorId,
      acao: "cancelamento_inscricao",
      entidade: "inscricao",
      entidadeId: inscricao.id,
      justificativa: motivo,
      criadoEm: agora,
    });
    return {};
  });
}

/** Cancelamento do evento: estorna as confirmadas e libera as reservas. Devolve sessões a expirar. */
export function estornarEventoNaBase(
  base: BaseDados,
  eventoId: string,
  motivo: string,
  aoEstornar: (i: Inscricao) => void,
): string[] {
  const agora = new Date().toISOString();
  const sessoes: string[] = [];
  for (const ins of base.inscricoes.filter((i) => i.eventoId === eventoId)) {
    if (ins.status === "confirmada") {
      estornarNaBase(
        base,
        ins,
        motivo,
        "Estorno integral — evento cancelado",
        agora,
        "evento cancelado pelo organizador",
      );
      aoEstornar(ins);
    } else if (ins.status === "pendente") {
      // Pagamento em processamento é reembolsado quando chegar (evento deixou de estar publicado).
      if (ins.pagamento?.status === "processando") continue;
      const s = liberarReservaNaBase(base, ins, motivo, "cancelado");
      if (s) sessoes.push(s);
    }
  }
  return sessoes;
}

/** Resultado do pedido de reembolso ao Stripe para um estorno marcado na base. */
export function registrarResultadoEstornoNaBase(
  base: BaseDados,
  inscricaoId: string,
  r: { reembolsoId: string } | { erro: string },
): void {
  const ins = base.inscricoes.find((i) => i.id === inscricaoId);
  if (!ins?.pagamento || ins.pagamento.status !== "estorno_pendente") return;
  ins.pagamento =
    "reembolsoId" in r
      ? { ...ins.pagamento, status: "estornado", reembolsoId: r.reembolsoId, erro: undefined }
      : { ...ins.pagamento, erro: r.erro };
}

/**
 * Reembolso avisado pelo Stripe (charge.refunded). Conclui um estorno pedido pela
 * plataforma; se o reembolso integral foi feito direto no painel do Stripe, cancela o ingresso.
 */
export function registrarReembolsoNaBase(
  base: BaseDados,
  inscricaoId: string,
  integral: boolean,
  agora = new Date(),
): void {
  const ins = base.inscricoes.find((i) => i.id === inscricaoId);
  if (!ins?.pagamento) return;
  if (ins.pagamento.status === "estorno_pendente") {
    ins.pagamento = { ...ins.pagamento, status: "estornado", erro: undefined };
    return;
  }
  if (ins.status !== "confirmada" || !integral) return;
  const iso = agora.toISOString();
  estornarNaBase(
    base,
    ins,
    "Pagamento reembolsado no Stripe",
    "Estorno integral — reembolso no Stripe",
    iso,
    "inscrição reembolsada",
  );
  ins.pagamento = { ...ins.pagamento, status: "estornado", erro: undefined };
  base.notificacoes.push({
    id: gerarId("not"),
    usuarioId: ins.usuarioId,
    titulo: "Inscrição reembolsada",
    corpo: "Seu pagamento foi reembolsado integralmente e a inscrição foi cancelada.",
    link: "/app/ingressos",
    lida: false,
    criadoEm: iso,
  });
}

/**
 * Contestação (chargeback) de um pagamento, vinda do webhook charge.dispute.*. Guarda a
 * situação no pagamento e, na abertura, avisa o responsável pela organização do evento.
 * Devolve a inscrição afetada (ou undefined quando o pagamento não é deste site).
 */
export function registrarDisputaNaBase(base: BaseDados, intencaoId: string, disputa: DisputaPagamento): Inscricao | undefined {
  const ins = base.inscricoes.find((i) => i.pagamento?.intencaoId === intencaoId);
  if (!ins?.pagamento) return undefined;
  const anterior = ins.pagamento.disputa;
  ins.pagamento = { ...ins.pagamento, disputa: { ...disputa, abertaEm: anterior?.abertaEm ?? disputa.abertaEm } };
  if (!anterior) {
    const evento = base.eventos.find((e) => e.id === ins.eventoId);
    const responsavel = base.organizacoes.find((o) => o.id === evento?.organizacaoId)?.responsavelId;
    if (responsavel) {
      base.notificacoes.push({
        id: gerarId("not"),
        usuarioId: responsavel,
        titulo: "Pagamento contestado",
        corpo: `O comprador da inscrição ${ins.codigo} contestou o pagamento no banco do cartão${evento ? ` (${evento.nome})` : ""}.`,
        link: "/organizacao/financeiro",
        lida: false,
        criadoEm: disputa.atualizadaEm,
      });
    }
  }
  return ins;
}

/** Resumo financeiro derivado dos registros de origem (sem números fixos). */
export function resumoFinanceiro(eventoId: string) {
  const base = carregarBase();
  const inscricoes = inscricoesAtivasDoEvento(base, eventoId);
  const movs = base.movimentacoes.filter((m) => m.eventoId === eventoId);
  const bruto = inscricoes.reduce((s, i) => s + i.valorCentavos, 0);
  const descontos = inscricoes.reduce((s, i) => s + i.descontoCentavos, 0);
  const estornos = movs
    .filter((m) => m.tipo === "estorno")
    .reduce((s, m) => s + Math.abs(m.valorCentavos), 0);
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
    cuponsUtilizados: base.cupons
      .filter((c) => c.eventoId === eventoId)
      .reduce((s, c) => s + c.usos, 0),
    integralmenteDescontadas,
    // Pagamento online: vagas reservadas aguardando o Stripe e reembolsos ainda não concluídos.
    reservasAguardando: base.inscricoes.filter((i) => i.eventoId === eventoId && reservaVigente(i))
      .length,
    reembolsosPendentes: base.inscricoes.filter(
      (i) => i.eventoId === eventoId && i.pagamento?.status === "estorno_pendente",
    ),
    // Contestações (chargebacks) registradas pelo webhook, das mais recentes para as antigas.
    disputas: base.inscricoes
      .filter((i) => i.eventoId === eventoId && i.pagamento?.disputa)
      .sort((a, b) => b.pagamento!.disputa!.abertaEm.localeCompare(a.pagamento!.disputa!.abertaEm)),
    movimentacoes: movs,
  };
}

export type { Usuario };
