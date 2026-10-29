// Regras puras do editor de eventos em etapas: validação por etapa (Zod), revisão
// (erros que impedem publicar × avisos) e situação comercial de cada ingresso.
import { z } from "zod";
import type { Evento } from "@/lib/domain/types";
import { ehModalidade } from "@/lib/modalidades";
import { disponibilidadeTipo, type OcupacaoLote } from "@/lib/vendas";
import { validarParaPublicacao } from "@/services/organizador";
import { errosContatoEvento } from "@/lib/contatoEvento";
import { atividadeNoPeriodo, formatarNoFuso, formatarPeriodoNoFuso, instanteDaAtividade } from "@/lib/fusoHorario";
import { tr } from "@/i18n/lib/eventoEditor";
import { localeAtual } from "@/i18n/dicionario";

export const ETAPAS = [
  { id: "geral", get titulo() { return tr("informacoes_gerais"); } },
  { id: "local", get titulo() { return tr("data_e_localizacao"); } },
  { id: "imagem", get titulo() { return tr("banner_e_imagem"); } },
  { id: "exercitos", get titulo() { return tr("capacidade_e_exercitos"); } },
  { id: "ingressos", get titulo() { return tr("ingressos_e_lotes"); } },
  { id: "cronograma", get titulo() { return tr("cronograma_e_regras"); } },
  { id: "revisao", get titulo() { return tr("revisao_e_publicacao"); } },
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
        if (vazio(ev.nome)) erro(ctx, "ev-nome", tr("informe_o_nome_do_evento"));
        if (!ehModalidade(ev.modalidade)) erro(ctx, "ev-mod", tr("selecione_a_modalidade_principal"));
        if (vazio(ev.descricaoResumida)) erro(ctx, "ev-desc", tr("escreva_uma_descricao_resumida"));
        else if (ev.descricaoResumida.length > 200) erro(ctx, "ev-desc", tr("use_no_maximo_200_caracteres"));
        if (vazio(ev.enredo)) erro(ctx, "ev-enredo", tr("descreva_o_enredo_da_operacao"));
        for (const p of errosContatoEvento(ev)) erro(ctx, p.campo, p.mensagem);
        break;
      case "local":
        if (!dataValida(ev.inicioEm)) erro(ctx, "ev-ini", tr("informe_data_e_horario_de_inicio"));
        if (!dataValida(ev.fimEm)) erro(ctx, "ev-fim", tr("informe_data_e_horario_de_termino"));
        else if (new Date(ev.fimEm) <= new Date(ev.inicioEm)) erro(ctx, "ev-fim", tr("o_termino_deve_ser_depois_do"));
        // Só antes de publicar: operações já publicadas podem estar em andamento ou encerradas.
        if (ev.status === "rascunho" && dataValida(ev.inicioEm) && new Date(ev.inicioEm) <= new Date()) {
          erro(ctx, "ev-ini", tr("o_inicio_da_operacao_ja_passou"));
        }
        if (vazio(ev.local)) erro(ctx, "ev-local", tr("informe_o_nome_do_local_ou"));
        if (ev.cep && !/^\d{5}-?\d{3}$/.test(ev.cep.trim())) erro(ctx, "ev-cep", tr("cep_invalido_use_o_formato_00000"));
        if (vazio(ev.cidade)) erro(ctx, "ev-cid", tr("informe_a_cidade"));
        break;
      case "imagem":
        if (ev.imagem && vazio(ev.imagem.alt)) erro(ctx, "ev-img-alt", tr("descreva_a_imagem_no_texto_alternativo"));
        break;
      case "exercitos": {
        if (!(ev.capacidadeTotal >= 1)) erro(ctx, "ev-cap", tr("a_capacidade_total_deve_ser_de"));
        else if (ev.capacidadeTotal < oc.total) erro(ctx, "ev-cap", tr("ja_existem_total_inscricoes_confirmadas", { total: oc.total }));
        if (ev.exercitos.length === 0) erro(ctx, "ev-ex-add", tr("cadastre_ao_menos_um_exercito"));
        const vistos = new Set<string>();
        ev.exercitos.forEach((x) => {
          const nome = x.nome.trim().toLowerCase();
          if (!nome) erro(ctx, `ex-nome-${x.id}`, tr("de_um_nome_ao_exercito"));
          else if (vistos.has(nome)) erro(ctx, `ex-nome-${x.id}`, tr("ja_existe_um_exercito_chamado_valor", { valor: x.nome.trim() }));
          vistos.add(nome);
          const ocup = oc.porExercito[x.id] ?? 0;
          if (!(x.capacidade >= 1)) erro(ctx, `ex-cap-${x.id}`, tr("capacidade_minima_de_1_vaga"));
          else if (x.capacidade < ocup) erro(ctx, `ex-cap-${x.id}`, tr("este_exercito_ja_tem_ocup_inscritos", { ocup }));
        });
        const soma = ev.exercitos.reduce((t, x) => t + (x.capacidade || 0), 0);
        if (ev.exercitos.length && soma > 0 && soma < ev.capacidadeTotal) {
          erro(ctx, "ev-cap", tr("os_exercitos_somam_soma_vagas_menos", { soma, capacidadeTotal: ev.capacidadeTotal }));
        }
        break;
      }
      case "ingressos":
        if (ev.tipos.length === 0) erro(ctx, "ev-tp-add", tr("cadastre_ao_menos_um_tipo_de"));
        ev.tipos.forEach((t) => {
          if (vazio(t.nome)) erro(ctx, `tp-nome-${t.id}`, tr("de_um_nome_ao_ingresso"));
          if (!(t.precoBaseCentavos >= 0)) erro(ctx, `tp-preco-${t.id}`, tr("preco_invalido"));
          if (!(t.quantidadeMaxima >= 1)) erro(ctx, `tp-qt-${t.id}`, tr("quantidade_minima_de_1"));
        });
        ev.lotes.forEach((l) => {
          if (vazio(l.nome)) erro(ctx, `lt-nome-${l.id}`, tr("de_um_nome_ao_lote"));
          if (!dataValida(l.inicioVendas) || !dataValida(l.fimVendas) || new Date(l.fimVendas) <= new Date(l.inicioVendas)) {
            erro(ctx, `lt-fim-${l.id}`, tr("o_fim_das_vendas_deve_ser"));
          } else if (l.status !== "arquivado" && dataValida(ev.fimEm) && new Date(l.fimVendas) > new Date(ev.fimEm)) {
            erro(ctx, `lt-fim-${l.id}`, tr("as_vendas_devem_terminar_ate_o", { fimEm: formatarNoFuso(ev.fimEm, ev.fuso) }));
          }
          if (l.itens.length === 0) erro(ctx, `lt-nome-${l.id}`, tr("inclua_pelo_menos_um_tipo_de"));
          l.itens.forEach((it) => {
            if (!ev.tipos.some((t) => t.id === it.tipoId)) erro(ctx, `lt-nome-${l.id}`, tr("o_lote_inclui_um_ingresso_removido"));
            if (!(it.precoCentavos >= 0)) erro(ctx, `lt-pr-${l.id}-${it.tipoId}`, tr("preco_invalido"));
            if (!(it.quantidade >= 1)) erro(ctx, `lt-qt-${l.id}-${it.tipoId}`, tr("quantidade_minima_de_1"));
          });
        });
        break;
      case "cronograma": {
        if (ev.cronograma.length === 0) erro(ctx, "ev-at-add", tr("adicione_ao_menos_uma_atividade_ao"));
        ev.cronograma.forEach((a) => {
          if (vazio(a.titulo)) erro(ctx, `at-titulo-${a.id}`, tr("de_um_nome_a_atividade"));
          if (Number.isNaN(instanteDaAtividade(ev, a).getTime())) erro(ctx, `at-data-${a.id}`, tr("informe_data_e_horario"));
          else if (!atividadeNoPeriodo(ev, a)) {
            erro(ctx, `at-data-${a.id}`, tr("fora_do_periodo_da_operacao_inicioem", { inicioEm: formatarPeriodoNoFuso(ev.inicioEm, ev.fimEm, ev.fuso) }));
          }
        });
        if (ev.regras && vazio(ev.regras.titulo)) erro(ctx, "ev-regras-titulo", tr("informe_o_titulo_do_caderno_de"));
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
export function problemasDoServidor(mensagem: string, ev: Pick<Evento, "cronograma" | "lotes">): Problema[] {
  return mensagem
    .split("\n")
    .map((m) => m.trim())
    .filter(Boolean)
    .map((m) => {
      const titulo = /^Atividade "(.*)" fora do período/.exec(m)?.[1];
      const at = titulo !== undefined ? ev.cronograma.find((a) => a.titulo === titulo) : undefined;
      const nomeLote = /^Lote "(.*)": as vendas/.exec(m)?.[1];
      const lote = nomeLote !== undefined ? ev.lotes.find((l) => l.nome === nomeLote) : undefined;
      const campo = at ? `at-data-${at.id}` : lote ? `lt-fim-${lote.id}` : m.startsWith("O início da operação") ? "ev-ini" : "";
      return { etapa: etapaDaMensagem(m), campo, mensagem: m };
    });
}

/** Valida somente os campos necessários da etapa (usado por "Continuar"). */
export function validarEtapa(ev: Evento, etapa: number, oc: Ocupacao = SEM_OCUPACAO): Problema[] {
  const r = schemaEtapa(etapa, oc).safeParse(ev);
  return r.success ? [] : r.error.issues.map((i) => ({ etapa, campo: String(i.path[0] ?? ""), mensagem: i.message }));
}

export type SituacaoIngresso = "disponivel" | "agendado" | "sem_lote" | "encerrado" | "esgotado";
export const TEXTO_SITUACAO: Record<SituacaoIngresso, string> = {
  get disponivel() { return tr("disponivel_para_venda"); },
  get agendado() { return tr("vendas_agendadas"); },
  get sem_lote() { return tr("sem_lote_configurado"); },
  get encerrado() { return tr("lote_encerrado"); },
  get esgotado() { return tr("esgotado"); },
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
  if (!ev.imagemUrl) erros.push({ etapa: 2, campo: "ev-img-arquivo", mensagem: tr("adicione_a_imagem_principal_do_evento") });
  // Regras do servidor que ainda não foram cobertas pelas etapas.
  for (const m of validarParaPublicacao(ev)) {
    if (!erros.some((e) => e.mensagem === m) && !/obrigat|Cadastre|cronograma precisa|fora do período|as vendas devem terminar|início da operação já|imagem principal|modalidade/i.test(m)) {
      erros.push({ etapa: 6, campo: "", mensagem: m });
    }
  }
  const avisos: Problema[] = [];
  const tipos = ev.tipos.filter((t) => !t.arquivado);
  const situacoes = tipos.map((t) => ({ t, s: situacaoIngresso(ev, t.id, ocupacaoLote, agora) }));
  if (tipos.length && !situacoes.some(({ s }) => s === "disponivel" || s === "agendado")) {
    erros.push({ etapa: 4, campo: "ev-lt-add", mensagem: tr("nenhum_ingresso_tem_venda_aberta_ou") });
  }
  for (const { t, s } of situacoes) {
    if (s === "agendado") {
      const prox = ev.lotes
        .filter((l) => l.status === "ativo" && l.itens.some((it) => it.tipoId === t.id) && new Date(l.inicioVendas) > agora)
        .sort((a, b) => a.inicioVendas.localeCompare(b.inicioVendas))[0];
      avisos.push({ etapa: 4, campo: `tp-nome-${t.id}`, mensagem: tr("nome_vendas_comecam_em", { nome: t.nome || tr("ingresso"), data: prox ? new Date(prox.inicioVendas).toLocaleString(localeAtual(), { dateStyle: "short", timeStyle: "short" }) : tr("data_futura") }) });
    } else if (s !== "disponivel") {
      avisos.push({ etapa: 4, campo: `tp-nome-${t.id}`, mensagem: `${t.nome || tr("ingresso")}: ${TEXTO_SITUACAO[s].toLowerCase()}.` });
    }
  }
  if (!ev.regras) avisos.push({ etapa: 5, campo: "ev-regras-arquivo", mensagem: tr("o_evento_ficara_sem_caderno_de") });
  return { erros, avisos };
}
