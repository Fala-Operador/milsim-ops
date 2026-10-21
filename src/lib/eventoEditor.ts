// Regras puras do editor de eventos em etapas: validação por etapa (Zod), revisão
// (erros que impedem publicar × avisos) e situação comercial de cada ingresso.
import { z } from "zod";
import type { Evento } from "@/lib/domain/types";
import { ehModalidade } from "@/lib/modalidades";
import { disponibilidadeTipo, type OcupacaoLote } from "@/lib/vendas";
import { validarParaPublicacao } from "@/services/organizador";
import { errosContatoEvento } from "@/lib/contatoEvento";
import { atividadeNoPeriodo, formatarNoFuso, instanteDaAtividade } from "@/lib/fusoHorario";

export const ETAPAS = [
  { id: "geral", titulo: "Informações gerais" },
  { id: "local", titulo: "Data e localização" },
  { id: "imagem", titulo: "Banner e imagem" },
  { id: "exercitos", titulo: "Capacidade e exércitos" },
  { id: "ingressos", titulo: "Ingressos e lotes" },
  { id: "cronograma", titulo: "Cronograma e regras" },
  { id: "revisao", titulo: "Revisão e publicação" },
] as const;

/** Problema encontrado: `campo` é o id do elemento que recebe o foco. */
export interface Problema {
  etapa: number;
  campo: string;
  mensagem: string;
}

/** Ocupação atual (inscrições confirmadas) usada na edição de eventos com vendas. */
export interface Ocupacao {
  total: number;
  porExercito: Record<string, number>;
}
export const SEM_OCUPACAO: Ocupacao = { total: 0, porExercito: {} };

type Ctx = z.RefinementCtx;
const erro = (ctx: Ctx, campo: string, message: string) => ctx.addIssue({ code: z.ZodIssueCode.custom, path: [campo], message });
const vazio = (s: string | undefined) => !s || !s.trim();
const dataValida = (s: string) => !Number.isNaN(new Date(s).getTime());

const evento = z.custom<Evento>(() => true);

function schemaEtapa(i: number, oc: Ocupacao) {
  return evento.superRefine((ev, ctx) => {
    switch (ETAPAS[i]?.id) {
      case "geral":
        if (vazio(ev.nome)) erro(ctx, "ev-nome", "Informe o nome do evento.");
        if (!ehModalidade(ev.modalidade)) erro(ctx, "ev-mod", "Selecione a modalidade principal.");
        if (vazio(ev.descricaoResumida)) erro(ctx, "ev-desc", "Escreva uma descrição resumida.");
        else if (ev.descricaoResumida.length > 200) erro(ctx, "ev-desc", "Use no máximo 200 caracteres.");
        if (vazio(ev.enredo)) erro(ctx, "ev-enredo", "Descreva o enredo da operação.");
        for (const p of errosContatoEvento(ev)) erro(ctx, p.campo, p.mensagem);
        break;
      case "local":
        if (!dataValida(ev.inicioEm)) erro(ctx, "ev-ini", "Informe data e horário de início.");
        if (!dataValida(ev.fimEm)) erro(ctx, "ev-fim", "Informe data e horário de término.");
        else if (new Date(ev.fimEm) <= new Date(ev.inicioEm)) erro(ctx, "ev-fim", "O término deve ser depois do início.");
        if (vazio(ev.local)) erro(ctx, "ev-local", "Informe o nome do local ou campo.");
        if (ev.cep && !/^\d{5}-?\d{3}$/.test(ev.cep.trim())) erro(ctx, "ev-cep", "CEP inválido. Use o formato 00000-000.");
        if (vazio(ev.cidade)) erro(ctx, "ev-cid", "Informe a cidade.");
        break;
      case "imagem":
        if (ev.imagem && vazio(ev.imagem.alt)) erro(ctx, "ev-img-alt", "Descreva a imagem no texto alternativo.");
        break;
      case "exercitos": {
        if (!(ev.capacidadeTotal >= 1)) erro(ctx, "ev-cap", "A capacidade total deve ser de pelo menos 1 vaga.");
        else if (ev.capacidadeTotal < oc.total) erro(ctx, "ev-cap", `Já existem ${oc.total} inscrições confirmadas; a capacidade não pode ficar abaixo disso.`);
        if (ev.exercitos.length === 0) erro(ctx, "ev-ex-add", "Cadastre ao menos um exército.");
        const vistos = new Set<string>();
        ev.exercitos.forEach((x) => {
          const nome = x.nome.trim().toLowerCase();
          if (!nome) erro(ctx, `ex-nome-${x.id}`, "Dê um nome ao exército.");
          else if (vistos.has(nome)) erro(ctx, `ex-nome-${x.id}`, `Já existe um exército chamado "${x.nome.trim()}".`);
          vistos.add(nome);
          const ocup = oc.porExercito[x.id] ?? 0;
          if (!(x.capacidade >= 1)) erro(ctx, `ex-cap-${x.id}`, "Capacidade mínima de 1 vaga.");
          else if (x.capacidade < ocup) erro(ctx, `ex-cap-${x.id}`, `Este exército já tem ${ocup} inscritos.`);
        });
        const soma = ev.exercitos.reduce((t, x) => t + (x.capacidade || 0), 0);
        if (ev.exercitos.length && soma > 0 && soma < ev.capacidadeTotal) {
          erro(ctx, "ev-cap", `Os exércitos somam ${soma} vagas, menos que a capacidade total (${ev.capacidadeTotal}).`);
        }
        break;
      }
      case "ingressos":
        if (ev.tipos.length === 0) erro(ctx, "ev-tp-add", "Cadastre ao menos um tipo de ingresso.");
        ev.tipos.forEach((t) => {
          if (vazio(t.nome)) erro(ctx, `tp-nome-${t.id}`, "Dê um nome ao ingresso.");
          if (!(t.precoBaseCentavos >= 0)) erro(ctx, `tp-preco-${t.id}`, "Preço inválido.");
          if (!(t.quantidadeMaxima >= 1)) erro(ctx, `tp-qt-${t.id}`, "Quantidade mínima de 1.");
        });
        ev.lotes.forEach((l) => {
          if (vazio(l.nome)) erro(ctx, `lt-nome-${l.id}`, "Dê um nome ao lote.");
          if (!dataValida(l.inicioVendas) || !dataValida(l.fimVendas) || new Date(l.fimVendas) <= new Date(l.inicioVendas)) {
            erro(ctx, `lt-fim-${l.id}`, "O fim das vendas deve ser depois do início.");
          }
          if (l.itens.length === 0) erro(ctx, `lt-nome-${l.id}`, "Inclua pelo menos um tipo de ingresso no lote.");
          l.itens.forEach((it) => {
            if (!ev.tipos.some((t) => t.id === it.tipoId)) erro(ctx, `lt-nome-${l.id}`, "O lote inclui um ingresso removido.");
            if (!(it.precoCentavos >= 0)) erro(ctx, `lt-pr-${l.id}-${it.tipoId}`, "Preço inválido.");
            if (!(it.quantidade >= 1)) erro(ctx, `lt-qt-${l.id}-${it.tipoId}`, "Quantidade mínima de 1.");
          });
        });
        break;
      case "cronograma": {
        if (ev.cronograma.length === 0) erro(ctx, "ev-at-add", "Adicione ao menos uma atividade ao cronograma.");
        ev.cronograma.forEach((a) => {
          if (vazio(a.titulo)) erro(ctx, `at-titulo-${a.id}`, "Dê um nome à atividade.");
          if (Number.isNaN(instanteDaAtividade(ev, a).getTime())) erro(ctx, `at-data-${a.id}`, "Informe data e horário.");
          else if (!atividadeNoPeriodo(ev, a)) {
            erro(ctx, `at-data-${a.id}`, `Fora do período do evento (${formatarNoFuso(ev.inicioEm, ev.fuso)} a ${formatarNoFuso(ev.fimEm, ev.fuso)}).`);
          }
        });
        if (ev.regras && vazio(ev.regras.titulo)) erro(ctx, "ev-regras-titulo", "Informe o título do caderno de regras.");
        break;
      }
    }
  });
}

// Mensagens de validação do servidor (publicar/salvar) → etapa do editor. A ordem importa:
// "Atividade … fora do período" é do cronograma, não da etapa de datas.
const ETAPA_POR_MENSAGEM: [RegExp, number][] = [
  [/atividade|cronograma|regras/i, 5],
  [/ingresso|lote/i, 4],
  [/ex[eé]rcito|capacidade/i, 3],
  [/imagem|banner/i, 2],
  [/local|endere[cç]o|cidade|in[ií]cio|t[eé]rmino|data/i, 1],
  [/nome|modalidade|descri|enredo|whatsapp|grupo/i, 0],
];

/** Etapa a que pertence uma mensagem de erro; sem correspondência, a revisão. */
export function etapaDaMensagem(mensagem: string): number {
  return ETAPA_POR_MENSAGEM.find(([re]) => re.test(mensagem))?.[1] ?? ETAPAS.length - 1;
}

/**
 * Erro devolvido pelo servidor (uma mensagem por linha) como problemas por etapa. Atividades
 * citadas pelo nome ganham o campo de data, para o foco ir direto até ela.
 */
export function problemasDoServidor(mensagem: string, ev: Pick<Evento, "cronograma">): Problema[] {
  return mensagem
    .split("\n")
    .map((m) => m.trim())
    .filter(Boolean)
    .map((m) => {
      const titulo = /^Atividade "(.*)" fora do período/.exec(m)?.[1];
      const at = titulo !== undefined ? ev.cronograma.find((a) => a.titulo === titulo) : undefined;
      return { etapa: etapaDaMensagem(m), campo: at ? `at-data-${at.id}` : "", mensagem: m };
    });
}

/** Valida somente os campos necessários da etapa (usado por "Continuar"). */
export function validarEtapa(ev: Evento, etapa: number, oc: Ocupacao = SEM_OCUPACAO): Problema[] {
  const r = schemaEtapa(etapa, oc).safeParse(ev);
  return r.success ? [] : r.error.issues.map((i) => ({ etapa, campo: String(i.path[0] ?? ""), mensagem: i.message }));
}

export type SituacaoIngresso = "disponivel" | "agendado" | "sem_lote" | "encerrado" | "esgotado";
export const TEXTO_SITUACAO: Record<SituacaoIngresso, string> = {
  disponivel: "Disponível para venda",
  agendado: "Vendas agendadas",
  sem_lote: "Sem lote configurado",
  encerrado: "Lote encerrado",
  esgotado: "Esgotado",
};

export function situacaoIngresso(ev: Evento, tipoId: string, ocupacao: OcupacaoLote = () => 0, agora = new Date()): SituacaoIngresso {
  const d = disponibilidadeTipo(ev, tipoId, ocupacao, agora);
  if (d.disponivel) return "disponivel";
  if (d.motivo === "agendado") return "agendado";
  if (d.motivo === "nao_configurado") return "sem_lote";
  if (d.motivo === "esgotado" || d.motivo === "tipo_esgotado") return "esgotado";
  return "encerrado";
}

/** Revisão completa antes de publicar/salvar: erros impedem; avisos apenas informam. */
export function revisarEvento(ev: Evento, oc: Ocupacao = SEM_OCUPACAO, agora = new Date(), ocupacaoLote?: OcupacaoLote) {
  const erros: Problema[] = [];
  for (let i = 0; i < ETAPAS.length - 1; i++) erros.push(...validarEtapa(ev, i, oc));
  if (!ev.imagemUrl) erros.push({ etapa: 2, campo: "ev-img-arquivo", mensagem: "Adicione a imagem principal do evento." });
  // Regras do servidor que ainda não foram cobertas pelas etapas.
  for (const m of validarParaPublicacao(ev)) {
    if (!erros.some((e) => e.mensagem === m) && !/obrigat|Cadastre|cronograma precisa|fora do período|imagem principal|modalidade/i.test(m)) {
      erros.push({ etapa: 6, campo: "", mensagem: m });
    }
  }
  const avisos: Problema[] = [];
  const tipos = ev.tipos.filter((t) => !t.arquivado);
  const situacoes = tipos.map((t) => ({ t, s: situacaoIngresso(ev, t.id, ocupacaoLote, agora) }));
  if (tipos.length && !situacoes.some(({ s }) => s === "disponivel" || s === "agendado")) {
    erros.push({ etapa: 4, campo: "ev-lt-add", mensagem: "Nenhum ingresso tem venda aberta ou agendada. Crie um lote ativo com período de vendas válido." });
  }
  for (const { t, s } of situacoes) {
    if (s === "agendado") {
      const prox = ev.lotes
        .filter((l) => l.status === "ativo" && l.itens.some((it) => it.tipoId === t.id) && new Date(l.inicioVendas) > agora)
        .sort((a, b) => a.inicioVendas.localeCompare(b.inicioVendas))[0];
      avisos.push({ etapa: 4, campo: `tp-nome-${t.id}`, mensagem: `${t.nome || "Ingresso"}: vendas começam em ${prox ? new Date(prox.inicioVendas).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "data futura"}.` });
    } else if (s !== "disponivel") {
      avisos.push({ etapa: 4, campo: `tp-nome-${t.id}`, mensagem: `${t.nome || "Ingresso"}: ${TEXTO_SITUACAO[s].toLowerCase()}.` });
    }
  }
  if (!ev.regras) avisos.push({ etapa: 5, campo: "ev-regras-arquivo", mensagem: "O evento ficará sem caderno de regras." });
  return { erros, avisos };
}
