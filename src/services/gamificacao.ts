// Administração de insígnias, campanhas de recompensa e correções de participação.
// Critérios são estruturados (tipo + meta): nada de expressões ou código digitado em formulário.
import { ErroDominio, gerarId } from "@/services/db";
import { recalcularProgressao } from "@/services/progressao";
import type { BaseDados, CampanhaRecompensa, CriterioInsignia, TipoBeneficio, Usuario } from "@/lib/domain/types";

const TIPOS_CRITERIO = new Set<CriterioInsignia["tipo"]>(["operacoes", "estados", "modalidades", "missoes"]);

function auditar(base: BaseDados, autor: Usuario, acao: string, entidade: string, entidadeId: string, justificativa?: string) {
  base.auditoria.push({ id: gerarId("aud"), autorId: autor.id, acao, entidade, entidadeId, justificativa, criadoEm: new Date().toISOString() });
}

function exigirAdmin(u: Usuario) {
  if (u.perfil !== "admin") throw new ErroDominio("sem_permissao", "Apenas administradores podem fazer isso.");
}

export interface DadosInsignia {
  id?: string | undefined;
  nome: string;
  descricao: string;
  icone: string;
  criterio: CriterioInsignia;
  ativa: boolean;
}

export function salvarInsignia(base: BaseDados, u: Usuario, d: DadosInsignia): void {
  exigirAdmin(u);
  const nome = d.nome.trim();
  if (!nome || nome.length > 60) throw new ErroDominio("nome", "Informe um nome de até 60 caracteres.");
  if (!TIPOS_CRITERIO.has(d.criterio.tipo)) throw new ErroDominio("criterio", "Critério não suportado.");
  const meta = Math.floor(d.criterio.meta);
  if (!(meta >= 1 && meta <= 1000)) throw new ErroDominio("meta", "A meta deve estar entre 1 e 1000.");
  const icone = [...d.icone.trim()].slice(0, 2).join("") || "🎖️";
  const agora = new Date().toISOString();
  const existente = d.id ? base.insignias.find((i) => i.id === d.id) : undefined;
  if (existente) {
    const mudouRegra = existente.criterio.tipo !== d.criterio.tipo || existente.criterio.meta !== meta;
    Object.assign(existente, { nome, descricao: d.descricao.trim().slice(0, 300), icone, ativa: d.ativa, atualizadoEm: agora });
    if (mudouRegra) {
      // Nova versão: concessões antigas continuam valendo pela regra da época.
      existente.criterio = { tipo: d.criterio.tipo, meta };
      existente.versao += 1;
    }
    auditar(base, u, mudouRegra ? "insignia_nova_versao" : "insignia_editada", "insignia", existente.id);
  } else {
    const id = gerarId("ins");
    base.insignias.push({ id, nome, descricao: d.descricao.trim().slice(0, 300), icone, criterio: { tipo: d.criterio.tipo, meta }, ativa: d.ativa, versao: 1, criadoEm: agora, atualizadoEm: agora });
    auditar(base, u, "insignia_criada", "insignia", id);
  }
  recalcularProgressao(base);
}

export interface DadosCampanha {
  id?: string | undefined;
  nome: string;
  descricao: string;
  insigniaId: string;
  organizacaoId: string;
  tipo: TipoBeneficio;
  valor: number;
  eventosElegiveis: string[];
  tiposElegiveis: string[];
  maximo: number;
  limitePorParticipante: number;
  inicioEm: string;
  conquistarAte: string;
  resgatarAte: string;
  regras: string;
  aceitaAnteriores: boolean;
  ativa: boolean;
  autorizacao?: string | undefined;
}

export function podeGerirCampanha(u: Usuario, organizacaoId: string): boolean {
  return u.perfil === "admin" || (u.perfil === "organizador" && u.organizacaoId === organizacaoId);
}

export function salvarCampanha(base: BaseDados, u: Usuario, d: DadosCampanha): void {
  if (!podeGerirCampanha(u, d.organizacaoId)) throw new ErroDominio("sem_permissao", "Você só pode oferecer benefícios nos eventos da sua organização.");
  // A administração não cria obrigação para uma organização sem oferta autorizada registrada.
  const autorizacao = d.autorizacao?.trim();
  if (u.perfil === "admin" && u.organizacaoId !== d.organizacaoId && !autorizacao) {
    throw new ErroDominio("autorizacao", "Informe a referência da oferta autorizada pela organização responsável.");
  }
  const nome = d.nome.trim();
  if (!nome) throw new ErroDominio("nome", "Informe o nome da campanha.");
  if (!base.insignias.some((i) => i.id === d.insigniaId)) throw new ErroDominio("insignia", "Escolha a conquista necessária.");
  if (!d.eventosElegiveis.length) throw new ErroDominio("eventos", "Escolha ao menos um evento elegível.");
  for (const id of d.eventosElegiveis) {
    const e = base.eventos.find((x) => x.id === id);
    if (!e || e.organizacaoId !== d.organizacaoId) throw new ErroDominio("eventos", "Os eventos elegíveis precisam ser da organização responsável.");
  }
  const tiposValidos = new Set(base.eventos.filter((e) => d.eventosElegiveis.includes(e.id)).flatMap((e) => e.tipos.map((t) => t.id)));
  if (d.tiposElegiveis.some((t) => !tiposValidos.has(t))) throw new ErroDominio("tipos", "Tipo de ingresso inválido para os eventos escolhidos.");
  const valor = Math.floor(d.valor);
  if (d.tipo === "percentual" && !(valor >= 1 && valor <= 100)) throw new ErroDominio("valor", "O percentual deve estar entre 1 e 100.");
  if (d.tipo === "fixo" && !(valor >= 1)) throw new ErroDominio("valor", "Informe o valor do desconto.");
  if (!(d.maximo >= 1) || !(d.limitePorParticipante >= 1)) throw new ErroDominio("limites", "Quantidade e limite precisam ser maiores que zero.");
  const ini = new Date(d.inicioEm), conq = new Date(d.conquistarAte), resg = new Date(d.resgatarAte);
  if ([ini, conq, resg].some((x) => Number.isNaN(x.getTime()))) throw new ErroDominio("datas", "Datas inválidas.");
  if (conq < ini || resg < conq) throw new ErroDominio("datas", "O prazo de resgate precisa ser depois do prazo para conquistar, que vem depois do início.");

  const dados = {
    nome, descricao: d.descricao.trim().slice(0, 500), insigniaId: d.insigniaId, organizacaoId: d.organizacaoId, tipo: d.tipo,
    valor: d.tipo === "gratuito" ? 0 : valor, eventosElegiveis: [...d.eventosElegiveis], tiposElegiveis: [...d.tiposElegiveis],
    maximo: Math.floor(d.maximo), limitePorParticipante: Math.floor(d.limitePorParticipante),
    inicioEm: ini.toISOString(), conquistarAte: conq.toISOString(), resgatarAte: resg.toISOString(),
    regras: d.regras.trim().slice(0, 1000), aceitaAnteriores: d.aceitaAnteriores, ativa: d.ativa, autorizacao: autorizacao || undefined,
  };
  const existente = d.id ? base.campanhasRecompensa.find((c) => c.id === d.id) : undefined;
  if (d.id && !existente) throw new ErroDominio("campanha", "Campanha não encontrada.");
  if (existente) {
    if (!podeGerirCampanha(u, existente.organizacaoId)) throw new ErroDominio("sem_permissao", "Sem permissão para esta campanha.");
    // Vouchers já emitidos guardam as condições da época; a edição vale para os próximos.
    Object.assign(existente, dados, { versao: existente.versao + 1 });
    auditar(base, u, "campanha_editada", "campanha", existente.id, `versão ${existente.versao}`);
  } else {
    const c: CampanhaRecompensa = { id: gerarId("cmp"), versao: 1, criadoPor: u.id, criadoEm: new Date().toISOString(), ...dados };
    base.campanhasRecompensa.push(c);
    auditar(base, u, "campanha_criada", "campanha", c.id, autorizacao);
  }
  recalcularProgressao(base);
}

export function corrigirParticipacao(
  base: BaseDados, u: Usuario, d: { usuarioId: string; eventoId: string; tipo: "invalidar" | "validar"; justificativa: string },
): void {
  exigirAdmin(u);
  const just = d.justificativa.trim();
  if (just.length < 5) throw new ErroDominio("justificativa", "Descreva a justificativa da correção.");
  if (d.usuarioId === u.id) throw new ErroDominio("proprio", "Não é possível corrigir a própria participação.");
  const ins = base.inscricoes.find((i) => i.usuarioId === d.usuarioId && i.eventoId === d.eventoId && i.status === "confirmada");
  if (!ins) throw new ErroDominio("inscricao", "A pessoa não tem inscrição confirmada neste evento.");
  const id = gerarId("cor");
  base.correcoesParticipacao.push({ id, usuarioId: d.usuarioId, eventoId: d.eventoId, tipo: d.tipo, justificativa: just, autorId: u.id, criadoEm: new Date().toISOString() });
  auditar(base, u, `participacao_${d.tipo}`, "participacao", `${d.usuarioId}:${d.eventoId}`, just);
  recalcularProgressao(base);
}
