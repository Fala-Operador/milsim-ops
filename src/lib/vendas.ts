// Regras puras de venda: disponibilidade de ingressos por lote e situação de cupons.
// Usadas igualmente na tela de inscrição, na gestão do evento e na confirmação no servidor.
import type { Cupom, Evento, Lote } from "@/lib/domain/types";

export type MotivoIndisponivel = "nao_configurado" | "agendado" | "encerrado" | "inativo" | "esgotado" | "tipo_esgotado";

export type Disponibilidade =
  | { disponivel: true; lote: Lote; precoCentavos: number; restantes: number }
  | { disponivel: false; motivo: MotivoIndisponivel; inicioVendas?: string | undefined };

/** Ocupação já usada de um lote para um tipo (injetada para manter a regra pura). */
export type OcupacaoLote = (loteId: string, tipoId: string) => number;

export const TEXTO_MOTIVO: Record<MotivoIndisponivel, string> = {
  nao_configurado: "nenhum lote de venda configurado",
  agendado: "as vendas ainda não começaram",
  encerrado: "o período de vendas terminou",
  inativo: "o lote de venda está inativo",
  esgotado: "as vagas do lote esgotaram",
  tipo_esgotado: "este tipo de ingresso esgotou",
};

/**
 * Disponibilidade comercial de um tipo de ingresso. Nunca usa o preço base como
 * alternativa: sem lote vigente com vagas, o tipo está indisponível.
 */
export function disponibilidadeTipo(
  evento: Evento,
  tipoId: string,
  ocupacao: OcupacaoLote,
  agora: Date = new Date(),
  ocupacaoDoTipo = 0,
): Disponibilidade {
  const tipo = evento.tipos.find((t) => t.id === tipoId && !t.arquivado);
  if (tipo && ocupacaoDoTipo >= tipo.quantidadeMaxima) return { disponivel: false, motivo: "tipo_esgotado" };
  const lotes = evento.lotes.filter((l) => l.itens.some((it) => it.tipoId === tipoId));
  if (lotes.length === 0) return { disponivel: false, motivo: "nao_configurado" };
  const ativos = lotes.filter((l) => l.status === "ativo");
  if (ativos.length === 0) return { disponivel: false, motivo: "inativo" };
  const vigentes = ativos.filter((l) => new Date(l.inicioVendas) <= agora && agora <= new Date(l.fimVendas));
  for (const lote of vigentes) {
    const item = lote.itens.find((it) => it.tipoId === tipoId)!;
    const restantes = item.quantidade - ocupacao(lote.id, tipoId);
    if (restantes > 0) return { disponivel: true, lote, precoCentavos: item.precoCentavos, restantes };
  }
  if (vigentes.length > 0) return { disponivel: false, motivo: "esgotado" };
  const futuros = ativos
    .filter((l) => new Date(l.inicioVendas) > agora)
    .sort((a, b) => a.inicioVendas.localeCompare(b.inicioVendas));
  if (futuros.length > 0) return { disponivel: false, motivo: "agendado", inicioVendas: futuros[0]!.inicioVendas };
  return { disponivel: false, motivo: "encerrado" };
}

// ---------- Cupons ----------
export const normalizarCodigoCupom = (codigo: string) => codigo.trim().toUpperCase();

export type SituacaoCupom = "ativo" | "agendado" | "expirado" | "esgotado" | "inativo";

export function situacaoCupom(c: Cupom, agora: Date = new Date()): SituacaoCupom {
  if (!c.ativo) return "inativo";
  if (c.limiteUsos !== null && c.usos >= c.limiteUsos) return "esgotado";
  if (agora < new Date(c.validoDe)) return "agendado";
  if (c.validoAte !== null && agora > new Date(c.validoAte)) return "expirado";
  return "ativo";
}

/** Desconto em centavos, arredondado ao centavo mais próximo. */
export const descontoCupom = (precoCentavos: number, percentual: number) =>
  Math.round((precoCentavos * percentual) / 100);

export interface DadosCupom {
  codigo: string;
  descontoPercentual: number;
  limiteUsos: number | null; // null = sem limite (opção explícita)
  validoDe: string;
  validoAte: string | null; // null = sem data de término (opção explícita)
  tiposElegiveis: string[];
  ativo: boolean;
}

/** Erros por campo; objeto vazio = válido. */
export function validarDadosCupom(
  d: DadosCupom,
  ctx: { codigosExistentes: string[]; tiposDoEvento: string[] },
): Partial<Record<keyof DadosCupom, string>> {
  const e: Partial<Record<keyof DadosCupom, string>> = {};
  const codigo = normalizarCodigoCupom(d.codigo);
  if (!codigo) e.codigo = "Informe o código do cupom.";
  else if (!/^[A-Z0-9_-]{3,40}$/.test(codigo)) e.codigo = "Use de 3 a 40 letras, números, hífen ou sublinhado, sem espaços.";
  else if (ctx.codigosExistentes.map(normalizarCodigoCupom).includes(codigo)) e.codigo = "Já existe um cupom com este código nesta operação.";
  if (!Number.isFinite(d.descontoPercentual) || !Number.isInteger(d.descontoPercentual) || d.descontoPercentual <= 0 || d.descontoPercentual > 100) {
    e.descontoPercentual = "O desconto deve ser um número inteiro maior que 0 e de até 100%.";
  }
  if (d.limiteUsos !== null && (!Number.isInteger(d.limiteUsos) || d.limiteUsos < 1)) {
    e.limiteUsos = "O limite deve ser um número inteiro positivo.";
  }
  if (!d.validoDe || Number.isNaN(Date.parse(d.validoDe))) e.validoDe = "Informe o início da validade.";
  if (d.validoAte !== null) {
    if (Number.isNaN(Date.parse(d.validoAte))) e.validoAte = "Informe o fim da validade ou marque “Sem data de término”.";
    else if (!e.validoDe && Date.parse(d.validoAte) <= Date.parse(d.validoDe)) e.validoAte = "O fim deve ser posterior ao início.";
  }
  if (d.tiposElegiveis.length === 0 || d.tiposElegiveis.some((t) => !ctx.tiposDoEvento.includes(t))) {
    e.tiposElegiveis = "Selecione pelo menos um tipo de ingresso desta operação.";
  }
  return e;
}

export function resumoCupom(d: Pick<DadosCupom, "codigo" | "descontoPercentual" | "limiteUsos">, todosOsTipos: boolean) {
  const codigo = normalizarCodigoCupom(d.codigo) || "CÓDIGO";
  const usos = d.limiteUsos === null ? "sem limite de utilizações" : `com até ${d.limiteUsos} ${d.limiteUsos === 1 ? "utilização" : "utilizações"}`;
  const alvo = todosOsTipos ? "em todos os ingressos" : "nos ingressos selecionados";
  return `${codigo} concede ${d.descontoPercentual || 0}% de desconto, ${usos}, ${alvo} desta operação.`;
}
