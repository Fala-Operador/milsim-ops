// AnalyticsService: único ponto de coleta das métricas de evento (demonstração local).
// Não há coleta real: antes da produção será preciso definir base legal, retenção e consentimento.
// Registra apenas ids aleatórios; nunca nome, e-mail, CPF, telefone, endereço, exército ou conteúdo digitado.
import { storage } from "@/lib/storage";
import { carregarBase } from "@/services/db";
import { usuarioDaSessao } from "@/services/auth";
import type { Inscricao } from "@/lib/domain/types";
import type { Campanha, OrigemAcesso, OrigemCampanha, RegistroAnalytics, TipoAnalytics } from "@/lib/analytics";

const K = {
  registros: "analytics-registros",
  visitante: "analytics-visitante",
  sessao: "analytics-sessao",
  pendente: "analytics-clique-pendente",
  atribuicao: "analytics-atribuicao",
  fluxos: "analytics-fluxos-abertos",
  campanhas: "analytics-campanhas",
  semeado: "analytics-semeado",
};
const LIMITE = 8000;
const SESSAO_MS = 30 * 60000;

const rid = (p: string) => `${p}-${crypto.randomUUID?.() ?? Math.random().toString(36).slice(2) + Date.now().toString(36)}`;

interface Atribuicao { origem: OrigemAcesso; secaoId?: string | undefined; posicao?: number | undefined; campanhaId?: string | undefined; sessaoId: string }

// ===== Identificadores anônimos =====
function visitanteId(): string {
  let v = storage.ler<string>(K.visitante);
  if (!v) { v = rid("vis"); storage.gravar(K.visitante, v); }
  return v;
}
function sessaoId(): string {
  const agora = Date.now();
  const s = storage.ler<{ id: string; ultimo: number }>(K.sessao);
  const id = s && agora - s.ultimo < SESSAO_MS ? s.id : rid("ses");
  storage.gravar(K.sessao, { id, ultimo: agora });
  return id;
}

/** Admin autenticado e organizador nos próprios eventos não entram na coleta. */
function excluido(eventoId: string): boolean {
  const u = usuarioDaSessao();
  if (!u) return false;
  if (u.perfil === "admin") return true;
  if (u.perfil === "organizador") {
    const ev = carregarBase().eventos.find((e) => e.id === eventoId);
    return !!ev && ev.organizacaoId === u.organizacaoId;
  }
  return false;
}

export function listarRegistros(): RegistroAnalytics[] {
  semearHistorico();
  return storage.ler<RegistroAnalytics[]>(K.registros) ?? [];
}

function gravar(r: Omit<RegistroAnalytics, "id" | "visitanteId" | "sessaoId" | "em"> & { id?: string }): RegistroAnalytics {
  const reg: RegistroAnalytics = { id: r.id ?? rid("an"), visitanteId: visitanteId(), sessaoId: sessaoId(), em: Date.now(), ...r };
  const lista = listarRegistros();
  if (!lista.some((x) => x.id === reg.id)) {
    lista.push(reg);
    storage.gravar(K.registros, lista.slice(-LIMITE));
  }
  return reg;
}

// ===== Coleta =====
const exibicoesVistas = new Set<string>();
/** Chamado após 50% do card visível por 1s; uma vez por card, posição e visualização da página. */
export function registrarExibicao(p: { eventoId: string; origem: OrigemAcesso; secaoId?: string | undefined; posicao: number; visualizacaoId: string }) {
  const chave = `${p.visualizacaoId}:${p.secaoId ?? ""}:${p.eventoId}:${p.posicao}`;
  if (exibicoesVistas.has(chave) || excluido(p.eventoId)) return;
  exibicoesVistas.add(chave);
  gravar({ tipo: "exibicao", eventoId: p.eventoId, origem: p.origem, secaoId: p.secaoId, posicao: p.posicao });
}

export function registrarClique(p: { eventoId: string; origem: OrigemAcesso; secaoId?: string | undefined; posicao?: number | undefined }) {
  if (excluido(p.eventoId)) return;
  gravar({ tipo: "clique", ...p });
  storage.gravar(K.pendente, { ...p, em: Date.now() });
}

let ultimaVisita: { eventoId: string; em: number } | null = null;
/**
 * Visita: chamada quando a página do evento carrega com sucesso.
 * Ignora a segunda execução do Strict Mode/re-render (mesmo evento em < 1,5s); recarregar conta nova visita.
 * `campanhaId` vem apenas do parâmetro permitido `cmp` — nunca a URL completa.
 */
export function registrarVisita(eventoId: string, campanhaParam?: string | null) {
  if (ultimaVisita && ultimaVisita.eventoId === eventoId && Date.now() - ultimaVisita.em < 1500) return;
  ultimaVisita = { eventoId, em: Date.now() };
  if (excluido(eventoId)) return;
  const ses = sessaoId();
  const campanha = campanhaParam ? listarCampanhas().find((c) => c.id === campanhaParam && c.eventoId === eventoId) : undefined;
  const pend = storage.ler<{ eventoId: string; origem: OrigemAcesso; secaoId?: string; posicao?: number; em: number }>(K.pendente);
  let at: Atribuicao;
  if (campanha) at = { origem: "campanha", campanhaId: campanha.id, sessaoId: ses };
  else if (pend && pend.eventoId === eventoId && Date.now() - pend.em < 60000) at = { origem: pend.origem, secaoId: pend.secaoId, posicao: pend.posicao, sessaoId: ses };
  else at = { origem: "direto", sessaoId: ses };
  storage.remover(K.pendente);
  gravar({ tipo: "visita", eventoId, origem: at.origem, secaoId: at.secaoId, posicao: at.posicao, campanhaId: at.campanhaId });
  // Atribuição: último acesso identificado na sessão; acesso direto não sobrescreve um identificado.
  const mapa = storage.ler<Record<string, Atribuicao>>(K.atribuicao) ?? {};
  const atual = mapa[eventoId];
  if (at.origem !== "direto" || !atual || atual.sessaoId !== ses) {
    mapa[eventoId] = at;
    storage.gravar(K.atribuicao, mapa);
  }
}

function atribuicaoAtual(eventoId: string): Atribuicao {
  const ses = sessaoId();
  const a = (storage.ler<Record<string, Atribuicao>>(K.atribuicao) ?? {})[eventoId];
  return a && a.sessaoId === ses ? a : { origem: "direto", sessaoId: ses };
}

export function registrarCliqueInscrever(eventoId: string) {
  if (excluido(eventoId)) return;
  const a = atribuicaoAtual(eventoId);
  gravar({ tipo: "clique_inscrever", eventoId, origem: a.origem, secaoId: a.secaoId, campanhaId: a.campanhaId });
}

let ultimoInicio: { eventoId: string; em: number } | null = null;
/** Início do fluxo: só quando o formulário de inscrição é aberto. Preserva a origem até a conclusão. */
export function registrarInicioInscricao(eventoId: string) {
  if (ultimoInicio && ultimoInicio.eventoId === eventoId && Date.now() - ultimoInicio.em < 1500) return;
  ultimoInicio = { eventoId, em: Date.now() };
  if (excluido(eventoId)) return;
  const a = atribuicaoAtual(eventoId);
  const reg = gravar({ tipo: "inscricao_iniciada", eventoId, origem: a.origem, secaoId: a.secaoId, campanhaId: a.campanhaId });
  const fluxos = storage.ler<Record<string, { fluxoId: string } & Atribuicao>>(K.fluxos) ?? {};
  fluxos[eventoId] = { fluxoId: reg.id, ...a };
  storage.gravar(K.fluxos, fluxos);
}

/** Chamado pelo serviço de inscrições; id derivado da inscrição evita duplicidade. */
export function registrarConfirmacao(insc: Inscricao) {
  if (typeof window === "undefined") return;
  const tipo: TipoAnalytics = insc.cortesiaId
    ? "cortesia_resgatada"
    : insc.origem && insc.origem !== "plataforma" ? "inclusao_administrativa" : "inscricao_confirmada";
  const fluxos = storage.ler<Record<string, { fluxoId: string } & Atribuicao>>(K.fluxos) ?? {};
  const f = tipo === "inscricao_confirmada" ? fluxos[insc.eventoId] : undefined;
  if (f) { delete fluxos[insc.eventoId]; storage.gravar(K.fluxos, fluxos); }
  gravar({
    id: `conf-${insc.id}`, tipo, eventoId: insc.eventoId, inscricaoId: insc.id,
    origem: f?.origem ?? "direto", secaoId: f?.secaoId, campanhaId: f?.campanhaId, fluxoId: f?.fluxoId,
  });
}

// ===== Campanhas =====
export function listarCampanhas(): Campanha[] {
  return storage.ler<Campanha[]>(K.campanhas) ?? [];
}
export function criarCampanha(eventoId: string, nome: string, origem: OrigemCampanha): Campanha {
  const u = usuarioDaSessao();
  const ev = carregarBase().eventos.find((e) => e.id === eventoId);
  if (!u || !ev || !(u.perfil === "admin" || (u.perfil === "organizador" && u.organizacaoId === ev.organizacaoId))) {
    throw new Error("Você não pode criar campanhas para este evento.");
  }
  if (!nome.trim()) throw new Error("Informe o nome da campanha.");
  const c: Campanha = { id: rid("cmp").slice(0, 16), eventoId, nome: nome.trim().slice(0, 60), origem, criadoEm: new Date().toISOString() };
  storage.gravar(K.campanhas, [...listarCampanhas(), c]);
  return c;
}
export function linkCampanha(c: Campanha): string {
  const origem = typeof window !== "undefined" ? window.location.origin : "";
  return `${origem}/eventos/${c.eventoId}?cmp=${encodeURIComponent(c.id)}`;
}

// ===== Histórico fictício determinístico =====
function prng(semente: number) {
  let a = semente;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function semearHistorico() {
  if (typeof window === "undefined" || storage.ler<boolean>(K.semeado)) return;
  storage.gravar(K.semeado, true);
  const base = carregarBase();
  const rnd = prng(20261012);
  const eventos = base.eventos.filter((e) => e.status === "publicado");
  const camps: Campanha[] = eventos.slice(0, 2).map((e, i) => ({
    id: `cmp-demo-${i + 1}`, eventoId: e.id, nome: i === 0 ? "Instagram da organização" : "Grupo de WhatsApp",
    origem: i === 0 ? "instagram" : "whatsapp", criadoEm: new Date(Date.now() - 40 * 86400000).toISOString(),
  }));
  storage.gravar(K.campanhas, [...camps, ...listarCampanhas()]);
  const regs: RegistroAnalytics[] = [];
  let n = 0;
  const secaoDe = (o: OrigemAcesso) => (o === "destaques" ? "sec-destaques" : o === "regional" ? "sec-sudeste" : undefined);
  for (const e of eventos) {
    const peso = 0.5 + rnd();
    for (let d = 30; d >= 0; d--) {
      const diaBase = Date.now() - d * 86400000;
      const exib = Math.round((3 + rnd() * 8) * peso);
      for (let i = 0; i < exib; i++) {
        const origem: OrigemAcesso = rnd() < 0.5 ? "destaques" : rnd() < 0.6 ? "regional" : "busca";
        const vis = `vis-demo-${Math.floor(rnd() * 400)}`;
        const ses = `ses-demo-${n}`;
        const em = diaBase - Math.floor(rnd() * 80000000);
        const comum = { eventoId: e.id, visitanteId: vis, sessaoId: ses, origem, secaoId: secaoDe(origem), posicao: 1 + Math.floor(rnd() * 4) };
        regs.push({ id: `h-${n++}`, tipo: "exibicao", em, ...comum });
        if (rnd() < 0.12) {
          regs.push({ id: `h-${n++}`, tipo: "clique", em: em + 1000, ...comum });
          regs.push({ id: `h-${n++}`, tipo: "visita", em: em + 2000, ...comum });
          funil(comum, em + 3000);
        }
      }
      // Acessos diretos e por campanha (sem clique fictício)
      const diretos = Math.floor(rnd() * 3 * peso);
      for (let i = 0; i < diretos; i++) {
        const cmp = camps.find((c) => c.eventoId === e.id && rnd() < 0.5);
        const comum = { eventoId: e.id, visitanteId: `vis-demo-${Math.floor(rnd() * 400)}`, sessaoId: `ses-demo-${n}`, origem: (cmp ? "campanha" : "direto") as OrigemAcesso, campanhaId: cmp?.id };
        const em = diaBase - Math.floor(rnd() * 80000000);
        regs.push({ id: `h-${n++}`, tipo: "visita", em, ...comum });
        funil(comum, em + 1000);
      }
    }
  }
  function funil(comum: Omit<RegistroAnalytics, "id" | "tipo" | "em">, em: number) {
    if (rnd() > 0.35) return;
    regs.push({ id: `h-${n++}`, tipo: "clique_inscrever", em, ...comum });
    if (rnd() > 0.7) return;
    const fluxoId = `h-${n++}`;
    regs.push({ id: fluxoId, tipo: "inscricao_iniciada", em: em + 500, ...comum });
    if (rnd() < 0.55) regs.push({ id: `h-${n++}`, tipo: "inscricao_confirmada", em: em + 60000, fluxoId, ...comum });
  }
  if (eventos[0]) {
    regs.push({ id: `h-${n++}`, tipo: "cortesia_resgatada", eventoId: eventos[0].id, visitanteId: "vis-demo-c", sessaoId: "ses-demo-c", origem: "direto", em: Date.now() - 5 * 86400000 });
  }
  storage.gravar(K.registros, [...regs, ...(storage.ler<RegistroAnalytics[]>(K.registros) ?? [])].slice(-LIMITE));
}

/** Somente para testes: limpa o estado em memória de deduplicação. */
export function _reiniciarMemoria() {
  exibicoesVistas.clear(); ultimaVisita = null; ultimoInicio = null;
}
