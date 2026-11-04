// Regras puras de venda: disponibilidade de ingressos por lote e situação de cupons.
// Usadas igualmente na tela de inscrição, na gestão do evento e na confirmação no servidor.
import type { Cupom, Evento, Lote } from "@/lib/domain/types";
import { tr } from "@/i18n/lib/vendas";

export type MotivoIndisponivel = "nao_configurado" | "agendado" | "encerrado" | "inativo" | "esgotado";

export type Disponibilidade =
  | { disponivel: true; lote: Lote; precoCentavos: number; restantes: number }
  | { disponivel: false; motivo: MotivoIndisponivel; inicioVendas?: string | undefined };

/** Ocupação já usada de um lote para um tipo (injetada para manter a regra pura). */
export type OcupacaoLote = (loteId: string, tipoId: string) => number;

export const TEXTO_MOTIVO: Record<MotivoIndisponivel, string> = {
  get nao_configurado() { return tr("nenhum_lote_de_venda_configurado"); },
  get agendado() { return tr("as_vendas_ainda_nao_comecaram"); },
  get encerrado() { return tr("o_periodo_de_vendas_terminou"); },
  get inativo() { return tr("o_lote_de_venda_esta_inativo"); },
  get esgotado() { return tr("as_vagas_do_lote_esgotaram"); },
};

/** O lote que abre as vendas do evento: o único cuja data de início vale. */
export const primeiroLoteAtivo = (evento: Pick<Evento, "lotes">) => evento.lotes.find((l) => l.status === "ativo");

/**
 * Disponibilidade comercial de um tipo de ingresso. Nunca usa o preço base como
 * alternativa: sem lote aberto com vagas, o tipo está indisponível.
 *
 * Os lotes ativos formam uma sequência, na ordem da lista. Só o primeiro tem data de abertura: ela
 * abre as vendas do evento. Cada lote seguinte abre sozinho quando o anterior acaba, por esgotar ou
 * pela data de fim das vendas, com o preço dele.
 */
export function disponibilidadeTipo(
  evento: Evento,
  tipoId: string,
  ocupacao: OcupacaoLote,
  agora: Date = new Date(),
): Disponibilidade {
  const lotes = evento.lotes.filter((l) => l.itens.some((it) => it.tipoId === tipoId));
  if (lotes.length === 0) return { disponivel: false, motivo: "nao_configurado" };
  const ativos = lotes.filter((l) => l.status === "ativo");
  if (ativos.length === 0) return { disponivel: false, motivo: "inativo" };
  const abertura = primeiroLoteAtivo(evento)!.inicioVendas;
  if (new Date(abertura) > agora) return { disponivel: false, motivo: "agendado", inicioVendas: abertura };
  let algumEsgotou = false;
  for (const lote of ativos) {
    if (agora > new Date(lote.fimVendas)) continue;
    const item = lote.itens.find((it) => it.tipoId === tipoId)!;
    const restantes = item.quantidade - ocupacao(lote.id, tipoId);
    if (restantes > 0) return { disponivel: true, lote, precoCentavos: item.precoCentavos, restantes };
    algumEsgotou = true;
  }
  return { disponivel: false, motivo: algumEsgotou ? "esgotado" : "encerrado" };
}

/**
 * "A partir de" dos cartões: o menor preço à venda agora (lote esgotado não conta). Sem nada à
 * venda, o menor preço dos lotes ativos ou, sem lote, do preço base, só como referência.
 */
export function precoAPartirDe(evento: Evento, ocupacao: OcupacaoLote, agora: Date = new Date()): number {
  const tipos = evento.tipos.filter((t) => !t.arquivado);
  const aVenda = tipos.flatMap((t) => {
    const d = disponibilidadeTipo(evento, t.id, ocupacao, agora);
    return d.disponivel ? [d.precoCentavos] : [];
  });
  if (aVenda.length) return Math.min(...aVenda);
  const dosLotes = evento.lotes.filter((l) => l.status === "ativo").flatMap((l) => l.itens.map((i) => i.precoCentavos));
  return Math.min(...(dosLotes.length ? dosLotes : evento.tipos.map((t) => t.precoBaseCentavos)));
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
  if (!codigo) e.codigo = tr("informe_o_codigo_do_cupom");
  else if (!/^[A-Z0-9_-]{3,40}$/.test(codigo)) e.codigo = tr("use_de_3_a_40_letras");
  else if (ctx.codigosExistentes.map(normalizarCodigoCupom).includes(codigo)) e.codigo = tr("ja_existe_um_cupom_com_este");
  if (!Number.isFinite(d.descontoPercentual) || !Number.isInteger(d.descontoPercentual) || d.descontoPercentual <= 0 || d.descontoPercentual > 100) {
    e.descontoPercentual = tr("o_desconto_deve_ser_um_numero");
  }
  if (d.limiteUsos !== null && (!Number.isInteger(d.limiteUsos) || d.limiteUsos < 1)) {
    e.limiteUsos = tr("o_limite_deve_ser_um_numero");
  }
  if (!d.validoDe || Number.isNaN(Date.parse(d.validoDe))) e.validoDe = tr("informe_o_inicio_da_validade");
  if (d.validoAte !== null) {
    if (Number.isNaN(Date.parse(d.validoAte))) e.validoAte = tr("informe_o_fim_da_validade_ou");
    else if (!e.validoDe && Date.parse(d.validoAte) <= Date.parse(d.validoDe)) e.validoAte = tr("o_fim_deve_ser_posterior_ao");
  }
  if (d.tiposElegiveis.length === 0 || d.tiposElegiveis.some((t) => !ctx.tiposDoEvento.includes(t))) {
    e.tiposElegiveis = tr("selecione_pelo_menos_um_tipo_de");
  }
  return e;
}

export function resumoCupom(d: Pick<DadosCupom, "codigo" | "descontoPercentual" | "limiteUsos">, todosOsTipos: boolean) {
  const codigo = normalizarCodigoCupom(d.codigo) || tr("codigo");
  const usos = d.limiteUsos === null ? tr("sem_limite_de_utilizacoes") : tr.plural(d.limiteUsos, "com_ate_uma_utilizacao", "com_ate_n_utilizacoes");
  const alvo = todosOsTipos ? tr("em_todos_os_ingressos") : tr("nos_ingressos_selecionados");
  return tr("codigo_concede_valor_de_desconto_usos", { codigo, valor: d.descontoPercentual || 0, usos, alvo });
}
