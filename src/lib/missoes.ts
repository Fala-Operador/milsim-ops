// Regras puras das missões pré-evento (sem rede, sem React): situação da missão, quem pode
// enviar, código secreto, placar por exército, metas coletivas, ranking individual, temporada
// da organização e prêmio do exército. Escritas em src/services/missoes.ts.
//
// Placar: cada exército soma os pontos das entregas aprovadas dos seus inscritos e divide pelo
// número de inscritos confirmados (média), para o tamanho do exército não decidir o resultado.
// Metas coletivas somam um bônus fixo à média. Ordem: total, depois pontos, depois nome.
import type {
  BaseDados, CampanhaMissoes, EntregaMissao, Evento, Missao, ResultadoExercito, StatusMissao,
} from "@/lib/domain/types";

export const MAX_PONTOS_MISSAO = 10000;
export const LIMITE_TEXTO_ENTREGA = 2000;

export type SituacaoMissao = "rascunho" | "agendada" | "aberta" | "encerrada";

const ms = (iso: string | undefined) => (iso ? Date.parse(iso) : Number.NaN);

export function situacaoMissao(m: Pick<Missao, "rascunho" | "abreEm" | "prazo">, agora: Date = new Date()): SituacaoMissao {
  if (m.rascunho) return "rascunho";
  const t = agora.getTime();
  if (ms(m.prazo) <= t) return "encerrada";
  if (m.abreEm && ms(m.abreEm) > t) return "agendada";
  return "aberta";
}

export const ROTULO_SITUACAO: Record<SituacaoMissao, string> = {
  rascunho: "Rascunho", agendada: "Agendada", aberta: "Aberta", encerrada: "Encerrada",
};

export const ROTULO_STATUS_ENTREGA: Record<StatusMissao, string> = {
  disponivel: "Disponível",
  enviada: "Em análise",
  concluida: "Concluída",
  ajustes_solicitados: "Ajustes solicitados",
  prazo_encerrado: "Prazo encerrado",
  recusada: "Recusada",
};

export const ROTULO_TIPO_ENTREGA: Record<Missao["tipoEntrega"], string> = {
  confirmacao: "Confirmação",
  texto: "Texto ou link",
  imagem: "Foto",
  codigo: "Código secreto",
};

/** Normaliza o código secreto: sem acentos, minúsculas e espaços simples. */
export function normalizarCodigo(c: string): string {
  return c.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
}

export function codigoConfere(missao: Pick<Missao, "codigoResposta">, tentativa: string): boolean {
  return !!missao.codigoResposta && normalizarCodigo(tentativa) === missao.codigoResposta;
}

/** A missão é para esta pessoa (exército da inscrição confirmada)? */
export function destinadaA(m: Pick<Missao, "publico">, exercitoId: string | undefined): boolean {
  return !!exercitoId && (m.publico === "todos" || m.publico === exercitoId);
}

/** Exército da inscrição confirmada da pessoa no evento (undefined = não inscrita). */
export function exercitoDaPessoa(base: Pick<BaseDados, "inscricoes">, usuarioId: string, eventoId: string): string | undefined {
  return base.inscricoes.find((i) => i.eventoId === eventoId && i.usuarioId === usuarioId && i.status === "confirmada")?.exercitoId;
}

/** O participante pode enviar (ou reenviar) a entrega agora? Devolve o motivo quando não. */
export function bloqueioEnvio(
  m: Missao,
  entrega: Pick<EntregaMissao, "status"> | undefined,
  campanha: Pick<CampanhaMissoes, "encerradaEm"> | undefined,
  agora: Date = new Date(),
): string | null {
  if (campanha?.encerradaEm) return "A campanha de missões deste evento foi encerrada.";
  const s = situacaoMissao(m, agora);
  if (s === "rascunho") return "Missão indisponível.";
  if (s === "agendada") return "Esta missão ainda não abriu.";
  if (s === "encerrada") return "O prazo desta missão terminou.";
  if (entrega?.status === "concluida") return "Você já concluiu esta missão.";
  if (entrega?.status === "enviada") return "Sua entrega está em análise.";
  if (entrega?.status === "recusada") return "Sua entrega foi recusada pela organização.";
  return null;
}

const nomeExercito = (evento: Pick<Evento, "exercitos">, id: string) => evento.exercitos.find((x) => x.id === id)?.nome ?? id;
const arred = (n: number) => Math.round(n * 10) / 10;

export interface LinhaPlacar extends Omit<ResultadoExercito, "colocacao" | "premio"> {
  nome: string;
  /** Metas coletivas atingidas (títulos das missões). */
  metas: string[];
}

/** Placar ao vivo dos exércitos (ou o congelado, se a campanha foi encerrada). */
export function placarExercitos(base: Pick<BaseDados, "missoes" | "entregas" | "inscricoes">, evento: Evento): LinhaPlacar[] {
  const missoes = base.missoes.filter((m) => m.eventoId === evento.id && !m.rascunho);
  const ids = new Set(missoes.map((m) => m.id));
  const aprovadas = base.entregas.filter((e) => ids.has(e.missaoId) && e.status === "concluida");
  const inscritos = (exId: string) =>
    base.inscricoes.filter((i) => i.eventoId === evento.id && i.status === "confirmada" && i.exercitoId === exId);

  return evento.exercitos.map((ex) => {
    const membros = inscritos(ex.id);
    const pontos = aprovadas.filter((e) => e.exercitoId === ex.id).reduce((s, e) => s + (e.pontos ?? 0), 0);
    const media = membros.length ? pontos / membros.length : 0;
    // Meta coletiva: % dos inscritos do exército que concluíram a missão (só se a missão é para ele).
    const metas: string[] = [];
    let bonus = 0;
    for (const m of missoes) {
      if (!m.metaPercentual || !m.metaBonus || !destinadaA(m, ex.id) || membros.length === 0) continue;
      const concluiram = new Set(aprovadas.filter((e) => e.missaoId === m.id && e.exercitoId === ex.id).map((e) => e.usuarioId));
      const pct = (100 * membros.filter((i) => concluiram.has(i.usuarioId)).length) / membros.length;
      if (pct >= m.metaPercentual) { bonus += m.metaBonus; metas.push(m.titulo); }
    }
    return { exercitoId: ex.id, nome: ex.nome, pontos, inscritos: membros.length, media: arred(media), bonus, total: arred(media + bonus), metas };
  }).sort((a, b) => b.total - a.total || b.pontos - a.pontos || a.nome.localeCompare(b.nome));
}

/** Congela o placar com colocações (empates dividem a colocação) e os prêmios declarados. */
export function congelarResultado(linhas: LinhaPlacar[], premios: CampanhaMissoes["premios"]): ResultadoExercito[] {
  let colocacao = 0;
  let anterior: LinhaPlacar | undefined;
  return linhas.map((l, i) => {
    if (!anterior || l.total !== anterior.total || l.pontos !== anterior.pontos) colocacao = i + 1;
    anterior = l;
    const premio = premios.find((p) => p.colocacao === colocacao)?.descricao;
    return { exercitoId: l.exercitoId, colocacao, pontos: l.pontos, inscritos: l.inscritos, media: l.media, bonus: l.bonus, total: l.total, premio };
  });
}

/** Prêmio do exército no dia do evento (só depois do encerramento). */
export function premioDoExercito(campanha: CampanhaMissoes | undefined, exercitoId: string | undefined): ResultadoExercito | undefined {
  if (!campanha?.encerradaEm || !exercitoId) return undefined;
  return campanha.resultado.find((r) => r.exercitoId === exercitoId);
}

export interface LinhaRanking {
  usuarioId: string;
  pontos: number;
  missoes: number;
  exercitoId?: string | undefined;
}

/** Ranking individual: pontos aprovados por pessoa (empate: mais missões, depois quem chegou antes). */
export function rankingIndividual(entregas: EntregaMissao[]): LinhaRanking[] {
  const porPessoa = new Map<string, LinhaRanking & { primeira: string }>();
  for (const e of entregas) {
    if (e.status !== "concluida") continue;
    const l = porPessoa.get(e.usuarioId) ?? { usuarioId: e.usuarioId, pontos: 0, missoes: 0, exercitoId: e.exercitoId, primeira: e.avaliadoEm ?? e.enviadoEm };
    l.pontos += e.pontos ?? 0;
    l.missoes += 1;
    const quando = e.avaliadoEm ?? e.enviadoEm;
    if (quando < l.primeira) l.primeira = quando;
    porPessoa.set(e.usuarioId, l);
  }
  return [...porPessoa.values()]
    .sort((a, b) => b.pontos - a.pontos || b.missoes - a.missoes || a.primeira.localeCompare(b.primeira))
    .map(({ primeira: _p, ...l }) => l);
}

/** Entregas aprovadas de um evento. */
export function entregasDoEvento(base: Pick<BaseDados, "missoes" | "entregas">, eventoId: string): EntregaMissao[] {
  const ids = new Set(base.missoes.filter((m) => m.eventoId === eventoId).map((m) => m.id));
  return base.entregas.filter((e) => ids.has(e.missaoId));
}

/** Temporada: soma dos eventos da organização que começaram no ano. */
export function temporada(base: Pick<BaseDados, "eventos" | "missoes" | "entregas">, organizacaoId: string, ano: number): LinhaRanking[] {
  const eventos = new Set(base.eventos.filter((e) => e.organizacaoId === organizacaoId && new Date(e.inicioEm).getFullYear() === ano).map((e) => e.id));
  const missoes = new Set(base.missoes.filter((m) => eventos.has(m.eventoId)).map((m) => m.id));
  return rankingIndividual(base.entregas.filter((e) => missoes.has(e.missaoId))).map(({ exercitoId: _x, ...l }) => l);
}

/** Missões concluídas pela pessoa em toda a plataforma (critério de insígnia "missoes"). */
export function missoesConcluidas(base: Pick<BaseDados, "entregas">, usuarioId: string): EntregaMissao[] {
  return base.entregas
    .filter((e) => e.usuarioId === usuarioId && e.status === "concluida")
    .sort((a, b) => (a.avaliadoEm ?? a.enviadoEm).localeCompare(b.avaliadoEm ?? b.enviadoEm));
}

export { nomeExercito };
