// Regras puras da lista de movimentações do financeiro: abas por tipo, filtros
// (busca, período, meio de pagamento), ordenação e totais. Sem React e sem rede.
import type { Inscricao, Movimentacao, TipoMovimentacao } from "@/lib/domain/types";

export type AbaMovimentacao = "todas" | TipoMovimentacao;
export type OrdemMovimentacao = "recentes" | "antigas" | "maior_valor";
export type MeioPagamento = "todos" | "online" | "manual";

export const ABAS_MOVIMENTACAO: { id: AbaMovimentacao; rotulo: string }[] = [
  { id: "todas", rotulo: "Todas" },
  { id: "inscricao", rotulo: "Entradas" },
  { id: "desconto_cupom", rotulo: "Descontos" },
  { id: "estorno", rotulo: "Estornos" },
  { id: "ajuste", rotulo: "Ajustes" },
];

export const ROTULO_TIPO_MOVIMENTACAO: Record<TipoMovimentacao, string> = {
  inscricao: "Entrada",
  desconto_cupom: "Desconto",
  estorno: "Estorno",
  ajuste: "Ajuste",
};

export interface FiltrosMovimentacao {
  aba: AbaMovimentacao;
  busca: string;
  /** Datas "AAAA-MM-DD" (inclusivas), no fuso do navegador. */
  de: string;
  ate: string;
  meio: MeioPagamento;
  ordem: OrdemMovimentacao;
}

export const FILTROS_INICIAIS: FiltrosMovimentacao = { aba: "todas", busca: "", de: "", ate: "", meio: "todos", ordem: "recentes" };

/** Movimentação com o que a tela precisa da inscrição de origem (código e meio de pagamento). */
export interface LinhaMovimentacao extends Movimentacao {
  codigoInscricao?: string | undefined;
  online: boolean;
  /**
   * Descontos são gravados com valor 0 (não movem dinheiro); o valor concedido vem da
   * inscrição de origem, para a aba de descontos mostrar quanto foi abatido.
   */
  descontoCentavos?: number | undefined;
}

export function linhasDeMovimentacao(
  movs: Movimentacao[],
  inscricoes: Pick<Inscricao, "id" | "codigo" | "pagamento" | "descontoCentavos">[],
): LinhaMovimentacao[] {
  const porId = new Map(inscricoes.map((i) => [i.id, i]));
  return movs.map((m) => {
    const ins = m.inscricaoId ? porId.get(m.inscricaoId) : undefined;
    return {
      ...m,
      codigoInscricao: ins?.codigo || undefined,
      online: !!ins?.pagamento,
      descontoCentavos: m.tipo === "desconto_cupom" ? ins?.descontoCentavos : undefined,
    };
  });
}

/** Valor que a linha soma no total da aba: descontos somam o valor concedido; o resto, o dinheiro movido. */
const valorNoTotal = (l: LinhaMovimentacao, aba: AbaMovimentacao) =>
  aba === "desconto_cupom" ? (l.descontoCentavos ?? 0) : l.valorCentavos;

const semAcento = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const inicioDoDia = (d: string) => new Date(`${d}T00:00:00`).getTime();

/** Filtros que valem para todas as abas (as contagens das abas respeitam a busca e o período). */
function passaFiltrosGerais(l: LinhaMovimentacao, f: FiltrosMovimentacao): boolean {
  const t = Date.parse(l.criadoEm);
  if (f.de && t < inicioDoDia(f.de)) return false;
  if (f.ate && t >= inicioDoDia(f.ate) + 86_400_000) return false;
  if (f.meio === "online" && !l.online) return false;
  if (f.meio === "manual" && l.online) return false;
  const q = semAcento(f.busca.trim());
  if (q && !semAcento(`${l.descricao} ${l.codigoInscricao ?? ""}`).includes(q)) return false;
  return true;
}

export function filtrarMovimentacoes(linhas: LinhaMovimentacao[], f: FiltrosMovimentacao): LinhaMovimentacao[] {
  const r = linhas.filter((l) => (f.aba === "todas" || l.tipo === f.aba) && passaFiltrosGerais(l, f));
  const porData = (a: LinhaMovimentacao, b: LinhaMovimentacao) => a.criadoEm.localeCompare(b.criadoEm) || a.id.localeCompare(b.id);
  if (f.ordem === "antigas") return r.sort(porData);
  const peso = (l: LinhaMovimentacao) => Math.abs(l.valorCentavos) || (l.descontoCentavos ?? 0);
  if (f.ordem === "maior_valor") return r.sort((a, b) => peso(b) - peso(a) || porData(b, a));
  return r.sort((a, b) => porData(b, a));
}

/** Quantidade e soma de cada aba com os filtros gerais aplicados. */
export function resumoPorAba(linhas: LinhaMovimentacao[], f: FiltrosMovimentacao): Record<AbaMovimentacao, { quantidade: number; totalCentavos: number }> {
  const r = Object.fromEntries(ABAS_MOVIMENTACAO.map((a) => [a.id, { quantidade: 0, totalCentavos: 0 }])) as Record<AbaMovimentacao, { quantidade: number; totalCentavos: number }>;
  for (const l of linhas) {
    if (!passaFiltrosGerais(l, f)) continue;
    for (const aba of ["todas", l.tipo] as const) {
      r[aba].quantidade += 1;
      r[aba].totalCentavos += valorNoTotal(l, aba);
    }
  }
  return r;
}

/** Quantos filtros (além da aba e da ordem) estão em uso. */
export function filtrosAtivos(f: FiltrosMovimentacao): number {
  return [f.busca.trim(), f.de, f.ate, f.meio !== "todos" ? f.meio : ""].filter(Boolean).length;
}
