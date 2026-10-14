// Serviços da Central de Suporte (executados no servidor, dentro de mutar()).
// Toda operação revalida o acesso; ids do navegador (clienteId) tornam reenvios idempotentes.
import { mutarBase, ErroDominio, gerarId } from "./db";
import { silenciado } from "./notificacoes";
import {
  podeAtender, podeVer, protocolo, encaminhamentos, linkSuporte, canalDe, statusAposMensagem, transicao, responsavelId, registrarLeitura, LIMITE_MENSAGEM, CATEGORIAS_SUPORTE,
  type AcaoStatus,
} from "@/lib/suporte";
import type { AnexoChamado, AnexoCompartilhado, BaseDados, Chamado, MensagemChamado, StatusChamado, Usuario } from "@/lib/domain/types";

const agora = () => new Date().toISOString();
const ID_CLIENTE = /^[a-z0-9-]{8,64}$/i;

export const idDoChamado = (clienteId: string) => `cha-${clienteId.replace(/[^a-z0-9]/gi, "").slice(0, 24)}`;

function exigirIdCliente(id: string) {
  if (!ID_CLIENTE.test(id)) throw new ErroDominio("cliente", "Identificador inválido.");
}

export function obterChamado(b: BaseDados, u: Usuario, id: string): Chamado {
  const c = b.chamados.find((x) => x.id === id);
  // Mesmo erro para inexistente e sem acesso: não revela que o chamado existe.
  if (!c || !podeVer(b, u, c)) throw new ErroDominio("chamado", "Chamado não encontrado.");
  return c;
}

/** Link da notificação abre o chamado na área certa para cada pessoa (helper compartilhado). */
export function linkDoChamado(b: BaseDados, usuarioId: string, c: Chamado, encaminhamentoId?: string): string {
  return linkSuporte(b, b.usuarios.find((x) => x.id === usuarioId), c, encaminhamentoId);
}

function notificar(b: BaseDados, usuarioIds: Iterable<string>, autorId: string, titulo: string, corpo: string, chamadoId: string, encaminhamentoId?: string) {
  const c = b.chamados.find((x) => x.id === chamadoId)!;
  for (const id of new Set(usuarioIds)) {
    if (id === autorId || silenciado(b, id, "geral")) continue;
    const link = linkDoChamado(b, id, c, encaminhamentoId);
    b.notificacoes.push({ id: gerarId("not"), usuarioId: id, titulo, corpo, link, lida: false, criadoEm: agora() });
  }
}

/** Todo atendimento é da administração. */
function equipe(b: BaseDados, _c?: Chamado): string[] {
  return b.usuarios.filter((u) => u.ativo && u.perfil === "admin").map((u) => u.id);
}
const admins = (b: BaseDados, c: Chamado) => { const r = responsavelId(c); return r ? [r] : equipe(b, c); };
const organizadores = (b: BaseDados, organizacaoId: string) =>
  b.usuarios.filter((u) => u.ativo && u.perfil === "organizador" && u.organizacaoId === organizacaoId).map((u) => u.id);

function historico(c: Chamado, autorId: string, corpo: string, acao: MensagemChamado["acao"], extra: Partial<MensagemChamado> = {}) {
  c.mensagens.push({ id: gerarId("his"), autorId, corpo, criadoEm: agora(), tipo: "sistema", acao, ...extra });
  c.atualizadoEm = agora();
}

function mudarStatus(c: Chamado, autorId: string, status: StatusChamado, corpo: string) {
  if (c.status === status) return;
  c.status = status;
  historico(c, autorId, corpo, { tipo: "status", valor: status });
}

export interface DadosAbertura {
  clienteId: string;
  tipo: "evento" | "plataforma";
  eventoId?: string | undefined;
  assunto: string;
  categoria: string;
  descricao: string;
  vinculadoA?: string | undefined;
  anexo?: AnexoChamado | undefined;
}

export function validarAbertura(d: DadosAbertura) {
  exigirIdCliente(d.clienteId);
  if (!d.assunto.trim()) throw new ErroDominio("assunto", "Informe o assunto.");
  if (!d.descricao.trim()) throw new ErroDominio("descricao", "Descreva a solicitação.");
  if (d.descricao.length > LIMITE_MENSAGEM) throw new ErroDominio("descricao", "Descrição muito longa.");
  if (!(CATEGORIAS_SUPORTE as readonly string[]).includes(d.categoria)) throw new ErroDominio("categoria", "Categoria inválida.");
  if (d.tipo === "evento" && !d.eventoId) throw new ErroDominio("evento", "Escolha o evento.");
}

export function abrirChamado(u: Usuario, d: DadosAbertura): Chamado {
  validarAbertura(d);
  return mutarBase((b) => {
    const id = idDoChamado(d.clienteId);
    const existente = b.chamados.find((x) => x.id === id);
    if (existente) {
      if (existente.solicitanteId !== u.id) throw new ErroDominio("cliente", "Identificador inválido.");
      return existente; // clique repetido / reenvio: devolve o mesmo chamado
    }
    const eventoId = d.tipo === "evento" ? d.eventoId : undefined;
    if (eventoId && !b.eventos.some((e) => e.id === eventoId)) throw new ErroDominio("evento", "Evento não encontrado.");
    const t = agora();
    const c: Chamado = {
      id, eventoId, solicitanteId: u.id, assunto: d.assunto.trim().slice(0, 140), categoria: d.categoria,
      descricao: d.descricao.trim(), status: "aberto", criadoEm: t, atualizadoEm: t,
      mensagens: [{ id: gerarId("msg"), autorId: u.id, corpo: d.descricao.trim(), criadoEm: t, tipo: "mensagem", clienteId: d.clienteId, anexo: d.anexo }],
    };
    if (d.vinculadoA) {
      const anterior = b.chamados.find((x) => x.id === d.vinculadoA);
      if (!anterior || anterior.solicitanteId !== u.id) throw new ErroDominio("vinculo", "Chamado anterior não encontrado.");
      c.mensagens.unshift({ id: gerarId("his"), autorId: u.id, corpo: `Continuação do protocolo ${protocolo(anterior)}`, criadoEm: t, tipo: "sistema", acao: { tipo: "vinculo", valor: anterior.id } });
    }
    b.chamados.push(c);
    notificar(b, equipe(b, c), u.id, "Novo chamado de suporte", `Protocolo ${protocolo(c)} — ${c.eventoId ? "evento" : "plataforma"}.`, c.id);
    return c;
  });
}

export function enviarMensagem(u: Usuario, chamadoId: string, clienteId: string, corpo: string, anexo?: AnexoChamado, encaminhamentoId?: string): MensagemChamado {
  exigirIdCliente(clienteId);
  const texto = corpo.trim();
  if (!texto && !anexo) throw new ErroDominio("corpo", "Escreva a mensagem.");
  if (texto.length > LIMITE_MENSAGEM) throw new ErroDominio("corpo", "Mensagem muito longa.");
  return mutarBase((b) => {
    const c = obterChamado(b, u, chamadoId);
    const repetida = c.mensagens.find((m) => m.clienteId === clienteId);
    if (repetida) return repetida; // reenvio após falha de rede: não duplica
    if (c.status === "fechado") throw new ErroDominio("status", "Chamado fechado: somente leitura.");
    const admin = podeAtender(b, u, c);

    if (encaminhamentoId) {
      // Comunicação interna: só administração e a organização destinatária; nunca chega ao participante.
      const enc = encaminhamentos(b, c).find((e) => e.id === encaminhamentoId);
      if (!enc || (!admin && !(u.perfil === "organizador" && u.organizacaoId === enc.organizacaoId))) throw new ErroDominio("chamado", "Chamado não encontrado.");
      const m: MensagemChamado = { id: gerarId("msg"), autorId: u.id, corpo: texto, criadoEm: agora(), tipo: "mensagem", clienteId, anexo, canal: "interno", encaminhamentoId };
      c.mensagens.push(m);
      c.atualizadoEm = m.criadoEm;
      if (admin) notificar(b, organizadores(b, enc.organizacaoId), u.id, "Nova mensagem da administração", `Encaminhamento do protocolo ${protocolo(c)}.`, c.id, enc.id);
      else notificar(b, admins(b, c), u.id, "Retorno do organizador recebido", `Protocolo ${protocolo(c)}.`, c.id);
      return m;
    }

    const doSolicitante = c.solicitanteId === u.id;
    if (!doSolicitante && !admin) throw new ErroDominio("sem_permissao", "A organização responde apenas à administração.");
    let novo: StatusChamado;
    try { novo = statusAposMensagem(c, doSolicitante); } catch (e) { throw new ErroDominio("status", (e as Error).message); }
    const m: MensagemChamado = { id: gerarId("msg"), autorId: u.id, corpo: texto, criadoEm: agora(), tipo: "mensagem", clienteId, anexo, canal: "participante" };
    c.mensagens.push(m);
    c.atualizadoEm = m.criadoEm;
    if (novo !== c.status) mudarStatus(c, u.id, novo, novo === "em_atendimento" && doSolicitante ? "Participante respondeu: chamado voltou para análise." : "Chamado em análise.");
    if (doSolicitante) notificar(b, admins(b, c), u.id, "Nova resposta no chamado", `Protocolo ${protocolo(c)}.`, c.id);
    else notificar(b, [c.solicitanteId], u.id, "Resposta do suporte", `Protocolo ${protocolo(c)}.`, c.id);
    return m;
  });
}

/** Administração encaminha uma demanda à organização do evento, escolhendo o que compartilhar. */
export function encaminhar(u: Usuario, chamadoId: string, clienteId: string, orientacao: string, anexosIds: string[]): string {
  exigirIdCliente(clienteId);
  const texto = orientacao.trim();
  if (!texto) throw new ErroDominio("orientacao", "Descreva a demanda para o organizador.");
  if (texto.length > LIMITE_MENSAGEM) throw new ErroDominio("orientacao", "Orientação muito longa.");
  return mutarBase((b) => {
    const c = obterChamado(b, u, chamadoId);
    if (!podeAtender(b, u, c)) throw new ErroDominio("sem_permissao", "Somente a administração encaminha chamados.");
    const repetido = c.mensagens.find((m) => m.clienteId === clienteId);
    if (repetido?.acao?.tipo === "encaminhamento") return repetido.acao.valor;
    if (c.status === "fechado") throw new ErroDominio("status", "Chamado fechado: somente leitura.");
    const ev = c.eventoId ? b.eventos.find((e) => e.id === c.eventoId) : undefined;
    if (!ev) throw new ErroDominio("evento", "Somente chamados de evento podem ser encaminhados à organização.");
    const anexos: AnexoCompartilhado[] = [];
    for (const id of new Set(anexosIds)) {
      const m = c.mensagens.find((x) => x.id === id && canalDe(x) === "participante" && x.anexo);
      if (!m?.anexo) throw new ErroDominio("anexo", "Anexo não encontrado.");
      anexos.push({ mensagemId: m.id, nome: m.anexo.nome, tipo: m.anexo.tipo, tamanho: m.anexo.tamanho });
    }
    const encId = gerarId("enc");
    const org = b.organizacoes.find((o) => o.id === ev.organizacaoId);
    historico(c, u.id, `Encaminhado à organização ${org?.nome ?? ""}`.trim() + ".", { tipo: "encaminhamento", valor: encId },
      { canal: "interno", clienteId, encaminhamento: { organizacaoId: ev.organizacaoId, orientacao: texto, anexos } });
    if (c.status === "aberto" || c.status === "aguardando_participante") mudarStatus(c, u.id, "em_atendimento", "Chamado em análise.");
    notificar(b, organizadores(b, ev.organizacaoId), u.id, "Demanda encaminhada pela administração", `Protocolo ${protocolo(c)} — ${ev.nome}.`, c.id, encId);
    return encId;
  });
}

/** Organizador sinaliza que o retorno foi enviado à administração (não encerra o chamado). */
export function marcarRetorno(u: Usuario, chamadoId: string, encaminhamentoId: string): void {
  mutarBase((b) => {
    const c = obterChamado(b, u, chamadoId);
    const enc = encaminhamentos(b, c).find((e) => e.id === encaminhamentoId);
    if (!enc || u.perfil !== "organizador" || u.organizacaoId !== enc.organizacaoId) throw new ErroDominio("chamado", "Chamado não encontrado.");
    if (c.status === "fechado") throw new ErroDominio("status", "Chamado fechado: somente leitura.");
    if (enc.situacao === "retorno_enviado") return;
    historico(c, u.id, "Retorno enviado à administração.", { tipo: "retorno", valor: enc.id }, { canal: "interno", encaminhamentoId: enc.id });
    notificar(b, admins(b, c), u.id, "Retorno do organizador recebido", `Protocolo ${protocolo(c)}.`, c.id);
  });
}

/** Marca até onde a pessoa leu um chamado (persistido no servidor: vale em todos os aparelhos). */
export function marcarChamadoLido(u: Usuario, chamadoId: string, ate: string): void {
  mutarBase((b) => {
    obterChamado(b, u, chamadoId);
    const eu = b.usuarios.find((x) => x.id === u.id);
    if (eu) registrarLeitura(eu, chamadoId, ate);
  });
}

/** Assumir (sem responsavel informado) ou atribuir a outra pessoa da equipe. */
export function definirResponsavel(u: Usuario, chamadoId: string, novoId?: string): void {
  mutarBase((b) => {
    const c = obterChamado(b, u, chamadoId);
    if (!podeAtender(b, u, c)) throw new ErroDominio("sem_permissao", "Você não atende este chamado.");
    if (c.status === "fechado") throw new ErroDominio("status", "Chamado fechado: somente leitura.");
    const alvoId = novoId ?? u.id;
    if (alvoId !== u.id && u.perfil !== "admin") throw new ErroDominio("sem_permissao", "Somente a administração atribui chamados a outras pessoas.");
    const alvo = b.usuarios.find((x) => x.id === alvoId);
    if (!alvo || !podeAtender(b, alvo, c)) throw new ErroDominio("responsavel", "Essa pessoa não pode atender este chamado.");
    if (responsavelId(c) === alvoId) return;
    const nome = alvo.nomeExibicao || alvo.nomeCompleto;
    historico(c, u.id, alvoId === u.id ? `${nome} assumiu o atendimento.` : `Atendimento atribuído a ${nome}.`, { tipo: "responsavel", valor: alvoId });
    if (c.status === "aberto") mudarStatus(c, u.id, "em_atendimento", "Chamado em análise.");
    notificar(b, [alvoId], u.id, "Chamado atribuído a você", `Protocolo ${protocolo(c)}.`, c.id);
  });
}

export function alterarStatus(u: Usuario, chamadoId: string, acao: AcaoStatus, descricao?: string): void {
  mutarBase((b) => {
    const c = obterChamado(b, u, chamadoId);
    const atende = podeAtender(b, u, c);
    const solicitante = c.solicitanteId === u.id;
    let novo: StatusChamado;
    try { novo = transicao(c, acao, atende, solicitante); } catch (e) { throw new ErroDominio("status", (e as Error).message); }
    if (acao === "resolver" && !descricao?.trim()) throw new ErroDominio("solucao", "Descreva brevemente a solução.");
    const textos: Record<AcaoStatus, string> = {
      aguardar: "Aguardando resposta do participante.",
      resolver: (descricao ?? "").trim().slice(0, 500),
      reabrir: "Chamado reaberto.",
      fechar: "Chamado fechado.",
    };
    mudarStatus(c, u.id, novo, textos[acao]);
    const alvos = solicitante ? admins(b, c) : [c.solicitanteId];
    notificar(b, alvos, u.id, "Chamado atualizado", `Protocolo ${protocolo(c)}.`, c.id);
  });
}
