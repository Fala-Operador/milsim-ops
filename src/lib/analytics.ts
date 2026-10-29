import { tr } from "@/i18n/lib/analytics";
import { localeAtual } from "@/i18n/dicionario";
// Tipos e agregações puras das métricas de evento (sem dados pessoais).
// Fórmulas:
//  CTR dos cards = cliques ÷ exibições × 100
//  Conversão de visitantes = visitantes com inscrição confirmada ÷ visitantes únicos × 100
//  Conclusão da inscrição = fluxos concluídos ÷ fluxos iniciados × 100
//  Receita confirmada = Σ (valor − desconto) das inscrições confirmadas no período
//  Ticket médio = receita confirmada ÷ pedidos pagos (valor final > 0)

export type TipoAnalytics =
  | "exibicao"
  | "clique"
  | "visita"
  | "clique_inscrever"
  | "inscricao_iniciada"
  | "inscricao_confirmada"
  | "cortesia_resgatada"
  | "inclusao_administrativa";

export type OrigemAcesso = "inicio" | "destaques" | "regional" | "busca" | "campanha" | "direto";

export const ROTULO_ORIGEM: Record<OrigemAcesso, string> = {
  get inicio() { return tr("pagina_inicial"); },
  get destaques() { return tr("operacoes_em_destaque"); },
  get regional() { return tr("secao_regional"); },
  get busca() { return tr("busca_de_eventos"); },
  get campanha() { return tr("link_de_campanha"); },
  get direto() { return tr("link_direto_ou_origem_desconhecida"); },
};

/** Registro anônimo: apenas ids aleatórios, nunca nome, e-mail, CPF ou conteúdo de formulário. */
export interface RegistroAnalytics {
  id: string;
  tipo: TipoAnalytics;
  eventoId: string;
  visitanteId: string;
  sessaoId: string;
  origem: OrigemAcesso;
  secaoId?: string | undefined;
  posicao?: number | undefined;
  campanhaId?: string | undefined;
  fluxoId?: string | undefined;
  inscricaoId?: string | undefined;
  em: number; // epoch ms
}

export type OrigemCampanha = "instagram" | "whatsapp" | "parceiro" | "lancamento" | "outro";
export const ROTULO_ORIGEM_CAMPANHA: Record<OrigemCampanha, string> = {
  get instagram() { return tr("instagram"); }, get whatsapp() { return tr("whatsapp"); }, get parceiro() { return tr("parceiro"); }, get lancamento() { return tr("campanha_de_lancamento"); }, get outro() { return tr("outro"); },
};
export interface Campanha {
  id: string;
  eventoId: string;
  nome: string;
  origem: OrigemCampanha;
  criadoEm: string;
}

export interface Filtro {
  eventoIds?: Set<string> | undefined;
  desde?: number | undefined;
  ate?: number | undefined;
  origem?: string | undefined; // OrigemAcesso ou "cmp:<id>"
}

export function filtrar(regs: RegistroAnalytics[], f: Filtro): RegistroAnalytics[] {
  return regs.filter((r) => {
    if (f.eventoIds && !f.eventoIds.has(r.eventoId)) return false;
    if (f.desde !== undefined && r.em < f.desde) return false;
    if (f.ate !== undefined && r.em > f.ate) return false;
    if (f.origem) {
      if (f.origem.startsWith("cmp:")) return r.campanhaId === f.origem.slice(4);
      if (r.origem !== f.origem) return false;
    }
    return true;
  });
}

export const taxa = (num: number, den: number): number | null => (den > 0 ? (num / den) * 100 : null);

export interface Indicadores {
  exibicoes: number;
  cliques: number;
  visitas: number;
  visitantes: number;
  cliquesInscrever: number;
  iniciadas: number;
  confirmadas: number;
  cortesias: number;
  inclusoes: number;
  concluidas: number;
  naoConcluidos: number;
  ctr: number | null;
  conversao: number | null;
  conclusao: number | null;
}

/** `todos` permite achar conclusões posteriores ao período para fluxos iniciados nele. */
export function indicadores(regs: RegistroAnalytics[], todos: RegistroAnalytics[]): Indicadores {
  const conta = (t: TipoAnalytics) => regs.filter((r) => r.tipo === t).length;
  const visitantes = new Set(regs.filter((r) => r.tipo === "visita").map((r) => r.visitanteId));
  const confirmadas = regs.filter((r) => r.tipo === "inscricao_confirmada");
  const convertidos = new Set(confirmadas.map((r) => r.visitanteId).filter((v) => visitantes.has(v)));
  const fluxosConcluidos = new Set(todos.filter((r) => r.tipo === "inscricao_confirmada" && r.fluxoId).map((r) => r.fluxoId));
  const iniciadas = regs.filter((r) => r.tipo === "inscricao_iniciada");
  const concluidas = iniciadas.filter((r) => fluxosConcluidos.has(r.id)).length;
  const exibicoes = conta("exibicao");
  const cliques = conta("clique");
  return {
    exibicoes, cliques, visitas: conta("visita"), visitantes: visitantes.size,
    cliquesInscrever: conta("clique_inscrever"), iniciadas: iniciadas.length, confirmadas: confirmadas.length,
    cortesias: conta("cortesia_resgatada"), inclusoes: conta("inclusao_administrativa"),
    concluidas, naoConcluidos: iniciadas.length - concluidas,
    ctr: taxa(cliques, exibicoes),
    conversao: taxa(convertidos.size, visitantes.size),
    conclusao: taxa(concluidas, iniciadas.length),
  };
}

/** Campos da inscrição usados nas métricas de venda (sem dados pessoais). */
export interface VendaAnalisada {
  eventoId: string;
  status: string;
  valorCentavos: number;
  descontoCentavos: number;
  criadoEm: string;
  pagamento?: { status: string; valorCentavos: number; pagoEm?: string | undefined } | undefined;
}

export interface ResumoVendas {
  receitaCentavos: number;
  pedidos: number;
  ticketMedioCentavos: number | null;
  pagoOnlineCentavos: number;
}

/**
 * Vendas confirmadas no período, a partir das inscrições (sem chamar o Stripe). A data é a do
 * pagamento quando houver; inscrições canceladas ou estornadas não entram.
 */
export function resumoVendas(inscricoes: VendaAnalisada[], f: { eventoIds: Set<string>; desde: number; ate: number }): ResumoVendas {
  let receitaCentavos = 0, pedidos = 0, pagoOnlineCentavos = 0;
  for (const i of inscricoes) {
    if (i.status !== "confirmada" || !f.eventoIds.has(i.eventoId)) continue;
    const t = new Date(i.pagamento?.pagoEm ?? i.criadoEm).getTime();
    if (t < f.desde || t > f.ate) continue;
    const valor = Math.max(0, i.valorCentavos - i.descontoCentavos);
    if (valor <= 0) continue;
    receitaCentavos += valor;
    pedidos += 1;
    if (i.pagamento?.status === "pago") pagoOnlineCentavos += i.pagamento.valorCentavos;
  }
  return { receitaCentavos, pedidos, ticketMedioCentavos: pedidos ? Math.round(receitaCentavos / pedidos) : null, pagoOnlineCentavos };
}

/** Variação contra o período anterior; null quando a base anterior é zero. */
export function variacao(atual: number, anterior: number): number | null {
  return anterior > 0 ? ((atual - anterior) / anterior) * 100 : null;
}

const DIA = 86400000;
export function serieDiaria(regs: RegistroAnalytics[], desde: number, ate: number) {
  const inicio = new Date(desde); inicio.setHours(0, 0, 0, 0);
  const dias: { dia: string; chave: number; visitas: number; cliques: number }[] = [];
  for (let t = inicio.getTime(); t <= ate; t += DIA) {
    dias.push({ dia: new Date(t).toLocaleDateString(localeAtual(), { day: "2-digit", month: "2-digit" }), chave: t, visitas: 0, cliques: 0 });
  }
  for (const r of regs) {
    if (r.tipo !== "visita" && r.tipo !== "clique") continue;
    const i = Math.floor((r.em - inicio.getTime()) / DIA);
    const d = dias[i];
    if (!d) continue;
    if (r.tipo === "visita") d.visitas++; else d.cliques++;
  }
  return dias;
}

export interface LinhaGrupo { chave: string; ind: Indicadores }
export function agrupar(regs: RegistroAnalytics[], todos: RegistroAnalytics[], chave: (r: RegistroAnalytics) => string | undefined): LinhaGrupo[] {
  const mapa = new Map<string, RegistroAnalytics[]>();
  for (const r of regs) {
    const k = chave(r);
    if (!k) continue;
    (mapa.get(k) ?? mapa.set(k, []).get(k)!).push(r);
  }
  return [...mapa.entries()].map(([k, lista]) => ({ chave: k, ind: indicadores(lista, todos) }));
}

export function chaveOrigem(r: RegistroAnalytics): string {
  return r.campanhaId ? `cmp:${r.campanhaId}` : r.origem;
}
