// Regras puras da Central de análise: resumo agregado (sem dados pessoais),
// sugestões respondíveis, suficiência dos dados e leitura do resultado da IA.
import type { BaseDados } from "@/lib/domain/types";
import { MODALIDADES, SEM_MODALIDADE } from "@/lib/modalidades";

export type PeriodoAnalise = "todos" | "90d" | "30d";
export const ROTULO_PERIODO: Record<PeriodoAnalise, string> = {
  todos: "Todo o histórico",
  "90d": "Últimos 90 dias",
  "30d": "Últimos 30 dias",
};
const DIA = 86400000;

export interface ResumoAnalise {
  dataReferencia: string;
  periodo: PeriodoAnalise;
  totalEventos: number;
  totalInscricoes: number;
  inscricoesPorMes: Record<string, number>;
  inscricoesPorModalidade: Record<string, number>;
  inscricoesPorUf: Record<string, number>;
  eventos: {
    nome: string;
    cidade: string;
    data: string;
    status: string;
    modalidade: string;
    capacidade: number;
    inscricoesPorStatus: Record<string, number>;
    ocupacaoPct: number;
  }[];
}

export function montarResumo(base: BaseDados, periodo: PeriodoAnalise, agora = Date.now()): ResumoAnalise {
  const desde = periodo === "todos" ? -Infinity : agora - (periodo === "30d" ? 30 : 90) * DIA;
  const nomeMod = (id?: string) => MODALIDADES.find((m) => m.id === id)?.nome ?? SEM_MODALIDADE;
  const inscricoes = base.inscricoes.filter((i) => Date.parse(i.criadoEm) >= desde);
  const porMes: Record<string, number> = {};
  const porMod: Record<string, number> = {};
  const porUf: Record<string, number> = {};
  const evPorId = new Map(base.eventos.map((e) => [e.id, e]));
  for (const i of inscricoes) {
    porMes[i.criadoEm.slice(0, 7)] = (porMes[i.criadoEm.slice(0, 7)] ?? 0) + 1;
    const ev = evPorId.get(i.eventoId);
    if (!ev) continue;
    const m = nomeMod(ev.modalidade);
    porMod[m] = (porMod[m] ?? 0) + 1;
    porUf[ev.uf] = (porUf[ev.uf] ?? 0) + 1;
  }
  const eventos = base.eventos
    .filter((ev) => periodo === "todos" || inscricoes.some((i) => i.eventoId === ev.id) || Date.parse(ev.inicioEm) >= desde)
    .map((ev) => {
      const ins = inscricoes.filter((i) => i.eventoId === ev.id);
      const porStatus: Record<string, number> = {};
      for (const i of ins) porStatus[i.status] = (porStatus[i.status] ?? 0) + 1;
      const confirmadas = porStatus["confirmada"] ?? 0;
      return {
        nome: ev.nome,
        cidade: `${ev.cidade}/${ev.uf}`,
        data: ev.inicioEm.slice(0, 10),
        status: ev.status,
        modalidade: nomeMod(ev.modalidade),
        capacidade: ev.capacidadeTotal,
        inscricoesPorStatus: porStatus,
        ocupacaoPct: ev.capacidadeTotal ? Math.round((confirmadas / ev.capacidadeTotal) * 100) : 0,
      };
    });
  return {
    dataReferencia: new Date(agora).toISOString().slice(0, 10),
    periodo,
    totalEventos: eventos.length,
    totalInscricoes: inscricoes.length,
    inscricoesPorMes: porMes,
    inscricoesPorModalidade: porMod,
    inscricoesPorUf: porUf,
    eventos,
  };
}

export interface Sugestao { id: string; texto: string }

/** Só oferece perguntas que os dados do resumo conseguem responder. */
export function sugestoesDisponiveis(r: ResumoAnalise): Sugestao[] {
  const out: Sugestao[] = [];
  const comCapacidade = r.eventos.some((e) => e.capacidade > 0);
  if (comCapacidade && r.eventos.length > 0) {
    out.push({ id: "divulgacao", texto: "Quais eventos precisam de divulgação?" });
    out.push({ id: "ocupacao", texto: "Como está a ocupação das operações?" });
  }
  const mods = Object.keys(r.inscricoesPorModalidade).filter((m) => m !== SEM_MODALIDADE);
  if (mods.length >= 1 && r.totalInscricoes > 0) out.push({ id: "modalidades", texto: "Quais modalidades tiveram mais inscrições?" });
  if (Object.keys(r.inscricoesPorUf).length >= 2) out.push({ id: "regioes", texto: "Como os resultados variam por região?" });
  return out;
}

/** Retorna o motivo quando não há base mínima para analisar; null quando dá para seguir. */
export function faltaDados(r: ResumoAnalise): string | null {
  if (r.totalEventos === 0) return "Não há eventos no período escolhido. Amplie o período para incluir operações.";
  if (r.totalInscricoes === 0) return "Os eventos do período ainda não têm inscrições. Sem inscrições, não há como avaliar ocupação ou tendências.";
  return null;
}

export const SECOES_RESULTADO = ["Panorama geral", "Pontos de atenção", "Oportunidades", "Próximas ações"] as const;
export type SecaoResultado = (typeof SECOES_RESULTADO)[number];

export interface Achado { observado: string; evidencia?: string | undefined; acao?: string | undefined }
export interface ResultadoAnalise { secoes: { titulo: string; texto: string[]; achados: Achado[] }[] }

const limpar = (s: string) => s.replace(/\*\*/g, "").trim();

/** Lê o Markdown devolvido pela IA em blocos; linhas "Observado | Evidência | Ação" viram achados. */
export function lerResultado(md: string): ResultadoAnalise {
  const secoes: ResultadoAnalise["secoes"] = [];
  let atual: ResultadoAnalise["secoes"][number] | null = null;
  for (const bruta of md.split("\n")) {
    const l = bruta.trim();
    if (!l) continue;
    const titulo = /^#{1,4}\s+(.+)$/.exec(l);
    if (titulo) {
      atual = { titulo: limpar(titulo[1]!), texto: [], achados: [] };
      secoes.push(atual);
      continue;
    }
    if (!atual) {
      atual = { titulo: "Panorama geral", texto: [], achados: [] };
      secoes.push(atual);
    }
    const item = l.replace(/^([-*]|\d+\.)\s+/, "");
    const partes = item.split("|").map((p) => limpar(p).replace(/^(Observado|Evidência|Evidencia|Ação|Acao)\s*:\s*/i, ""));
    if (/^(Observado)\s*:/i.test(limpar(item)) || partes.length >= 2) {
      atual.achados.push({ observado: partes[0] ?? "", evidencia: partes[1] || undefined, acao: partes[2] || undefined });
    } else {
      atual.texto.push(limpar(item));
    }
  }
  return { secoes };
}
