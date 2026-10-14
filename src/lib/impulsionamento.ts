// Regras puras do impulsionamento de operações: estado exibido, elegibilidade,
// concorrência entre campanhas e posições de divulgação.
// Não há agendador no servidor: o estado é recalculado a cada carregamento.
import type { Abrangencia, BaseDados, Evento, Impulsionamento, SecaoInicial } from "@/lib/domain/types";
import { POSICAO_LISTAGEM } from "@/lib/domain/types";
import { areasSobrepostas, esgotado } from "@/lib/divulgacao";

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
  const validas = new Set([POSICAO_LISTAGEM, ...secoesCompativeis(base).map((s) => s.id)]);
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

/** Campanhas exibidas numa posição para o local escolhido; um evento aparece uma vez só. */
export function campanhasNaPosicao(base: BaseDados, posicao: string, local: Abrangencia, agora: Date): Impulsionamento[] {
  const vistos = new Set<string>();
  return base.impulsionamentos
    .filter((c) => c.posicoes.includes(posicao))
    .filter((c) => statusExibido(base, c, agora) === "ativo")
    .filter((c) => areasSobrepostas(c.abrangencia, local))
    .sort(comparar)
    .filter((c) => (vistos.has(c.eventoId) ? false : (vistos.add(c.eventoId), true)));
}

/** Campanhas do mesmo evento com período e posição sobrepostos (aviso ao admin). */
export function sobreposicoes(base: BaseDados, c: Pick<Impulsionamento, "id" | "eventoId" | "posicoes" | "inicioEm" | "fimEm">): Impulsionamento[] {
  return base.impulsionamentos.filter((x) =>
    x.id !== c.id && x.eventoId === c.eventoId && x.status !== "encerrado" && x.status !== "rascunho" &&
    x.posicoes.some((p) => c.posicoes.includes(p)) &&
    ms(x.inicioEm) < ms(c.fimEm) && ms(c.inicioEm) < ms(x.fimEm));
}
