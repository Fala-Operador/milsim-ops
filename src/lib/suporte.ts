// Regras puras da Central de Suporte: acesso, status, responsável e derivados da conversa.
// Responsável, solução e vínculo são derivados dos eventos de histórico (mensagens do
// tipo "sistema"), que nunca são editados nem apagados.
import type { AnexoCompartilhado, BaseDados, Chamado, MensagemChamado, StatusChamado, Usuario } from "@/lib/domain/types";
import { tr } from "@/i18n/lib/suporte";

export const ROTULO_STATUS: Record<StatusChamado, string> = {
  get aberto() { return tr("aberto"); },
  get em_atendimento() { return tr("em_analise"); },
  get aguardando_participante() { return tr("aguardando_participante"); },
  get resolvido() { return tr("resolvido"); },
  get fechado() { return tr("fechado"); },
};

export const CATEGORIAS_SUPORTE = ["Inscrição", "Pagamento", "Logística", "Regras", "Conta", "Funcionamento", "Outro"] as const;

/** Rótulo de tela da categoria (o valor gravado continua em português). */
export function rotuloCategoria(c: string): string {
  const chaves: Record<string, Parameters<typeof tr>[0]> = {
    Inscrição: "categoria_inscricao", Pagamento: "categoria_pagamento", Logística: "categoria_logistica", Regras: "categoria_regras",
    Conta: "categoria_conta", Funcionamento: "categoria_funcionamento", Outro: "categoria_outro",
  };
  return chaves[c] ? tr(chaves[c]) : c;
}

export const TIPOS_ANEXO = ["image/jpeg", "image/png", "image/webp", "application/pdf"] as const;
export const TAMANHO_MAX_ANEXO = 5 * 1024 * 1024;
export const LIMITE_MENSAGEM = 4000;

export type PapelSuporte = "participante" | "organizador" | "admin";
export const ROTULO_PAPEL: Record<PapelSuporte, string> = { get participante() { return tr("participante"); }, get organizador() { return tr("organizacao"); }, get admin() { return tr("administracao"); } };

/** Protocolo legível e estável, derivado da data de criação e do id. */
export function protocolo(c: Pick<Chamado, "id" | "criadoEm">): string {
  const d = c.criadoEm.slice(0, 10).replace(/-/g, "");
  const sufixo = c.id.replace(/[^a-z0-9]/gi, "").slice(-6).toUpperCase();
  return `SUP-${d}-${sufixo}`;
}

export const tipoDoChamado = (c: Pick<Chamado, "eventoId">) => (c.eventoId ? "evento" : "plataforma");

// ---------- Encaminhamentos (administração ↔ organização) ----------
export const canalDe = (m: Pick<MensagemChamado, "canal">) => m.canal ?? "participante";

export interface Encaminhamento {
  id: string;
  chamadoId: string;
  organizacaoId: string;
  orientacao: string;
  anexos: AnexoCompartilhado[];
  autorId: string;
  criadoEm: string;
  /** Mensagens internas (sem o evento de criação). */
  mensagens: MensagemChamado[];
  /** Aguardando o organizador ou retorno já enviado à administração. */
  situacao: "aguardando_organizador" | "retorno_enviado";
  ultimoRetorno: string | null;
}

/** Encaminhamentos derivados do histórico interno, em ordem de criação. */
export function encaminhamentos(base: Pick<BaseDados, "usuarios">, c: Chamado): Encaminhamento[] {
  const lista: Encaminhamento[] = [];
  for (const m of c.mensagens) {
    if (m.acao?.tipo !== "encaminhamento" || !m.encaminhamento) continue;
    const id = m.acao.valor;
    const doEnc = c.mensagens.filter((x) => x.encaminhamentoId === id && x !== m);
    let situacao: Encaminhamento["situacao"] = "aguardando_organizador";
    let ultimoRetorno: string | null = null;
    for (const x of doEnc) {
      const autor = base.usuarios.find((u) => u.id === x.autorId);
      const doOrganizador = x.acao?.tipo === "retorno" || (x.tipo !== "sistema" && autor?.perfil === "organizador");
      if (doOrganizador) { situacao = "retorno_enviado"; ultimoRetorno = x.criadoEm; }
      else if (x.tipo !== "sistema") situacao = "aguardando_organizador";
    }
    lista.push({ id, chamadoId: c.id, organizacaoId: m.encaminhamento.organizacaoId, orientacao: m.encaminhamento.orientacao, anexos: m.encaminhamento.anexos,
      autorId: m.autorId, criadoEm: m.criadoEm, mensagens: doEnc, situacao, ultimoRetorno });
  }
  return lista;
}

/** Retorno do organizador ainda não tratado: nada da administração depois dele. */
export function retornoRecebido(base: Pick<BaseDados, "usuarios">, c: Chamado): boolean {
  if (!ativo(c)) return false;
  return encaminhamentos(base, c).some((e) => {
    if (e.situacao !== "retorno_enviado" || !e.ultimoRetorno) return false;
    return !c.mensagens.some((m) => m.criadoEm > e.ultimoRetorno! && base.usuarios.find((u) => u.id === m.autorId)?.perfil === "admin");
  });
}

export type StatusExibido = StatusChamado | "aguardando_organizador";
export const ROTULO_STATUS_EXIBIDO: Record<StatusExibido, string> = {
  get aberto() { return ROTULO_STATUS.aberto; },
  get em_atendimento() { return ROTULO_STATUS.em_atendimento; },
  get aguardando_participante() { return ROTULO_STATUS.aguardando_participante; },
  get aguardando_organizador() { return tr("aguardando_organizador"); },
  get resolvido() { return ROTULO_STATUS.resolvido; },
  get fechado() { return ROTULO_STATUS.fechado; },
};

/** Status mostrado: "aguardando organizador" é derivado do encaminhamento em aberto (sem nova coluna). */
export function statusExibido(base: Pick<BaseDados, "usuarios">, c: Chamado): StatusExibido {
  if ((c.status === "aberto" || c.status === "em_atendimento") && encaminhamentos(base, c).some((e) => e.situacao === "aguardando_organizador")) return "aguardando_organizador";
  return c.status;
}

/** Quem atende: somente a administração. */
export function podeAtender(_base: BaseDados, u: Usuario | null, _c: Chamado): boolean {
  return !!u?.ativo && u.perfil === "admin";
}

/** Organizador da organização destinatária de algum encaminhamento. */
export function recebeuEncaminhamento(base: BaseDados, u: Usuario | null, c: Chamado): boolean {
  if (!u?.ativo || u.perfil !== "organizador" || !u.organizacaoId) return false;
  return encaminhamentos(base, c).some((e) => e.organizacaoId === u.organizacaoId);
}

export function podeVer(base: BaseDados, u: Usuario | null, c: Chamado): boolean {
  if (!u?.ativo) return false;
  return c.solicitanteId === u.id || podeAtender(base, u, c) || recebeuEncaminhamento(base, u, c);
}

/**
 * O que cada pessoa recebe de um chamado. Participante: só a conversa pública.
 * Organizador: só os encaminhamentos da própria organização (sem descrição, conversa ou anexos não compartilhados).
 */
export function vistaDoChamado(base: BaseDados, u: Usuario | null, c: Chamado): Chamado | null {
  if (!u?.ativo) return null;
  if (podeAtender(base, u, c)) return c;
  if (c.solicitanteId === u.id) return { ...c, mensagens: c.mensagens.filter((m) => canalDe(m) === "participante") };
  if (!recebeuEncaminhamento(base, u, c)) return null;
  const meus = new Set(encaminhamentos(base, c).filter((e) => e.organizacaoId === u.organizacaoId).map((e) => e.id));
  return {
    ...c, descricao: "",
    mensagens: c.mensagens.filter((m) => canalDe(m) === "interno" && (meus.has(m.encaminhamentoId ?? "") || (m.acao?.tipo === "encaminhamento" && meus.has(m.acao.valor)))),
  };
}

/** Anexos que a pessoa pode abrir (id da mensagem que contém o arquivo). */
export function podeAbrirAnexo(base: BaseDados, u: Usuario | null, c: Chamado, mensagemId: string): boolean {
  const v = vistaDoChamado(base, u, c);
  if (!v) return false;
  if (v.mensagens.some((m) => m.id === mensagemId && m.anexo)) return true;
  return encaminhamentos(base, c).some((e) => e.organizacaoId === u?.organizacaoId && u?.perfil === "organizador" && e.anexos.some((a) => a.mensagemId === mensagemId));
}

// ---------- Destinos dos links (um único lugar monta as URLs do suporte) ----------
export const ROTAS_SUPORTE = ["/app/suporte", "/admin/suporte", "/organizacao/suporte"] as const;

/** Destino do chamado para a pessoa: participante → Meus chamados; admin → gestão; organizador → encaminhamento. */
export function linkSuporte(base: BaseDados, u: Pick<Usuario, "id" | "perfil" | "organizacaoId"> | undefined, c: Chamado, encaminhamentoId?: string): string {
  if (!u) return `/app/suporte?c=${encodeURIComponent(c.id)}`;
  if (c.solicitanteId === u.id) return `/app/suporte?c=${encodeURIComponent(c.id)}`;
  if (u.perfil === "admin") return `/admin/suporte?c=${encodeURIComponent(c.id)}`;
  const enc = encaminhamentoId ?? [...encaminhamentos(base, c)].reverse().find((e) => e.organizacaoId === u.organizacaoId)?.id;
  return enc ? `/organizacao/suporte?e=${encodeURIComponent(enc)}` : "/organizacao/suporte";
}

/**
 * Reescreve links de suporte (inclusive de notificações antigas) para a área certa de quem abre.
 * Sem acesso, mantém um destino na área da pessoa, onde aparece a tela de indisponível.
 */
export function resolverLinkSuporte(base: BaseDados, u: Usuario | null, link: string): string {
  const [caminho, q] = link.split("?");
  if (!(ROTAS_SUPORTE as readonly string[]).includes(caminho ?? "")) return link;
  const ps = new URLSearchParams(q ?? "");
  const cId = ps.get("c");
  const eId = ps.get("e");
  const c = cId ? base.chamados.find((x) => x.id === cId) : eId ? base.chamados.find((x) => x.mensagens.some((m) => m.acao?.tipo === "encaminhamento" && m.acao.valor === eId)) : undefined;
  if (!u) return link;
  if (c && podeVer(base, u, c)) return linkSuporte(base, u, c, eId ?? undefined);
  const area = u.perfil === "admin" ? "/admin/suporte" : u.perfil === "organizador" && caminho === "/organizacao/suporte" ? "/organizacao/suporte" : "/app/suporte";
  const id = cId ?? eId ?? "indisponivel";
  return `${area}?${area === "/organizacao/suporte" ? "e" : "c"}=${encodeURIComponent(id)}`;
}

export function papelNoChamado(base: BaseDados, autorId: string, c: Chamado): PapelSuporte {
  const u = base.usuarios.find((x) => x.id === autorId);
  if (u?.perfil === "admin") return "admin";
  if (autorId !== c.solicitanteId && u?.perfil === "organizador") return "organizador";
  return "participante";
}

const sistemas = (c: Chamado) => c.mensagens.filter((m) => m.tipo === "sistema");

export function responsavelId(c: Chamado): string | null {
  const ult = [...sistemas(c)].reverse().find((m) => m.acao?.tipo === "responsavel");
  return ult?.acao?.valor ?? null;
}

export function solucao(c: Chamado): string | null {
  if (c.status !== "resolvido" && c.status !== "fechado") return null;
  const ult = [...sistemas(c)].reverse().find((m) => m.acao?.tipo === "status" && m.acao.valor === "resolvido");
  return ult?.corpo ?? null;
}

export function vinculadoA(c: Chamado): string | null {
  return sistemas(c).find((m) => m.acao?.tipo === "vinculo")?.acao?.valor ?? null;
}

export const mensagensDeTexto = (c: Chamado) => c.mensagens.filter((m) => m.tipo !== "sistema");
export const ultimaMensagem = (c: Chamado): MensagemChamado | undefined => mensagensDeTexto(c).at(-1);
export const ultimaAtividade = (c: Chamado) => c.mensagens.at(-1)?.criadoEm ?? c.atualizadoEm;

/** Mensagens de outras pessoas posteriores à última leitura. */
export function naoLidas(c: Chamado, usuarioId: string, lidoAte: string | undefined): number {
  return mensagensDeTexto(c).filter((m) => m.autorId !== usuarioId && (!lidoAte || m.criadoEm > lidoAte)).length;
}

// ---------- Leitura por pessoa (persistida no servidor, no cadastro do usuário) ----------
const LIMITE_LEITURAS = 200;

/** Até quando a pessoa leu um chamado (ISO), gravado no servidor. */
export function lidoAteSuporte(u: Pick<Usuario, "silencioNotificacoes">, chamadoId: string): string | undefined {
  return u.silencioNotificacoes?.leiturasSuporte?.[chamadoId];
}

/** Registra a leitura no objeto do usuário: só avança a marca e limita o histórico. */
export function registrarLeitura(u: Usuario, chamadoId: string, ate: string): void {
  const atual = u.silencioNotificacoes?.leiturasSuporte ?? {};
  if (atual[chamadoId] && atual[chamadoId]! >= ate) return;
  const entradas = Object.entries({ ...atual, [chamadoId]: ate });
  entradas.sort((a, b) => b[1].localeCompare(a[1]));
  u.silencioNotificacoes = { ...u.silencioNotificacoes, leiturasSuporte: Object.fromEntries(entradas.slice(0, LIMITE_LEITURAS)) };
}

/** Aguardando resposta da equipe: última mensagem é do solicitante e o chamado está ativo. */
export function pendenteDeResposta(c: Chamado): boolean {
  if (c.status === "resolvido" || c.status === "fechado") return false;
  return mensagensDeTexto(c).filter((m) => canalDe(m) === "participante").at(-1)?.autorId === c.solicitanteId;
}

export const ativo = (c: Chamado) => c.status !== "resolvido" && c.status !== "fechado";

/** Pendentes primeiro, depois atividade mais recente. */
export function ordenarParaAtendimento(lista: Chamado[]): Chamado[] {
  return [...lista].sort((a, b) => Number(pendenteDeResposta(b)) - Number(pendenteDeResposta(a)) || ultimaAtividade(b).localeCompare(ultimaAtividade(a)));
}

// ---------- Transições ----------
export type AcaoStatus = "aguardar" | "resolver" | "reabrir" | "fechar";

/** Valida uma transição e devolve o novo status (lança string com a mensagem de erro). */
export function transicao(c: Chamado, acao: AcaoStatus, atende: boolean, solicitante: boolean): StatusChamado {
  if (c.status === "fechado") throw new Error(tr("chamado_fechado_somente_leitura"));
  switch (acao) {
    case "aguardar":
      if (!atende) throw new Error(tr("somente_quem_atende_pode_aguardar_o"));
      if (c.status === "resolvido") throw new Error(tr("reabra_o_chamado_antes"));
      return "aguardando_participante";
    case "resolver":
      if (!atende) throw new Error(tr("somente_quem_atende_pode_resolver"));
      if (c.status === "resolvido") throw new Error(tr("o_chamado_ja_esta_resolvido"));
      return "resolvido";
    case "reabrir":
      if (!solicitante && !atende) throw new Error(tr("sem_permissao"));
      if (c.status !== "resolvido") throw new Error(tr("so_chamados_resolvidos_podem_ser_reabert"));
      return responsavelId(c) ? "em_atendimento" : "aberto";
    case "fechar":
      if (!atende && !solicitante) throw new Error(tr("sem_permissao"));
      return "fechado";
  }
}

/** Novo status após uma mensagem de texto. */
export function statusAposMensagem(c: Chamado, doSolicitante: boolean): StatusChamado {
  if (c.status === "fechado") throw new Error(tr("chamado_fechado_somente_leitura"));
  if (doSolicitante) {
    // Resolvido: o participante reabre o chamado antes de escrever de novo.
    if (c.status === "resolvido") throw new Error(tr("este_chamado_foi_resolvido_reabra_o"));
    if (c.status === "aguardando_participante") return "em_atendimento";
    return c.status;
  }
  if (c.status === "aberto") return "em_atendimento";
  return c.status;
}

/** Ações de status permitidas a uma pessoa (derivadas de `transicao`, sem regras próprias). */
export function acoesPermitidas(c: Chamado, atende: boolean, solicitante: boolean): AcaoStatus[] {
  return (["aguardar", "resolver", "reabrir", "fechar"] as const).filter((a) => {
    try { transicao(c, a, atende, solicitante); return true; } catch { return false; }
  });
}

/** O que a área inferior da conversa mostra para o solicitante, conforme o status. */
export type EstadoCompositor = "livre" | "resolvido" | "fechado";
export function estadoCompositor(c: Pick<Chamado, "status">, solicitante: boolean): EstadoCompositor {
  if (c.status === "fechado") return "fechado";
  if (c.status === "resolvido" && solicitante) return "resolvido";
  return "livre";
}

/** Chave do dia (aaaa-mm-dd local) para separadores. */
export const diaDe = (iso: string) => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
