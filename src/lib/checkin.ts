// Regras puras do check-in/credenciamento (sem armazenamento, sem React).
import type { FichaEmergencia, StatusInscricao } from "@/lib/domain/types";
import { tr } from "@/i18n/lib/checkin";
import { localeAtual } from "@/i18n/dicionario";

export type OrigemEntrada = "qr" | "codigo" | "manual";
export type StatusSync = "pendente" | "sincronizado" | "conflito" | "falhou";

export interface RegistroCheckin {
  id: string; // id único da operação (evita duplicidade na sincronização)
  eventoId: string;
  inscricaoId: string;
  tipo: "entrada" | "reversao";
  revertidoId?: string | undefined;
  origem: OrigemEntrada;
  motivo?: string | undefined;
  operadorId: string;
  operadorNome: string;
  dispositivoId: string;
  em: string;
  sync: StatusSync;
  conflito?: string | undefined;
}

/** Dados mínimos de credenciamento: sem CPF, telefone, e-mail ou endereço. */
export interface IngressoCredenciamento {
  inscricaoId: string;
  eventoId: string;
  token: string;
  codigo: string;
  nome: string;
  tipo: string;
  exercito: string;
  status: StatusInscricao;
  /** Ficha de emergência, só quando a visão a liberou (autorização + janela do evento). */
  emergencia?: FichaEmergencia | undefined;
}

export type ResultadoValidacao =
  | { tipo: "valido"; ingresso: IngressoCredenciamento }
  | { tipo: "ja_realizado"; ingresso: IngressoCredenciamento; em: string }
  | { tipo: "cancelado"; ingresso: IngressoCredenciamento }
  | { tipo: "outro_evento" }
  | { tipo: "nao_encontrado" };

export const PREFIXO_QR = "MSO-CHECKIN:";
export const ROTULO_ORIGEM_ENTRADA: Record<OrigemEntrada, string> = {
  get qr() { return tr("qr_code"); },
  codigo: "Código digitado",
  get manual() { return tr("busca_manual"); },
};
export const ROTULO_SYNC: Record<StatusSync, string> = {
  get pendente() { return tr("sincronizacao_pendente"); },
  get sincronizado() { return tr("sincronizado"); },
  get conflito() { return tr("conflito"); },
  get falhou() { return tr("falha_tentara_de_novo"); },
};

export function conteudoQr(token: string): string {
  return PREFIXO_QR + token;
}

/** Extrai o token do texto lido; aceita o token puro também. */
export function lerConteudoQr(texto: string): string | null {
  const t = texto.trim();
  if (t.startsWith(PREFIXO_QR)) return t.slice(PREFIXO_QR.length) || null;
  return /^T[A-Z2-9]{16,}$/.test(t) ? t : null;
}

export const normalizarCodigo = (s: string) => s.trim().toUpperCase();

const ALFABETO_TOKEN = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
/** Texto aleatório (criptográfico) no alfabeto sem caracteres ambíguos. */
export function aleatorioSeguro(n: number): string {
  const bytes = new Uint8Array(n);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => ALFABETO_TOKEN[b % ALFABETO_TOKEN.length]).join("");
}
/** Token opaco e estável do QR Code de entrada (gerado na confirmação da inscrição). */
export const gerarTokenEntrada = () => `T${aleatorioSeguro(20)}`;

/** Entrada vigente de uma inscrição: a mais antiga não revertida e sem conflito. */
export function entradaAtiva(registros: RegistroCheckin[], inscricaoId: string): RegistroCheckin | undefined {
  const revertidos = new Set(registros.filter((r) => r.tipo === "reversao").map((r) => r.revertidoId));
  return registros
    .filter((r) => r.tipo === "entrada" && r.inscricaoId === inscricaoId && r.sync !== "conflito" && !revertidos.has(r.id))
    .sort((a, b) => a.em.localeCompare(b.em))[0];
}

export function validarIngresso(p: {
  eventoId: string;
  ingresso: IngressoCredenciamento | undefined;
  /** Evento a que o token pertence quando não está neste evento. */
  outroEvento?: boolean;
  registros: RegistroCheckin[];
}): ResultadoValidacao {
  const { ingresso } = p;
  if (!ingresso) return p.outroEvento ? { tipo: "outro_evento" } : { tipo: "nao_encontrado" };
  if (ingresso.eventoId !== p.eventoId) return { tipo: "outro_evento" };
  if (ingresso.status !== "confirmada") return { tipo: "cancelado", ingresso };
  const ativa = entradaAtiva(p.registros, ingresso.inscricaoId);
  if (ativa) return { tipo: "ja_realizado", ingresso, em: ativa.em };
  return { tipo: "valido", ingresso };
}

/** Une registros por id; a versão local prevalece (tem o status de sync mais recente). */
export function mesclarRegistros(referencia: RegistroCheckin[], locais: RegistroCheckin[]): RegistroCheckin[] {
  const mapa = new Map<string, RegistroCheckin>();
  referencia.forEach((r) => mapa.set(r.id, r));
  locais.forEach((r) => mapa.set(r.id, r));
  return [...mapa.values()].sort((a, b) => b.em.localeCompare(a.em));
}

/** Decide como a base de referência aceita uma operação vinda da fila. */
export function resolverSincronizacao(
  referencia: RegistroCheckin[],
  op: RegistroCheckin,
  statusInscricaoAtual: StatusInscricao | undefined,
): { status: "sincronizado" | "conflito"; conflito?: string } {
  if (referencia.some((r) => r.id === op.id)) return { status: "sincronizado" }; // já aplicada (idempotente)
  if (op.tipo === "reversao") return { status: "sincronizado" };
  if (statusInscricaoAtual !== "confirmada")
    return { status: "conflito", conflito: tr("a_inscricao_foi_cancelada_ou_estornada") };
  const ativa = entradaAtiva(referencia, op.inscricaoId);
  if (ativa)
    return { status: "conflito", conflito: tr("ja_havia_entrada_registrada", { hora: new Date(ativa.em).toLocaleTimeString(localeAtual(), { hour: "2-digit", minute: "2-digit" }), nome: ativa.operadorNome }) };
  return { status: "sincronizado" };
}
