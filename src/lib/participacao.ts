// Regras puras de participação, progressão e insígnias (sem rede, sem React).
// Só dois status visíveis: "participando" (inscrição confirmada, evento ainda não
// finalizado — inclusive em andamento) e "participou" (evento finalizado + presença
// válida). Finalizar o evento sozinho nunca vira "participou". O detalhe técnico da
// validação fica em `validacao`, só para uso interno.
import { entradaAtiva } from "@/lib/checkin";
import { CONTORNOS_UF } from "@/data/mapaBrasil";
import { NOMES_UF } from "@/lib/localizacao";
import type {
  BaseDados, CampanhaRecompensa, ConcessaoInsignia, CriterioInsignia, Evento, Insignia, Voucher,
} from "@/lib/domain/types";
import { tr } from "@/i18n/lib/participacao";

export type EstadoParticipacao = "participando" | "participou";
/** Como a presença foi decidida (interno; nunca vira badge). */
export type ValidacaoParticipacao = "pendente" | "checkin" | "correcao_admin";

export interface Participacao {
  eventoId: string;
  inscricaoId: string;
  estado: EstadoParticipacao;
  validacao: ValidacaoParticipacao;
  /** UF válida do evento; ausente quando a localização do evento é inválida. */
  uf?: string | undefined;
  modalidade?: string | undefined;
  /** Data usada para ordenar e datar conquistas. */
  em: string;
}

export const UFS_VALIDAS = new Set(Object.keys(CONTORNOS_UF));

export { NOMES_UF };

/** UF do local registrado no evento (nunca do participante ou do aparelho). */
export function ufDoEvento(evento: Pick<Evento, "uf">): string | undefined {
  const uf = (evento.uf ?? "").trim().toUpperCase();
  return UFS_VALIDAS.has(uf) ? uf : undefined;
}

/** Última correção administrativa registrada para a pessoa no evento. */
function ultimaCorrecao(base: BaseDados, usuarioId: string, eventoId: string) {
  let ultima: BaseDados["correcoesParticipacao"][number] | undefined;
  for (const c of base.correcoesParticipacao) {
    if (c.usuarioId === usuarioId && c.eventoId === eventoId && (!ultima || c.criadoEm >= ultima.criadoEm)) ultima = c;
  }
  return ultima;
}

/** Participações da pessoa, uma por evento. */
export function participacoesDoUsuario(base: BaseDados, usuarioId: string, _agora = new Date()): Participacao[] {
  const porEvento = new Map<string, Participacao>();
  for (const ins of base.inscricoes) {
    if (ins.usuarioId !== usuarioId || ins.status !== "confirmada" || porEvento.has(ins.eventoId)) continue;
    const evento = base.eventos.find((e) => e.id === ins.eventoId);
    if (!evento || evento.status === "cancelado" || evento.status === "rascunho") continue;
    const correcao = ultimaCorrecao(base, usuarioId, evento.id);
    const presente = !!entradaAtiva(base.checkins.filter((c) => c.inscricaoId === ins.id), ins.id);
    const concluido = evento.status === "concluido";
    let estado: EstadoParticipacao | null = null;
    let validacao: ValidacaoParticipacao = "pendente";
    if (!concluido) estado = "participando";
    else if (correcao?.tipo === "invalidar") estado = null;
    else if (correcao?.tipo === "validar") { estado = "participou"; validacao = "correcao_admin"; }
    else if (presente) { estado = "participou"; validacao = "checkin"; }
    // Finalizado sem presença válida: fica só no histórico privado de inscrições.
    if (!estado) continue;
    porEvento.set(evento.id, {
      eventoId: evento.id,
      inscricaoId: ins.id,
      estado,
      validacao,
      uf: ufDoEvento(evento),
      modalidade: evento.modalidade,
      em: evento.fimEm,
    });
  }
  return [...porEvento.values()].sort((a, b) => b.em.localeCompare(a.em));
}

export const confirmadas = (ps: Participacao[]) => ps.filter((p) => p.estado === "participou");

export interface ResumoProgressao {
  operacoes: number;
  estados: string[];
  modalidades: string[];
  /** Missões pré-evento concluídas (entregas aprovadas); só para o critério "missoes". */
  missoes?: number | undefined;
}

export function resumir(ps: Participacao[]): ResumoProgressao {
  const c = confirmadas(ps);
  return {
    operacoes: c.length,
    estados: [...new Set(c.flatMap((p) => (p.uf ? [p.uf] : [])))].sort(),
    modalidades: [...new Set(c.flatMap((p) => (p.modalidade ? [p.modalidade] : [])))].sort(),
  };
}

export function valorCriterio(criterio: CriterioInsignia, r: ResumoProgressao): number {
  if (criterio.tipo === "operacoes") return r.operacoes;
  if (criterio.tipo === "estados") return r.estados.length;
  if (criterio.tipo === "missoes") return r.missoes ?? 0;
  return r.modalidades.length;
}

export const atende = (criterio: CriterioInsignia, r: ResumoProgressao) => valorCriterio(criterio, r) >= criterio.meta;

/** Data em que o critério foi atingido: fim da participação que completou a meta. */
export function dataDaConquista(criterio: CriterioInsignia, ps: Participacao[]): string | undefined {
  const ordem = confirmadas(ps).sort((a, b) => a.em.localeCompare(b.em));
  for (let i = 0; i < ordem.length; i++) {
    if (atende(criterio, resumir(ordem.slice(0, i + 1)))) return ordem[i]!.em;
  }
  return undefined;
}

export const ROTULO_CRITERIO: Record<CriterioInsignia["tipo"], string> = {
  get operacoes() { return tr("operacoes_concluidas"); },
  get estados() { return tr("estados_diferentes"); },
  get modalidades() { return tr("modalidades_diferentes"); },
  get missoes() { return tr("missoes_pre_evento_concluidas"); },
};

export function descreverCriterio(c: CriterioInsignia): string {
  return `${c.meta} ${ROTULO_CRITERIO[c.tipo]}`;
}

export type EstadoInsignia = "bloqueada" | "em_progresso" | "conquistada";

export interface ProgressoInsignia {
  insignia: Insignia;
  estado: EstadoInsignia;
  atual: number;
  meta: number;
  conquistadaEm?: string | undefined;
}

export const concessaoAtiva = (c: ConcessaoInsignia) => !c.revogadaEm;

/** Progresso de cada insígnia do catálogo para uma pessoa. */
export function progressoInsignias(
  insignias: Insignia[], concessoes: ConcessaoInsignia[], r: ResumoProgressao,
): ProgressoInsignia[] {
  return insignias
    .map((ins) => {
      const conc = concessoes.find((c) => c.insigniaId === ins.id && concessaoAtiva(c));
      if (conc) return { insignia: ins, estado: "conquistada" as const, atual: conc.criterio.meta, meta: conc.criterio.meta, conquistadaEm: conc.conquistadaEm };
      const atual = Math.min(valorCriterio(ins.criterio, r), ins.criterio.meta);
      return { insignia: ins, estado: atual > 0 ? ("em_progresso" as const) : ("bloqueada" as const), atual, meta: ins.criterio.meta };
    })
    .filter((p) => p.estado === "conquistada" || p.insignia.ativa);
}

// ---------- Recompensas ----------

/** Status efetivo: um voucher disponível fora do prazo é tratado como expirado. */
export function statusVoucher(v: Voucher, agora = new Date()): Voucher["status"] {
  if (v.status === "disponivel" && agora > new Date(v.beneficio.resgatarAte)) return "expirada";
  return v.status;
}

/** Desconto em centavos (nunca maior que o valor; valor final nunca negativo). */
export function descontoDoBeneficio(b: Pick<CampanhaRecompensa, "tipo" | "valor">, valorCentavos: number): number {
  const bruto = b.tipo === "gratuito" ? valorCentavos
    : b.tipo === "percentual" ? Math.round((valorCentavos * Math.min(100, Math.max(0, b.valor))) / 100)
    : Math.max(0, b.valor);
  return Math.min(valorCentavos, bruto);
}

export function descreverBeneficio(b: Pick<CampanhaRecompensa, "tipo" | "valor">): string {
  if (b.tipo === "gratuito") return tr("ingresso_gratuito");
  if (b.tipo === "percentual") return tr("valor_de_desconto", { valor: b.valor });
  return tr("r_valor_de_desconto", { valor: (b.valor / 100).toFixed(2).replace(".", ",") });
}
