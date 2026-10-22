// Regras puras dos impulsos comprados pelas organizações: tipos à venda (preço, validade),
// estado exibido do impulso, quando ele pode ser usado e o período da campanha que ele gera.
// O impulso usado vira uma campanha de src/lib/impulsionamento.ts (mesma exibição e ordem).
// Não há agendador: validade e prazo do pagamento são recalculados a cada carregamento.
import type { BaseDados, Evento, ImpulsoComprado, PlanoImpulso, PlanoImpulsoId, Usuario } from "@/lib/domain/types";
import { POSICAO_LISTAGEM } from "@/lib/domain/types";
import { NACIONAL } from "@/lib/divulgacao";
import { secoesCompativeis } from "@/lib/impulsionamento";

const HORA = 3_600_000;
const DIA = 24 * HORA;
const ms = (iso: string) => new Date(iso).getTime();

/** Tipos de impulso, na ordem de exibição. */
export const TIPOS_IMPULSO: { id: PlanoImpulsoId; duracaoHoras: number; rotulo: string }[] = [
  { id: "24h", duracaoHoras: 24, rotulo: "Impulso de 24h" },
  { id: "3d", duracaoHoras: 3 * 24, rotulo: "Impulso de 3 dias" },
  { id: "5d", duracaoHoras: 5 * 24, rotulo: "Impulso de 5 dias" },
  { id: "7d", duracaoHoras: 7 * 24, rotulo: "Impulso de 7 dias" },
  { id: "15d", duracaoHoras: 15 * 24, rotulo: "Impulso de 15 dias" },
  { id: "30d", duracaoHoras: 30 * 24, rotulo: "Impulso de 30 dias" },
];
export const IDS_PLANO_IMPULSO = TIPOS_IMPULSO.map((t) => t.id) as [PlanoImpulsoId, ...PlanoImpulsoId[]];

/** Validade padrão: dias, a partir do pagamento, para usar o impulso. */
export const VALIDADE_PADRAO_DIAS = 30;
export const VALIDADE_MAXIMA_DIAS = 365;
export const PRECO_MAXIMO_CENTAVOS = 1_000_000;

/** Preços iniciais (R$), usados enquanto a administração não grava o tipo. */
const PRECO_PADRAO: Record<PlanoImpulsoId, number> = { "24h": 990, "3d": 2490, "5d": 3490, "7d": 4490, "15d": 8490, "30d": 14990 };

/** Imagem padrão de cada tipo (arquivos em public/impulsos, gerados por scripts/imagens-impulsos.py). */
export const imagemPadraoImpulso = (id: PlanoImpulsoId) => `/impulsos/${id}.jpg`;

/** Imagem enviada pela administração (data URL, trocada pela URL do Storage ao gravar), https ou uma das padrão. */
export function imagemPlanoValida(url: string): boolean {
  return /^data:image\/(jpeg|png|webp);base64,/.test(url) || /^https:\/\/\S+$/.test(url) || /^\/impulsos\/[\w-]+\.(jpg|png)$/.test(url);
}

/**
 * URL absoluta para o Stripe (que só aceita https); caminhos do site ganham a origem. Atrás do
 * proxy (Cloudflare/Dokploy) o servidor pode ver a requisição como http: fora do localhost a
 * origem é tratada como https, que é como o site é servido ao público.
 */
export function imagemAbsoluta(url: string, origem: string): string | undefined {
  const publica = /^http:\/\/(?!localhost[:/]|localhost$|127\.|\[::1\])/.test(origem) ? origem.replace(/^http:/, "https:") : origem;
  const abs = url.startsWith("/") ? `${publica}${url}` : url;
  return /^https:\/\//.test(abs) ? abs : undefined;
}

/** Id fixo do produto no Stripe: repetir a sincronização nunca cria produto duplicado. */
export const produtoStripeDoPlano = (id: PlanoImpulsoId) => `milsim_impulso_${id}`;

/** Preço guardado no Stripe ainda é o atual do tipo (sincronizado depois da última alteração). */
export const precoStripeEmDia = (p: Pick<PlanoImpulso, "stripePrecoId" | "sincronizadoEm" | "atualizadoEm">) =>
  !!p.stripePrecoId && !!p.sincronizadoEm && p.sincronizadoEm >= p.atualizadoEm;

/** Prazo para pagar no Stripe; depois disso a compra aguardando pagamento é descartada. */
export const PRAZO_PAGAMENTO_MIN = 60;

export interface PlanoExibido extends PlanoImpulso {
  duracaoHoras: number;
  rotulo: string;
}

/** Os seis tipos com o preço e a validade em vigor (gravados pela administração ou padrão). */
export function planosDeImpulso(base: Pick<BaseDados, "planosImpulso">): PlanoExibido[] {
  return TIPOS_IMPULSO.map((t) => {
    const salvo = (base.planosImpulso ?? []).find((p) => p.id === t.id);
    return {
      id: t.id, duracaoHoras: t.duracaoHoras, rotulo: t.rotulo,
      precoCentavos: salvo?.precoCentavos ?? PRECO_PADRAO[t.id],
      validadeDias: salvo?.validadeDias ?? VALIDADE_PADRAO_DIAS,
      ativo: salvo?.ativo ?? true,
      imagemUrl: salvo?.imagemUrl || imagemPadraoImpulso(t.id),
      stripeProdutoId: salvo?.stripeProdutoId,
      stripePrecoId: salvo?.stripePrecoId,
      sincronizadoEm: salvo?.sincronizadoEm,
      atualizadoEm: salvo?.atualizadoEm ?? "",
      atualizadoPor: salvo?.atualizadoPor ?? "",
    };
  });
}

export const rotuloDuracao = (horas: number) => (horas === 24 ? "24h" : `${Math.round(horas / 24)} dias`);

/** Erro ao salvar um tipo (preço e validade); "" quando ok. */
export function erroPlano(p: Pick<PlanoImpulso, "precoCentavos" | "validadeDias">): string {
  if (!Number.isInteger(p.precoCentavos) || p.precoCentavos < 0 || p.precoCentavos > PRECO_MAXIMO_CENTAVOS) {
    return "O preço deve ficar entre R$ 0,00 e R$ 10.000,00.";
  }
  if (!Number.isInteger(p.validadeDias) || p.validadeDias < 1 || p.validadeDias > VALIDADE_MAXIMA_DIAS) {
    return `A validade deve ficar entre 1 e ${VALIDADE_MAXIMA_DIAS} dias.`;
  }
  return "";
}

/** Prazo para usar, a partir do pagamento. */
export const expiracaoDoImpulso = (pagoEm: Date, validadeDias: number) => new Date(pagoEm.getTime() + validadeDias * DIA);

// ===== Estado =====
export type StatusExibidoImpulso = "aguardando_pagamento" | "processando" | "disponivel" | "usado" | "expirado" | "cancelado" | "reembolsado";

export const ROTULO_STATUS_IMPULSO: Record<StatusExibidoImpulso, string> = {
  aguardando_pagamento: "Aguardando pagamento",
  processando: "Pagamento em processamento",
  disponivel: "Disponível",
  usado: "Usado",
  expirado: "Expirado",
  cancelado: "Cancelado",
  reembolsado: "Reembolsado",
};

/** Compra aguardando pagamento passou do prazo do checkout (o Stripe expira a sessão). */
export const pagamentoVencido = (i: ImpulsoComprado, agora: Date) =>
  i.status === "aguardando_pagamento" && ms(i.criadoEm) + PRAZO_PAGAMENTO_MIN * 60_000 <= agora.getTime();

export function statusDoImpulso(i: ImpulsoComprado, agora: Date): StatusExibidoImpulso {
  if (pagamentoVencido(i, agora)) return "cancelado";
  if (i.status === "disponivel" && i.expiraEm && ms(i.expiraEm) <= agora.getTime()) return "expirado";
  return i.status;
}

/** Quem pode comprar e usar impulsos da organização: organizador ativo dela. */
export function gereImpulsos(usuario: Usuario | null, organizacaoId: string): boolean {
  return !!usuario?.ativo && usuario.perfil === "organizador" && usuario.organizacaoId === organizacaoId;
}

/** Impulsos da organização, mais recentes primeiro, sem as compras abandonadas. */
export function impulsosDaOrganizacao(base: BaseDados, organizacaoId: string, agora: Date): ImpulsoComprado[] {
  return base.impulsosComprados
    .filter((i) => i.organizacaoId === organizacaoId)
    .filter((i) => !(i.status === "cancelado" && !i.pagoEm) && !pagamentoVencido(i, agora))
    .sort((a, b) => b.criadoEm.localeCompare(a.criadoEm));
}

/** Eventos da organização que podem receber um impulso agora (publicados e não encerrados). */
export function eventosImpulsionaveis(base: BaseDados, organizacaoId: string, agora: Date): Evento[] {
  return base.eventos
    .filter((e) => e.organizacaoId === organizacaoId && e.status === "publicado" && ms(e.fimEm) > agora.getTime())
    .sort((a, b) => a.inicioEm.localeCompare(b.inicioEm));
}

// ===== Uso =====
export interface PeriodoImpulso {
  inicioEm: string;
  fimEm: string;
  /** O impulso começa depois de outro impulso do mesmo evento ainda em vigor. */
  enfileirado: boolean;
  /** O evento termina antes do fim do impulso: o tempo que sobra é perdido. */
  cortado: boolean;
}

/**
 * Período da campanha gerada pelo impulso: começa agora ou, se o evento já tem um impulso
 * comprado em vigor ou agendado, logo depois do último; termina na duração do impulso ou no
 * fim do evento, o que vier primeiro.
 */
export function periodoDoImpulso(base: BaseDados, evento: Evento, duracaoHoras: number, agora: Date): PeriodoImpulso {
  const ultimoFim = base.impulsionamentos
    .filter((c) => c.eventoId === evento.id && c.impulsoId && c.status !== "encerrado")
    .reduce((m, c) => Math.max(m, ms(c.fimEm)), 0);
  const inicio = Math.max(agora.getTime(), ultimoFim);
  const fimDesejado = inicio + duracaoHoras * HORA;
  const fim = Math.min(fimDesejado, ms(evento.fimEm));
  return {
    inicioEm: new Date(inicio).toISOString(),
    fimEm: new Date(fim).toISOString(),
    enfileirado: inicio > agora.getTime(),
    cortado: fim < fimDesejado,
  };
}

/** Motivos que impedem usar o impulso neste evento (lista vazia = pode usar). */
export function pendenciasUso(base: BaseDados, i: ImpulsoComprado, evento: Evento | undefined, agora: Date): string[] {
  const st = statusDoImpulso(i, agora);
  if (st === "expirado") return ["Este impulso expirou e não pode mais ser usado."];
  if (st !== "disponivel") return ["Este impulso não está disponível para uso."];
  if (!evento || evento.organizacaoId !== i.organizacaoId) return ["Selecione uma operação da sua organização."];
  const erros: string[] = [];
  if (evento.status !== "publicado") erros.push("A operação precisa estar publicada.");
  if (ms(evento.fimEm) <= agora.getTime()) erros.push("A operação já terminou.");
  else if (ms(periodoDoImpulso(base, evento, i.duracaoHoras, agora).inicioEm) >= ms(evento.fimEm)) {
    erros.push("A operação termina antes de os impulsos já agendados acabarem.");
  }
  if (!evento.imagemUrl) erros.push("A operação precisa de uma imagem para aparecer em destaque.");
  return erros;
}

/** Onde o impulso aparece: seções de destaque da página inicial e topo da listagem, em todo o Brasil. */
export function posicoesDoImpulso(base: BaseDados): string[] {
  return [...secoesCompativeis(base).filter((s) => s.tipo === "destaques").map((s) => s.id), POSICAO_LISTAGEM];
}

export const ABRANGENCIA_IMPULSO = NACIONAL;
