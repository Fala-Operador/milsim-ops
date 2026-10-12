// Métricas de divulgação da página inicial (demonstração: guardadas só neste navegador).
import { storage } from "@/lib/storage";

export type TipoMetrica = "visualizacao" | "clique" | "visita";
export interface RegistroMetrica {
  tipo: TipoMetrica;
  secaoId: string;
  alvoId?: string | undefined; // evento ou parceiro
  em: string;
}

const CHAVE = "metricas-divulgacao";
const ORIGEM = "origem-inicio";
const LIMITE = 5000;
const vistas = new Set<string>();

export function listarMetricas(): RegistroMetrica[] {
  return storage.ler<RegistroMetrica[]>(CHAVE) ?? [];
}

export function registrarMetrica(r: Omit<RegistroMetrica, "em">): void {
  const lista = listarMetricas();
  lista.push({ ...r, em: new Date().toISOString() });
  storage.gravar(CHAVE, lista.slice(-LIMITE));
}

/** Uma visualização por seção a cada carregamento da página. */
export function registrarVisualizacao(secaoId: string): void {
  if (vistas.has(secaoId)) return;
  vistas.add(secaoId);
  registrarMetrica({ tipo: "visualizacao", secaoId });
}

/** Clique num card de evento: guarda a origem para contar a visita quando a página do evento abrir. */
export function registrarCliqueEvento(secaoId: string, eventoId: string): void {
  registrarMetrica({ tipo: "clique", secaoId, alvoId: eventoId });
  storage.gravar(ORIGEM, { secaoId, eventoId, em: Date.now() });
}

export function confirmarVisitaEvento(eventoId: string): void {
  const o = storage.ler<{ secaoId: string; eventoId: string; em: number }>(ORIGEM);
  if (!o || o.eventoId !== eventoId || Date.now() - o.em > 60_000) return;
  storage.remover(ORIGEM);
  registrarMetrica({ tipo: "visita", secaoId: o.secaoId, alvoId: eventoId });
}

export function limparMetricas(): void {
  storage.remover(CHAVE);
}

export interface ResumoSecao { secaoId: string; visualizacoes: number; cliques: number; visitas: number; taxaClique: number }

export function resumirMetricas(lista: RegistroMetrica[], desde?: Date) {
  const filtrada = desde ? lista.filter((r) => new Date(r.em) >= desde) : lista;
  const porSecao = new Map<string, ResumoSecao>();
  const porAlvo = new Map<string, { cliques: number; visitas: number }>();
  for (const r of filtrada) {
    const s = porSecao.get(r.secaoId) ?? { secaoId: r.secaoId, visualizacoes: 0, cliques: 0, visitas: 0, taxaClique: 0 };
    if (r.tipo === "visualizacao") s.visualizacoes++;
    if (r.tipo === "clique") s.cliques++;
    if (r.tipo === "visita") s.visitas++;
    porSecao.set(r.secaoId, s);
    if (r.alvoId && r.tipo !== "visualizacao") {
      const a = porAlvo.get(r.alvoId) ?? { cliques: 0, visitas: 0 };
      if (r.tipo === "clique") a.cliques++; else a.visitas++;
      porAlvo.set(r.alvoId, a);
    }
  }
  const secoes = [...porSecao.values()].map((s) => ({ ...s, taxaClique: s.visualizacoes ? s.cliques / s.visualizacoes : 0 }));
  const total = secoes.reduce((t, s) => ({ v: t.v + s.visualizacoes, c: t.c + s.cliques, i: t.i + s.visitas }), { v: 0, c: 0, i: 0 });
  return { secoes, alvos: [...porAlvo.entries()].map(([id, x]) => ({ id, ...x })).sort((a, b) => b.cliques - a.cliques), total };
}
