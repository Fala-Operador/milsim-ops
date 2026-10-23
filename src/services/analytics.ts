// AnalyticsService: único ponto de coleta das métricas de evento (no navegador).
// Antes da produção: definir base legal, retenção e consentimento.
// Registra apenas ids aleatórios; nunca nome, e-mail, CPF, telefone, endereço, exército ou conteúdo digitado.
// Os registros são enviados em lote ao servidor (src/api/analytics.functions.ts), que
// revalida campos, campanhas e exclusões antes de gravar em analytics_registros.
import { storage } from "@/lib/storage";
import { carregarBase } from "@/services/db";
import { usuarioIdDaVisao } from "@/api/cliente";
import type { Inscricao } from "@/lib/domain/types";
import type { Campanha, OrigemAcesso, RegistroAnalytics, TipoAnalytics } from "@/lib/analytics";

const K = {
  visitante: "analytics-visitante",
  sessao: "analytics-sessao",
  pendente: "analytics-clique-pendente",
  atribuicao: "analytics-atribuicao",
  fluxos: "analytics-fluxos-abertos",
};
const SESSAO_MS = 30 * 60000;
const ESPERA_ENVIO_MS = 1500;
const LOTE_MAXIMO = 50;

const rid = (p: string) => `${p}-${crypto.randomUUID?.() ?? Math.random().toString(36).slice(2) + Date.now().toString(36)}`;

interface Atribuicao { origem: OrigemAcesso; secaoId?: string | undefined; posicao?: number | undefined; campanhaId?: string | undefined; sessaoId: string }

// ===== Envio em lote =====
type Envio = (registros: RegistroAnalytics[]) => Promise<unknown>;
let envio: Envio | null = null;
let fila: RegistroAnalytics[] = [];
let temporizador: ReturnType<typeof setTimeout> | null = null;
/** Registros desta sessão do navegador (deduplicação e testes). */
const daSessao: RegistroAnalytics[] = [];

/** Registrado pela aplicação no navegador; sem destino (testes/SSR), os registros ficam só na memória. */
export function definirEnvioAnalytics(fn: Envio | null): void {
  envio = fn;
}

function agendarEnvio() {
  if (!envio || temporizador) return;
  temporizador = setTimeout(() => {
    temporizador = null;
    const lote = fila.splice(0, LOTE_MAXIMO);
    if (lote.length === 0 || !envio) return;
    envio(lote).catch(() => {
      fila = [...lote, ...fila].slice(-500); // tenta de novo no próximo registro
    });
    if (fila.length) agendarEnvio();
  }, ESPERA_ENVIO_MS);
}

export function registrosDaSessao(): RegistroAnalytics[] {
  return daSessao;
}

// ===== Identificadores anônimos =====
function visitanteId(): string {
  let v = storage.ler<string>(K.visitante);
  if (!v) { v = rid("vis"); storage.gravar(K.visitante, v); }
  return v;
}
/** Id anônimo do visitante, também usado como semente do rodízio dos impulsos comprados. */
export const idDoVisitante = (): string => visitanteId();
function sessaoId(): string {
  const agora = Date.now();
  const s = storage.ler<{ id: string; ultimo: number }>(K.sessao);
  const id = s && agora - s.ultimo < SESSAO_MS ? s.id : rid("ses");
  storage.gravar(K.sessao, { id, ultimo: agora });
  return id;
}

/** Admin autenticado e organizador nos próprios eventos não entram na coleta (o servidor reaplica). */
function excluido(eventoId: string): boolean {
  const id = usuarioIdDaVisao();
  if (!id) return false;
  const base = carregarBase();
  const u = base.usuarios.find((x) => x.id === id);
  if (!u) return false;
  if (u.perfil === "admin") return true;
  if (u.perfil === "organizador") {
    const ev = base.eventos.find((e) => e.id === eventoId);
    return !!ev && ev.organizacaoId === u.organizacaoId;
  }
  return false;
}

function gravar(r: Omit<RegistroAnalytics, "id" | "visitanteId" | "sessaoId" | "em"> & { id?: string }): RegistroAnalytics {
  const reg: RegistroAnalytics = { id: r.id ?? rid("an"), visitanteId: visitanteId(), sessaoId: sessaoId(), em: Date.now(), ...r };
  if (!daSessao.some((x) => x.id === reg.id)) {
    daSessao.push(reg);
    fila.push(reg);
    agendarEnvio();
  }
  return reg;
}

// ===== Coleta =====
const exibicoesVistas = new Set<string>();
/** Chamado após 50% do card visível por 1s; uma vez por card, posição e visualização da página. */
export function registrarExibicao(p: { eventoId: string; origem: OrigemAcesso; secaoId?: string | undefined; posicao: number; visualizacaoId: string; campanhaId?: string | undefined }) {
  const chave = `${p.visualizacaoId}:${p.secaoId ?? ""}:${p.eventoId}:${p.posicao}`;
  if (exibicoesVistas.has(chave) || excluido(p.eventoId)) return;
  exibicoesVistas.add(chave);
  gravar({ tipo: "exibicao", eventoId: p.eventoId, origem: p.origem, secaoId: p.secaoId, posicao: p.posicao, campanhaId: p.campanhaId });
}

/** `campanhaId` = impulsionamento do card clicado; a visita seguinte herda a atribuição. */
export function registrarClique(p: { eventoId: string; origem: OrigemAcesso; secaoId?: string | undefined; posicao?: number | undefined; campanhaId?: string | undefined }) {
  if (excluido(p.eventoId)) return;
  gravar({ tipo: "clique", ...p });
  storage.gravar(K.pendente, { ...p, em: Date.now() });
}

let ultimaVisita: { eventoId: string; em: number } | null = null;
/**
 * Visita: chamada quando a página do evento carrega com sucesso.
 * Ignora a segunda execução do Strict Mode/re-render (mesmo evento em < 1,5s); recarregar conta nova visita.
 * `campanhaId` vem apenas do parâmetro permitido `cmp` — nunca a URL completa. O servidor
 * descarta campanhas que não pertencem ao evento.
 */
export function registrarVisita(eventoId: string, campanhaParam?: string | null) {
  if (ultimaVisita && ultimaVisita.eventoId === eventoId && Date.now() - ultimaVisita.em < 1500) return;
  ultimaVisita = { eventoId, em: Date.now() };
  if (excluido(eventoId)) return;
  const ses = sessaoId();
  const campanhaId = campanhaParam && /^[\w-]{1,40}$/.test(campanhaParam) ? campanhaParam : undefined;
  const pend = storage.ler<{ eventoId: string; origem: OrigemAcesso; secaoId?: string; posicao?: number; campanhaId?: string; em: number }>(K.pendente);
  let at: Atribuicao;
  if (campanhaId) at = { origem: "campanha", campanhaId, sessaoId: ses };
  else if (pend && pend.eventoId === eventoId && Date.now() - pend.em < 60000) at = { origem: pend.origem, secaoId: pend.secaoId, posicao: pend.posicao, campanhaId: pend.campanhaId, sessaoId: ses };
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

/** Chamado após a confirmação da inscrição; id derivado da inscrição evita duplicidade. */
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
export function linkCampanha(c: Campanha): string {
  const origem = typeof window !== "undefined" ? window.location.origin : "";
  return `${origem}/eventos/${c.eventoId}?cmp=${encodeURIComponent(c.id)}`;
}

/** Somente para testes: limpa o estado em memória de deduplicação. */
export function _reiniciarMemoria() {
  exibicoesVistas.clear(); ultimaVisita = null; ultimoInicio = null;
  daSessao.length = 0; fila = [];
}
