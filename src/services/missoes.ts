// Escritas das missões pré-evento: o organizador cria, publica, avalia, destaca e encerra a
// campanha; o participante envia. Regras puras em src/lib/missoes.ts. A identidade e a gestão
// do evento são conferidas aqui (a API só repassa a pessoa da sessão).
import { ErroDominio, gerarId, mutarBase } from "@/services/db";
import { criarPublicacao, garantirForuns } from "@/services/comunidade";
import { silenciado } from "@/services/notificacoes";
import { gereEvento } from "@/lib/visao";
import {
  bloqueioEnvio, codigoConfere, congelarResultado, destinadaA, exercitoDaPessoa, LIMITE_TEXTO_ENTREGA,
  MAX_PONTOS_MISSAO, nomeExercito, normalizarCodigo, placarExercitos, situacaoMissao,
} from "@/lib/missoes";
import { formatarDataHoraBR } from "@/lib/domain/money";
import type { BaseDados, CampanhaMissoes, EntregaMissao, Evento, Missao, TipoEntregaMissao, Usuario } from "@/lib/domain/types";

const agoraIso = () => new Date().toISOString();
const IMAGEM_DATA_URL = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/;
const TAMANHO_MAX_IMAGEM = 3 * 1024 * 1024;

function notificar(b: BaseDados, usuarioId: string, titulo: string, corpo: string, link: string) {
  if (silenciado(b, usuarioId, "geral")) return;
  b.notificacoes.push({ id: gerarId("not"), usuarioId, titulo, corpo, link, lida: false, criadoEm: agoraIso() });
}

function eventoGerido(b: BaseDados, u: Usuario, eventoId: string): Evento {
  const ev = b.eventos.find((e) => e.id === eventoId);
  if (!ev || !gereEvento(u, ev)) throw new ErroDominio("sem_permissao", "Só a organização do evento pode gerenciar as missões.");
  return ev;
}

export function campanhaDe(b: BaseDados, eventoId: string): CampanhaMissoes | undefined {
  return b.campanhasMissoes.find((c) => c.eventoId === eventoId);
}

function exigirCampanhaAberta(b: BaseDados, eventoId: string) {
  if (campanhaDe(b, eventoId)?.encerradaEm) throw new ErroDominio("encerrada", "A campanha de missões deste evento já foi encerrada.");
}

/** Post na comunidade em nome de quem gere o evento: "Avisos oficiais" ou o fórum do exército. */
function postarNaComunidade(b: BaseDados, autor: Usuario, eventoId: string, publico: string, texto: string, imagemUrl?: string): boolean {
  garantirForuns(eventoId);
  const forum = publico === "todos"
    ? b.foruns.find((f) => f.id === `for-${eventoId}-avisos` && f.status === "ativo")
    : b.foruns.find((f) => f.eventoId === eventoId && f.publico === publico && f.status === "ativo");
  if (!forum) return false;
  criarPublicacao(autor, { forumId: forum.id, texto, imagens: imagemUrl ? [{ url: imagemUrl, alt: "Imagem da missão" }] : [], importante: true });
  return true;
}

// ---------- Organizador: missões ----------

export interface DadosMissao {
  id?: string | undefined;
  eventoId: string;
  titulo: string;
  descricao: string;
  /** data URL nova, URL já salva ou ausente. */
  imagem?: string | undefined;
  publico: string;
  tipoEntrega: TipoEntregaMissao;
  pontos: number;
  abreEm?: string | undefined;
  prazo: string;
  exigeAprovacao: boolean;
  /** Só para "codigo": a resposta (será normalizada). Vazio ao editar = mantém a atual. */
  codigoResposta?: string | undefined;
  metaPercentual?: number | undefined;
  metaBonus?: number | undefined;
}

export function salvarMissao(b: BaseDados, u: Usuario, d: DadosMissao): Missao {
  const ev = eventoGerido(b, u, d.eventoId);
  exigirCampanhaAberta(b, ev.id);
  const titulo = d.titulo.trim();
  const descricao = d.descricao.trim();
  if (titulo.length < 3 || titulo.length > 120) throw new ErroDominio("titulo", "Título: de 3 a 120 caracteres.");
  if (!descricao || descricao.length > 2000) throw new ErroDominio("descricao", "Escreva o briefing da missão (até 2000 caracteres).");
  if (d.publico !== "todos" && !ev.exercitos.some((x) => x.id === d.publico)) throw new ErroDominio("publico", "Escolha todos ou um exército do evento.");
  if (!Number.isInteger(d.pontos) || d.pontos < 0 || d.pontos > MAX_PONTOS_MISSAO) throw new ErroDominio("pontos", `Pontos: inteiro de 0 a ${MAX_PONTOS_MISSAO}.`);
  const prazo = Date.parse(d.prazo);
  if (Number.isNaN(prazo)) throw new ErroDominio("prazo", "Informe o prazo da missão.");
  if (d.abreEm && (Number.isNaN(Date.parse(d.abreEm)) || Date.parse(d.abreEm) >= prazo)) throw new ErroDominio("abreEm", "A abertura precisa ser antes do prazo.");
  if (prazo > Date.parse(ev.fimEm)) throw new ErroDominio("prazo", "O prazo não pode passar do fim do evento.");
  if (d.imagem && d.imagem.startsWith("data:")) {
    if (d.imagem.length > TAMANHO_MAX_IMAGEM || !IMAGEM_DATA_URL.test(d.imagem)) throw new ErroDominio("imagem", "Imagem inválida: JPG, PNG ou WebP até ~2 MB.");
  }
  const meta = d.metaPercentual || d.metaBonus;
  if (meta && (!Number.isInteger(d.metaPercentual) || d.metaPercentual! < 1 || d.metaPercentual! > 100 || !Number.isInteger(d.metaBonus) || d.metaBonus! < 1 || d.metaBonus! > MAX_PONTOS_MISSAO)) {
    throw new ErroDominio("meta", "Meta coletiva: percentual de 1 a 100 e bônus de 1 a 10000.");
  }

  const existente = d.id ? b.missoes.find((m) => m.id === d.id && m.eventoId === ev.id) : undefined;
  if (d.id && !existente) throw new ErroDominio("missao", "Missão não encontrada.");
  const temEntregas = !!existente && b.entregas.some((e) => e.missaoId === existente.id);
  if (existente && temEntregas && existente.tipoEntrega !== d.tipoEntrega) throw new ErroDominio("tipo", "Não dá para trocar o tipo de entrega depois que já há entregas.");
  let codigoResposta = existente?.codigoResposta;
  if (d.tipoEntrega === "codigo") {
    if (d.codigoResposta?.trim()) codigoResposta = normalizarCodigo(d.codigoResposta);
    if (!codigoResposta || codigoResposta.length < 3) throw new ErroDominio("codigo", "Defina o código secreto (ao menos 3 caracteres).");
  } else codigoResposta = undefined;

  const campos: Omit<Missao, "id" | "eventoId"> = {
    titulo, descricao,
    imagemUrl: d.imagem || undefined,
    publico: d.publico,
    tipoEntrega: d.tipoEntrega,
    // Código secreto é conferido na hora: nunca passa por aprovação.
    exigeAprovacao: d.tipoEntrega === "codigo" ? false : d.exigeAprovacao,
    pontos: d.pontos,
    abreEm: d.abreEm || undefined,
    prazo: new Date(prazo).toISOString(),
    codigoResposta,
    metaPercentual: meta ? d.metaPercentual : undefined,
    metaBonus: meta ? d.metaBonus : undefined,
    rascunho: existente ? existente.rascunho : true,
    anunciadaEm: existente?.anunciadaEm,
    criadoEm: existente?.criadoEm ?? agoraIso(),
  };
  if (existente) { Object.assign(existente, campos); return existente; }
  const nova: Missao = { id: gerarId("mis"), eventoId: ev.id, ...campos };
  b.missoes.push(nova);
  return nova;
}

/** Publica (sai do rascunho) e avisa os destinatários uma única vez. */
export function publicarMissao(b: BaseDados, u: Usuario, missaoId: string): Missao {
  const m = b.missoes.find((x) => x.id === missaoId);
  if (!m) throw new ErroDominio("missao", "Missão não encontrada.");
  const ev = eventoGerido(b, u, m.eventoId);
  exigirCampanhaAberta(b, ev.id);
  if (situacaoMissao({ ...m, rascunho: false }) === "encerrada") throw new ErroDominio("prazo", "O prazo desta missão já passou. Ajuste antes de publicar.");
  m.rascunho = false;
  if (m.anunciadaEm) return m;
  m.anunciadaEm = agoraIso();
  const quando = m.abreEm && Date.parse(m.abreEm) > Date.now() ? `Abre em ${formatarDataHoraBR(m.abreEm)}` : "Já está aberta";
  const texto = `🎯 Nova missão pré-evento: ${m.titulo}\n\n${m.descricao}\n\n${quando} · prazo ${formatarDataHoraBR(m.prazo)}${m.pontos ? ` · vale ${m.pontos} pontos para o seu exército` : ""}.\nEnvie em Minhas missões.`;
  const postou = postarNaComunidade(b, u, ev.id, m.publico, texto.slice(0, 2000), m.imagemUrl);
  if (!postou) {
    // Sem fórum do exército: avisa direto os inscritos destinatários.
    for (const i of b.inscricoes) {
      if (i.eventoId === ev.id && i.status === "confirmada" && destinadaA(m, i.exercitoId)) {
        notificar(b, i.usuarioId, "Nova missão pré-evento", `${m.titulo} — ${quando.toLowerCase()}.`, "/app/missoes");
      }
    }
  }
  return m;
}

export function excluirMissao(b: BaseDados, u: Usuario, missaoId: string): void {
  const m = b.missoes.find((x) => x.id === missaoId);
  if (!m) throw new ErroDominio("missao", "Missão não encontrada.");
  eventoGerido(b, u, m.eventoId);
  exigirCampanhaAberta(b, m.eventoId);
  if (b.entregas.some((e) => e.missaoId === m.id)) throw new ErroDominio("entregas", "Esta missão já tem entregas e não pode ser excluída.");
  b.missoes = b.missoes.filter((x) => x.id !== m.id);
}

// ---------- Participante: entrega ----------

export interface DadosEntrega {
  missaoId: string;
  texto?: string | undefined;
  /** Foto (data URL) para missões do tipo "imagem". */
  foto?: string | undefined;
  codigo?: string | undefined;
  permiteDestaque?: boolean | undefined;
}

export function enviarEntrega(b: BaseDados, u: Usuario, d: DadosEntrega): EntregaMissao {
  const m = b.missoes.find((x) => x.id === d.missaoId);
  if (!m) throw new ErroDominio("missao", "Missão não encontrada.");
  const exercitoId = exercitoDaPessoa(b, u.id, m.eventoId);
  if (m.rascunho || !destinadaA(m, exercitoId)) throw new ErroDominio("sem_permissao", "Esta missão não é destinada a você.");
  const existente = b.entregas.find((e) => e.missaoId === m.id && e.usuarioId === u.id);
  const bloqueio = bloqueioEnvio(m, existente, campanhaDe(b, m.eventoId));
  if (bloqueio) throw new ErroDominio("bloqueio", bloqueio);

  let conteudo: string | undefined;
  let anexoUrl: string | undefined;
  if (m.tipoEntrega === "texto") {
    conteudo = d.texto?.trim();
    if (!conteudo) throw new ErroDominio("conteudo", "Escreva a sua entrega.");
    if (conteudo.length > LIMITE_TEXTO_ENTREGA) throw new ErroDominio("conteudo", `Entrega: no máximo ${LIMITE_TEXTO_ENTREGA} caracteres.`);
  } else if (m.tipoEntrega === "imagem") {
    if (!d.foto || d.foto.length > TAMANHO_MAX_IMAGEM || !IMAGEM_DATA_URL.test(d.foto)) throw new ErroDominio("foto", "Envie a foto da missão (JPG, PNG ou WebP).");
    anexoUrl = d.foto;
    conteudo = d.texto?.trim().slice(0, 500) || undefined;
  } else if (m.tipoEntrega === "codigo") {
    if (!d.codigo?.trim()) throw new ErroDominio("codigo", "Digite o código.");
    if (!codigoConfere(m, d.codigo)) throw new ErroDominio("codigo_errado", "Código incorreto. Confira a pista e tente de novo.");
  }

  const aprovadaNaHora = m.tipoEntrega === "codigo" || !m.exigeAprovacao;
  const agora = agoraIso();
  const dados: Omit<EntregaMissao, "id" | "missaoId" | "usuarioId"> = {
    status: aprovadaNaHora ? "concluida" : "enviada",
    conteudo, anexoUrl, exercitoId, enviadoEm: agora,
    pontos: aprovadaNaHora ? m.pontos ?? 0 : undefined,
    avaliadoEm: aprovadaNaHora ? agora : undefined,
    avaliadoPor: aprovadaNaHora ? "sistema" : undefined,
    avaliacao: undefined,
    permiteDestaque: !!d.permiteDestaque,
  };
  if (existente) { Object.assign(existente, dados); return existente; }
  const nova: EntregaMissao = { id: gerarId("ent"), missaoId: m.id, usuarioId: u.id, ...dados };
  b.entregas.push(nova);
  return nova;
}

// ---------- Organizador: avaliação e destaque ----------

export type DecisaoEntrega = "aprovar" | "ajustes" | "recusar";

export function avaliarEntrega(b: BaseDados, u: Usuario, entregaId: string, decisao: DecisaoEntrega, comentario?: string): EntregaMissao {
  const e = b.entregas.find((x) => x.id === entregaId);
  const m = e && b.missoes.find((x) => x.id === e.missaoId);
  if (!e || !m) throw new ErroDominio("entrega", "Entrega não encontrada.");
  eventoGerido(b, u, m.eventoId);
  exigirCampanhaAberta(b, m.eventoId);
  if (e.status !== "enviada" && e.status !== "concluida" && e.status !== "recusada") throw new ErroDominio("status", "Esta entrega não está aguardando avaliação.");
  const texto = comentario?.trim().slice(0, 500) || undefined;
  if (decisao !== "aprovar" && !texto) throw new ErroDominio("comentario", "Explique ao participante o motivo.");
  e.status = decisao === "aprovar" ? "concluida" : decisao === "ajustes" ? "ajustes_solicitados" : "recusada";
  e.pontos = decisao === "aprovar" ? m.pontos ?? 0 : 0;
  e.avaliacao = texto;
  e.avaliadoPor = u.id;
  e.avaliadoEm = agoraIso();
  const titulos = { aprovar: "Missão aprovada", ajustes: "Ajustes na sua missão", recusar: "Missão recusada" } as const;
  const corpo = decisao === "aprovar"
    ? `"${m.titulo}" foi aprovada${m.pontos ? `: +${m.pontos} pontos para o seu exército` : ""}.`
    : `"${m.titulo}": ${texto}`;
  notificar(b, e.usuarioId, titulos[decisao], corpo, "/app/missoes");
  return e;
}

/** Publica a entrega (com autorização do participante) em "Avisos oficiais". Idempotente. */
export function destacarEntrega(b: BaseDados, u: Usuario, entregaId: string): EntregaMissao {
  const e = b.entregas.find((x) => x.id === entregaId);
  const m = e && b.missoes.find((x) => x.id === e.missaoId);
  if (!e || !m) throw new ErroDominio("entrega", "Entrega não encontrada.");
  const ev = eventoGerido(b, u, m.eventoId);
  if (e.destacadaEm) return e;
  if (!e.permiteDestaque) throw new ErroDominio("consentimento", "O participante não autorizou destacar esta entrega.");
  if (e.status !== "concluida") throw new ErroDominio("status", "Só entregas aprovadas podem ser destacadas.");
  if (!e.anexoUrl && !e.conteudo) throw new ErroDominio("conteudo", "Esta entrega não tem foto nem texto para destacar.");
  const autor = b.usuarios.find((x) => x.id === e.usuarioId);
  const nome = autor?.nomeExibicao?.trim() || autor?.nomeCompleto.split(" ")[0] || "Operador";
  const texto = `⭐ Destaque da missão "${m.titulo}": ${nome} (${nomeExercito(ev, e.exercitoId ?? "")})${e.conteudo ? `\n\n${e.conteudo}` : ""}`;
  if (!postarNaComunidade(b, u, ev.id, "todos", texto.slice(0, 2000), e.anexoUrl)) throw new ErroDominio("forum", "A comunidade do evento não está disponível.");
  e.destacadaEm = agoraIso();
  notificar(b, e.usuarioId, "Sua entrega foi destacada", `"${m.titulo}" está nos avisos da comunidade do evento.`, `/comunidade/${ev.id}`);
  return e;
}

// ---------- Campanha: prêmios e encerramento ----------

export function salvarPremios(b: BaseDados, u: Usuario, eventoId: string, premios: { colocacao: number; descricao: string }[]): CampanhaMissoes {
  const ev = eventoGerido(b, u, eventoId);
  exigirCampanhaAberta(b, ev.id);
  const limpos = premios
    .map((p) => ({ colocacao: p.colocacao, descricao: p.descricao.trim().slice(0, 300) }))
    .filter((p) => p.descricao);
  if (limpos.some((p) => !Number.isInteger(p.colocacao) || p.colocacao < 1 || p.colocacao > ev.exercitos.length)) {
    throw new ErroDominio("colocacao", `Colocação de 1 a ${ev.exercitos.length}.`);
  }
  if (new Set(limpos.map((p) => p.colocacao)).size !== limpos.length) throw new ErroDominio("colocacao", "Um prêmio por colocação.");
  let c = campanhaDe(b, ev.id);
  if (!c) { c = { eventoId: ev.id, premios: [], resultado: [], atualizadoEm: agoraIso() }; b.campanhasMissoes.push(c); }
  c.premios = limpos.sort((x, y) => x.colocacao - y.colocacao);
  c.atualizadoEm = agoraIso();
  return c;
}

/** Congela o placar, aplica os prêmios e anuncia o resultado. Depois disso nada muda. */
export function encerrarCampanha(b: BaseDados, u: Usuario, eventoId: string): CampanhaMissoes {
  const ev = eventoGerido(b, u, eventoId);
  let c = campanhaDe(b, ev.id);
  if (c?.encerradaEm) return c;
  const pendentes = b.entregas.filter((e) => e.status === "enviada" && b.missoes.some((m) => m.id === e.missaoId && m.eventoId === ev.id)).length;
  if (pendentes) throw new ErroDominio("pendentes", `Avalie as ${pendentes} entrega(s) em análise antes de encerrar.`);
  if (!c) { c = { eventoId: ev.id, premios: [], resultado: [], atualizadoEm: agoraIso() }; b.campanhasMissoes.push(c); }
  c.resultado = congelarResultado(placarExercitos(b, ev), c.premios);
  c.encerradaEm = agoraIso();
  c.encerradaPor = u.id;
  c.atualizadoEm = c.encerradaEm;
  const linhas = c.resultado.map((r) => `${r.colocacao}º ${nomeExercito(ev, r.exercitoId)} — ${r.total} pts${r.premio ? ` 🏆 ${r.premio}` : ""}`);
  postarNaComunidade(b, u, ev.id, "todos", `🏁 Resultado das missões pré-evento\n\n${linhas.join("\n")}\n\nOs prêmios valem no dia do evento.`.slice(0, 2000));
  return c;
}
