// Regras puras da Central de Suporte: acesso, status, responsável e derivados da conversa.
// Responsável, solução e vínculo são derivados dos eventos de histórico (mensagens do
// tipo "sistema"), que nunca são editados nem apagados.
import type { BaseDados, Chamado, MensagemChamado, StatusChamado, Usuario } from "@/lib/domain/types";

export const ROTULO_STATUS: Record<StatusChamado, string> = {
  aberto: "Aberto",
  em_atendimento: "Em atendimento",
  aguardando_participante: "Aguardando participante",
  resolvido: "Resolvido",
  fechado: "Fechado",
};

export const CATEGORIAS_SUPORTE = ["Inscrição", "Pagamento", "Logística", "Regras", "Conta", "Funcionamento", "Outro"] as const;

export const TIPOS_ANEXO = ["image/jpeg", "image/png", "image/webp", "application/pdf"] as const;
export const TAMANHO_MAX_ANEXO = 5 * 1024 * 1024;
export const LIMITE_MENSAGEM = 4000;

export type PapelSuporte = "participante" | "organizador" | "admin";
export const ROTULO_PAPEL: Record<PapelSuporte, string> = { participante: "Participante", organizador: "Organização", admin: "Administração" };

/** Protocolo legível e estável, derivado da data de criação e do id. */
export function protocolo(c: Pick<Chamado, "id" | "criadoEm">): string {
  const d = c.criadoEm.slice(0, 10).replace(/-/g, "");
  const sufixo = c.id.replace(/[^a-z0-9]/gi, "").slice(-6).toUpperCase();
  return `SUP-${d}-${sufixo}`;
}

export const tipoDoChamado = (c: Pick<Chamado, "eventoId">) => (c.eventoId ? "evento" : "plataforma");

function geraEventoDoChamado(base: BaseDados, u: Usuario, c: Chamado): boolean {
  if (!c.eventoId || u.perfil !== "organizador") return false;
  const ev = base.eventos.find((e) => e.id === c.eventoId);
  return !!ev && ev.organizacaoId === u.organizacaoId;
}

/** Quem pode atender: admin sempre; organizador só chamados de eventos da própria organização. */
export function podeAtender(base: BaseDados, u: Usuario | null, c: Chamado): boolean {
  if (!u?.ativo) return false;
  return u.perfil === "admin" || geraEventoDoChamado(base, u, c);
}

export function podeVer(base: BaseDados, u: Usuario | null, c: Chamado): boolean {
  if (!u?.ativo) return false;
  return c.solicitanteId === u.id || podeAtender(base, u, c);
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
  return ultimaMensagem(c)?.autorId === c.solicitanteId;
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
  if (c.status === "fechado") throw new Error("Chamado fechado: somente leitura.");
  switch (acao) {
    case "aguardar":
      if (!atende) throw new Error("Somente quem atende pode aguardar o participante.");
      if (c.status === "resolvido") throw new Error("Reabra o chamado antes.");
      return "aguardando_participante";
    case "resolver":
      if (!atende) throw new Error("Somente quem atende pode resolver.");
      if (c.status === "resolvido") throw new Error("O chamado já está resolvido.");
      return "resolvido";
    case "reabrir":
      if (!solicitante && !atende) throw new Error("Sem permissão.");
      if (c.status !== "resolvido") throw new Error("Só chamados resolvidos podem ser reabertos.");
      return responsavelId(c) ? "em_atendimento" : "aberto";
    case "fechar":
      if (!atende && !solicitante) throw new Error("Sem permissão.");
      return "fechado";
  }
}

/** Novo status após uma mensagem de texto. */
export function statusAposMensagem(c: Chamado, doSolicitante: boolean): StatusChamado {
  if (c.status === "fechado") throw new Error("Chamado fechado: somente leitura.");
  if (doSolicitante) {
    if (c.status === "aguardando_participante") return "em_atendimento";
    return c.status;
  }
  if (c.status === "aberto") return "em_atendimento";
  return c.status;
}

/** Chave do dia (aaaa-mm-dd local) para separadores. */
export const diaDe = (iso: string) => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
