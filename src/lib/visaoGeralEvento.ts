// Regras puras da visão geral de um evento na administração: contagens de ingressos, presença,
// suporte e engajamento. Os valores em dinheiro ficam com `resumoFinanceiro` (services/inscricoes).
import { entradaAtiva } from "@/lib/checkin";
import { statusExibido as statusImpulsionamento } from "@/lib/impulsionamento";
import { reservaVigente } from "@/lib/pagamentos";
import { disputaEmAberto } from "@/lib/stripe";
import { statusExibido, ultimaAtividade, type StatusExibido } from "@/lib/suporte";
import type { BaseDados, Chamado, Inscricao } from "@/lib/domain/types";

export interface LinhaTipoIngresso {
  id: string;
  nome: string;
  vendidos: number;
  limite: number;
  arquivado: boolean;
}

export interface LinhaExercito {
  id: string;
  nome: string;
  confirmados: number;
  presentes: number;
  capacidade: number;
}

export interface VisaoGeralEvento {
  ingressos: {
    confirmados: number;
    aguardandoPagamento: number;
    cancelados: number;
    estornados: number;
    capacidade: number;
    /** Percentual de confirmados sobre a capacidade (0–100). */
    ocupacao: number;
  };
  porOrigem: Record<Inscricao["origem"], number>;
  porTipo: LinhaTipoIngresso[];
  porExercito: LinhaExercito[];
  pagamentos: {
    pagosOnline: number;
    reembolsosPendentes: number;
    reembolsados: number;
    contestacoesAbertas: number;
  };
  checkin: { presentes: number; confirmados: number; percentual: number };
  suporte: {
    total: number;
    emAberto: number;
    porStatus: Partial<Record<StatusExibido, number>>;
    /** Chamados do evento, com atividade mais recente primeiro. */
    chamados: Chamado[];
  };
  engajamento: {
    missoes: number;
    entregas: number;
    entregasAguardandoAvaliacao: number;
    publicacoes: number;
    denunciasPendentes: number;
    impulsionamentosAtivos: number;
  };
}

const ENCERRADOS = new Set<Chamado["status"]>(["resolvido", "fechado"]);
const pct = (parte: number, todo: number) => (todo > 0 ? Math.min(100, Math.round((parte / todo) * 100)) : 0);

export function visaoGeralEvento(base: BaseDados, eventoId: string, agora: Date = new Date()): VisaoGeralEvento | null {
  const evento = base.eventos.find((e) => e.id === eventoId);
  if (!evento) return null;
  const inscricoes = base.inscricoes.filter((i) => i.eventoId === eventoId);
  const confirmadas = inscricoes.filter((i) => i.status === "confirmada");
  const checkins = base.checkins.filter((c) => c.eventoId === eventoId);
  const presentes = new Set(confirmadas.filter((i) => entradaAtiva(checkins, i.id)).map((i) => i.id));

  const porOrigem: VisaoGeralEvento["porOrigem"] = { plataforma: 0, cortesia: 0, organizador: 0, admin: 0 };
  for (const i of confirmadas) porOrigem[i.origem] += 1;

  const chamados = base.chamados
    .filter((c) => c.eventoId === eventoId)
    .sort((a, b) => ultimaAtividade(b).localeCompare(ultimaAtividade(a)));
  const porStatus: VisaoGeralEvento["suporte"]["porStatus"] = {};
  for (const c of chamados) {
    const s = statusExibido(base, c);
    porStatus[s] = (porStatus[s] ?? 0) + 1;
  }

  const missoes = new Set(base.missoes.filter((m) => m.eventoId === eventoId).map((m) => m.id));
  const entregas = base.entregas.filter((e) => missoes.has(e.missaoId));

  return {
    ingressos: {
      confirmados: confirmadas.length,
      aguardandoPagamento: inscricoes.filter((i) => reservaVigente(i, agora)).length,
      cancelados: inscricoes.filter((i) => i.status === "cancelada").length,
      estornados: inscricoes.filter((i) => i.status === "estornada").length,
      capacidade: evento.capacidadeTotal,
      ocupacao: pct(confirmadas.length, evento.capacidadeTotal),
    },
    porOrigem,
    porTipo: evento.tipos.map((t) => ({
      id: t.id,
      nome: t.nome,
      vendidos: confirmadas.filter((i) => i.tipoId === t.id).length,
      limite: t.quantidadeMaxima,
      arquivado: !!t.arquivado,
    })),
    porExercito: evento.exercitos.map((x) => {
      const doExercito = confirmadas.filter((i) => i.exercitoId === x.id);
      return {
        id: x.id,
        nome: x.nome,
        confirmados: doExercito.length,
        presentes: doExercito.filter((i) => presentes.has(i.id)).length,
        capacidade: x.capacidade,
      };
    }),
    pagamentos: {
      pagosOnline: inscricoes.filter((i) => i.pagamento?.status === "pago").length,
      reembolsosPendentes: inscricoes.filter((i) => i.pagamento?.status === "estorno_pendente").length,
      reembolsados: inscricoes.filter((i) => i.pagamento?.status === "estornado").length,
      contestacoesAbertas: inscricoes.filter((i) => disputaEmAberto(i.pagamento?.disputa)).length,
    },
    checkin: { presentes: presentes.size, confirmados: confirmadas.length, percentual: pct(presentes.size, confirmadas.length) },
    suporte: {
      total: chamados.length,
      emAberto: chamados.filter((c) => !ENCERRADOS.has(c.status)).length,
      porStatus,
      chamados,
    },
    engajamento: {
      missoes: missoes.size,
      entregas: entregas.length,
      entregasAguardandoAvaliacao: entregas.filter((e) => e.status === "enviada").length,
      publicacoes: base.publicacoes.filter((p) => p.eventoId === eventoId).length,
      denunciasPendentes: base.denuncias.filter((d) => d.eventoId === eventoId && d.status === "pendente").length,
      impulsionamentosAtivos: base.impulsionamentos.filter(
        (c) => c.eventoId === eventoId && statusImpulsionamento(base, c, agora) === "ativo",
      ).length,
    },
  };
}

/** Cancelamentos e estornos do evento, mais recentes primeiro (para auditoria do admin). */
export function cancelamentosDoEvento(base: Pick<BaseDados, "inscricoes">, eventoId: string): Inscricao[] {
  return base.inscricoes
    .filter((i) => i.eventoId === eventoId && (i.status === "cancelada" || i.status === "estornada"))
    .sort((a, b) => (b.canceladoEm ?? b.criadoEm).localeCompare(a.canceladoEm ?? a.criadoEm));
}
