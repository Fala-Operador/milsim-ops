// Regras puras do impulsionamento de operações: estado exibido, elegibilidade,
// concorrência entre campanhas e posições de divulgação.
// Não há agendador no servidor: o estado é recalculado a cada carregamento.
import type { Abrangencia, BaseDados, Evento, Impulsionamento, SecaoInicial } from "@/lib/domain/types";
import { POSICAO_COMUNIDADE, POSICAO_LISTAGEM } from "@/lib/domain/types";
import { areasSobrepostas, esgotado, UF_REGIAO } from "@/lib/divulgacao";

export type StatusExibidoImpulsionamento =
  | "rascunho" | "agendado" | "ativo" | "pausado" | "pausado_esgotado" | "encerrado" | "suspenso";

export const ROTULO_STATUS_IMPULSIONAMENTO: Record<StatusExibidoImpulsionamento, string> = {
  rascunho: "Rascunho",
  agendado: "Agendado",
  ativo: "Ativo",
  pausado: "Pausado",
  pausado_esgotado: "Pausado (esgotado)",
  encerrado: "Encerrado",
  suspenso: "Suspenso (evento indisponível)",
};

export const ROTULO_OBJETIVO = { divulgacao: "Divulgar a operação", inscricoes: "Promover inscrições" } as const;

const ms = (iso: string) => new Date(iso).getTime();

/** Evento pode receber/continuar exibindo destaque? */
export function eventoDisponivel(e: Evento | undefined, agora: Date): e is Evento {
  return !!e && e.status === "publicado" && ms(e.fimEm) > agora.getTime();
}

export function statusExibido(base: BaseDados, c: Impulsionamento, agora: Date): StatusExibidoImpulsionamento {
  if (c.status === "rascunho") return "rascunho";
  const e = base.eventos.find((x) => x.id === c.eventoId);
  if (c.status === "encerrado" || ms(c.fimEm) <= agora.getTime()) return "encerrado";
  if (e && ms(e.fimEm) <= agora.getTime()) return "encerrado";
  if (!eventoDisponivel(e, agora)) return "suspenso";
  if (c.status === "pausado") return "pausado";
  if (c.objetivo === "inscricoes" && esgotado(base, e)) return "pausado_esgotado";
  if (ms(c.inicioEm) > agora.getTime()) return "agendado";
  return "ativo";
}

/** Seções que podem receber impulsionamentos (seções de eventos). */
export function secoesCompativeis(base: BaseDados): SecaoInicial[] {
  return base.secoesInicio.filter((s) => (s.tipo === "destaques" || s.tipo === "regional") && s.status !== "desativada");
}

export function rotuloPosicao(base: BaseDados, posicao: string): string {
  if (posicao === POSICAO_LISTAGEM) return "Listagem de eventos";
  if (posicao === POSICAO_COMUNIDADE) return "Lateral da comunidade";
  return base.secoesInicio.find((s) => s.id === posicao)?.titulo ?? "Seção removida";
}

/** Motivos que impedem ativar ou retomar (lista vazia = pode ativar). */
export function pendenciasAtivacao(base: BaseDados, c: Pick<Impulsionamento, "eventoId" | "objetivo" | "posicoes" | "inicioEm" | "fimEm" | "imagemPromocional">, agora: Date): string[] {
  const erros: string[] = [];
  const e = base.eventos.find((x) => x.id === c.eventoId);
  if (!e) return ["Selecione a operação."];
  if (e.status !== "publicado") erros.push("A operação precisa estar publicada.");
  if (ms(e.fimEm) <= agora.getTime()) erros.push("A operação já terminou.");
  if (!c.inicioEm || !c.fimEm || ms(c.fimEm) <= ms(c.inicioEm)) erros.push("O término deve ser depois do início.");
  else if (ms(c.fimEm) <= agora.getTime()) erros.push("O período de divulgação já terminou.");
  if (c.fimEm && ms(c.fimEm) > ms(e.fimEm)) erros.push("O impulsionamento não pode continuar após o término da operação.");
  const validas = new Set([POSICAO_LISTAGEM, POSICAO_COMUNIDADE, ...secoesCompativeis(base).map((s) => s.id)]);
  if (!c.posicoes.length) erros.push("Escolha pelo menos um local de divulgação.");
  else if (c.posicoes.some((p) => !validas.has(p))) erros.push("Há um local de divulgação que não existe mais ou está desativado.");
  if (!(c.imagemPromocional || e.imagemUrl)) erros.push("A operação precisa de uma imagem para a apresentação.");
  if (c.objetivo === "inscricoes" && esgotado(base, e)) erros.push("Para promover inscrições, a operação precisa ter vagas.");
  return erros;
}

/** Ordem estável: prioridade alta, ordem administrativa, início da campanha, id. */
function comparar(a: Impulsionamento, b: Impulsionamento): number {
  if (a.prioridade !== b.prioridade) return a.prioridade === "alta" ? -1 : 1;
  if (a.ordem !== b.ordem) return a.ordem - b.ordem;
  return a.inicioEm.localeCompare(b.inicioEm) || a.id.localeCompare(b.id);
}

/** Impulsos comprados pelas organizações exibidos por bloco (as campanhas da administração não contam). */
export const LIMITE_IMPULSOS_COMPRADOS = 8;

export interface OpcoesExibicao {
  /** Id do visitante: a ordem dos impulsos comprados é sorteada por visitante e a cada 15 minutos. */
  semente?: string | undefined;
  /** Só eventos que passam aqui disputam as vagas (ex.: busca e filtros da listagem). */
  filtro?: ((eventoId: string) => boolean) | undefined;
}

/** Hash FNV-1a de 32 bits: sorteio estável sem estado. */
function sorteio(texto: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < texto.length; i++) h = Math.imul(h ^ texto.charCodeAt(i), 0x01000193);
  return h >>> 0;
}

/** Minutos de cada rodada do rodízio: a ordem dos impulsos comprados é sorteada de novo a cada rodada. */
export const RODADA_RODIZIO_MIN = 15;

/** Número da rodada atual (00, 15, 30 e 45 de cada hora). */
const rodadaDoRodizio = (agora: Date) => Math.floor(agora.getTime() / (RODADA_RODIZIO_MIN * 60_000));

/** O evento fica na área escolhida pelo visitante (preferência no rodízio; nacional não prefere ninguém). */
function eventoNaArea(e: Evento | undefined, local: Abrangencia): boolean {
  if (!e || local.escopo === "nacional") return false;
  if (local.escopo === "regiao") return UF_REGIAO[e.uf.toUpperCase()] === local.regiao;
  if (local.escopo === "estado") return e.uf.toUpperCase() === local.uf?.toUpperCase();
  return e.uf.toUpperCase() === local.uf?.toUpperCase() && e.cidade.trim().toLowerCase() === local.cidade?.trim().toLowerCase();
}

/** Campanhas ativas da posição e da área, uma por evento, na ordem estável. */
function candidatasNaPosicao(base: BaseDados, posicao: string, local: Abrangencia, agora: Date): Impulsionamento[] {
  const vistos = new Set<string>();
  return base.impulsionamentos
    .filter((c) => c.posicoes.includes(posicao))
    .filter((c) => statusExibido(base, c, agora) === "ativo")
    .filter((c) => areasSobrepostas(c.abrangencia, local))
    .sort(comparar)
    .filter((c) => (vistos.has(c.eventoId) ? false : (vistos.add(c.eventoId), true)));
}

/**
 * Campanhas exibidas numa posição para o local escolhido; um evento aparece uma vez só.
 * As da administração vêm primeiro, na ordem estável. Os impulsos comprados entram num
 * rodízio: no máximo LIMITE_IMPULSOS_COMPRADOS por bloco, eventos da área do visitante
 * primeiro e, entre eles, ordem sorteada por visitante a cada 15 minutos, para que todos os
 * organizadores que pagaram tenham chances parecidas de aparecer.
 */
export function campanhasNaPosicao(base: BaseDados, posicao: string, local: Abrangencia, agora: Date, opcoes: OpcoesExibicao = {}): Impulsionamento[] {
  const candidatas = candidatasNaPosicao(base, posicao, local, agora).filter((c) => !opcoes.filtro || opcoes.filtro(c.eventoId));
  const daAdministracao = candidatas.filter((c) => !c.impulsoId);
  const chave = `${opcoes.semente ?? ""}:${rodadaDoRodizio(agora)}:${posicao}`;
  const evento = (id: string) => base.eventos.find((e) => e.id === id);
  const compradas = candidatas
    .filter((c) => c.impulsoId)
    .map((c) => ({ c, perto: eventoNaArea(evento(c.eventoId), local), ordem: sorteio(`${chave}:${c.eventoId}`) }))
    .sort((a, b) => Number(b.perto) - Number(a.perto) || a.ordem - b.ordem || a.c.id.localeCompare(b.c.id))
    .slice(0, LIMITE_IMPULSOS_COMPRADOS)
    .map((x) => x.c);
  return [...daAdministracao, ...compradas];
}

/** Campanhas do mesmo evento com período e posição sobrepostos (aviso ao admin). */
export function sobreposicoes(base: BaseDados, c: Pick<Impulsionamento, "id" | "eventoId" | "posicoes" | "inicioEm" | "fimEm">): Impulsionamento[] {
  return base.impulsionamentos.filter((x) =>
    x.id !== c.id && x.eventoId === c.eventoId && x.status !== "encerrado" && x.status !== "rascunho" &&
    x.posicoes.some((p) => c.posicoes.includes(p)) &&
    ms(x.inicioEm) < ms(c.fimEm) && ms(c.inicioEm) < ms(x.fimEm));
}

// ===== Métricas por campanha =====
// Exibições e cliques vêm dos cards marcados com o id da campanha; visitas e inscrições
// herdam essa atribuição dentro da sessão (mesma regra dos links de campanha).
export interface MetricasCampanha {
  exibicoes: number; cliques: number; visitas: number; inscricoes: number;
  /** cliques ÷ exibições × 100; null sem exibições. */
  ctr: number | null;
  /** inscrições ÷ visitas × 100; null sem visitas. */
  conversao: number | null;
}

export function metricasCampanha(regs: { tipo: string; campanhaId?: string | undefined }[], campanhaId: string): MetricasCampanha {
  const meus = regs.filter((r) => r.campanhaId === campanhaId);
  const n = (t: string) => meus.filter((r) => r.tipo === t).length;
  const exibicoes = n("exibicao"), cliques = n("clique"), visitas = n("visita"), inscricoes = n("inscricao_confirmada");
  return {
    exibicoes, cliques, visitas, inscricoes,
    ctr: exibicoes ? (cliques / exibicoes) * 100 : null,
    conversao: visitas ? (inscricoes / visitas) * 100 : null,
  };
}

// ===== Prévia com diagnóstico =====
export interface DiagnosticoCampanha {
  campanha: Impulsionamento;
  aparece: boolean;
  /** Posição (1, 2, …) dentro do bloco impulsionado quando aparece. */
  ordem?: number | undefined;
  motivos: string[];
}

/** Para uma posição e um local, explica por que cada campanha aparece ou não. */
export function diagnosticarPosicao(base: BaseDados, posicao: string, local: Abrangencia, agora: Date): DiagnosticoCampanha[] {
  const exibidas = campanhasNaPosicao(base, posicao, local, agora);
  const ordem = new Map(exibidas.map((c, i) => [c.id, i + 1]));
  return base.impulsionamentos
    .filter((c) => c.status !== "encerrado" || ms(c.fimEm) > agora.getTime() - 30 * 86400000)
    .map((c): DiagnosticoCampanha => {
      if (ordem.has(c.id)) {
        const motivos = ["Ativa no período, nesta posição e nesta área."];
        motivos.push(c.prioridade === "alta" ? "Prioridade alta." : "Prioridade normal.");
        return { campanha: c, aparece: true, ordem: ordem.get(c.id), motivos };
      }
      const motivos: string[] = [];
      const st = statusExibido(base, c, agora);
      if (st !== "ativo") motivos.push(`Status: ${ROTULO_STATUS_IMPULSIONAMENTO[st]}.`);
      if (st === "agendado") motivos.push(`Começa em ${new Date(c.inicioEm).toLocaleString("pt-BR")}.`);
      if (!c.posicoes.includes(posicao)) motivos.push("Esta posição não foi escolhida na campanha.");
      if (!areasSobrepostas(c.abrangencia, local)) motivos.push("A área escolhida fica fora da abrangência da campanha.");
      if (!motivos.length) {
        const vencedora = exibidas.find((x) => x.eventoId === c.eventoId);
        motivos.push(
          vencedora ? "Outra campanha da mesma operação tem precedência (a operação aparece uma vez só)."
            : c.impulsoId ? `Fora do rodízio desta prévia: até ${LIMITE_IMPULSOS_COMPRADOS} impulsos comprados por bloco, sorteados por visitante a cada ${RODADA_RODIZIO_MIN} minutos.`
            : "Não atende às regras de exibição.",
        );
      }
      return { campanha: c, aparece: false, motivos };
    })
    .sort((a, b) => (a.aparece === b.aparece ? (a.ordem ?? 0) - (b.ordem ?? 0) : a.aparece ? -1 : 1));
}
