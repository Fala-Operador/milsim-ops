// Ficha de emergência do operador (tipo sanguíneo, alergias, contato de emergência).
// Dado de saúde (LGPD, art. 11): é opcional, o titular sempre vê e edita, e a gestão do evento
// (organização dona ou admin) só vê quando o titular AUTORIZOU e tem inscrição CONFIRMADA num
// evento dela, de 7 dias antes do início até o fim. Fora disso, nem chega ao navegador (visão).
import { z } from "zod";
import { somenteDigitos, telefoneValido } from "@/lib/domain/validators";
import type { BaseDados, FichaEmergencia, TipoSanguineo, Usuario } from "@/lib/domain/types";

export const TIPOS_SANGUINEOS: readonly TipoSanguineo[] = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];
export const DIAS_ANTES_DO_EVENTO = 7;
export const LIMITE_ALERGIAS = 500;
export const LIMITE_NOME_CONTATO = 120;
export const LINK_FICHA = "/app/perfil?aba=emergencia";

const DIA = 86_400_000;

export interface DadosFicha {
  tipoSanguineo?: string | undefined;
  alergias?: string | undefined;
  contatoNome?: string | undefined;
  contatoTelefone?: string | undefined;
  compartilhar: boolean;
}

/** Formato aceito pelas APIs (cadastro e perfil); as regras de conteúdo ficam em `erroFicha`. */
export const esquemaFicha = z.object({
  tipoSanguineo: z.string().max(3).optional(),
  alergias: z.string().max(LIMITE_ALERGIAS).optional(),
  contatoNome: z.string().max(LIMITE_NOME_CONTATO).optional(),
  contatoTelefone: z.string().max(20).optional(),
  compartilhar: z.boolean(),
});

export const ehTipoSanguineo =(v: unknown): v is TipoSanguineo => TIPOS_SANGUINEOS.includes(v as TipoSanguineo);

/** Algum campo de saúde ou contato preenchido. */
export function fichaPreenchida(f: { tipoSanguineo?: string | undefined; alergias?: string | undefined; contatoNome?: string | undefined; contatoTelefone?: string | undefined } | undefined): boolean {
  return !!(f && (f.tipoSanguineo?.trim() || f.alergias?.trim() || f.contatoNome?.trim() || f.contatoTelefone?.trim()));
}

/** Primeiro problema do formulário (vazio = válido). Todos os campos são opcionais. */
export function erroFicha(d: DadosFicha): string {
  const tipo = d.tipoSanguineo?.trim();
  if (tipo && !ehTipoSanguineo(tipo)) return "Tipo sanguíneo inválido.";
  if ((d.alergias ?? "").trim().length > LIMITE_ALERGIAS) return `Descreva as alergias em até ${LIMITE_ALERGIAS} caracteres.`;
  const nome = (d.contatoNome ?? "").trim();
  const tel = somenteDigitos(d.contatoTelefone ?? "");
  if (nome.length > LIMITE_NOME_CONTATO) return `Nome do contato com até ${LIMITE_NOME_CONTATO} caracteres.`;
  if (tel && !telefoneValido(tel)) return "Telefone do contato de emergência inválido. Informe com DDD.";
  if (nome && !tel) return "Informe o telefone do contato de emergência.";
  if (tel && !nome) return "Informe o nome do contato de emergência.";
  return "";
}

/**
 * Ficha a gravar a partir do formulário. Tudo vazio (e sem autorização) = remover a ficha.
 * A data da autorização é preservada enquanto ela continua dada; retirar apaga a data.
 */
export function montarFicha(d: DadosFicha, anterior: FichaEmergencia | undefined, agora: Date = new Date()): FichaEmergencia | undefined {
  const tipo = d.tipoSanguineo?.trim();
  const ficha: FichaEmergencia = {
    tipoSanguineo: tipo && ehTipoSanguineo(tipo) ? tipo : undefined,
    alergias: d.alergias?.trim() || undefined,
    contatoNome: d.contatoNome?.trim() || undefined,
    contatoTelefone: somenteDigitos(d.contatoTelefone ?? "") || undefined,
    compartilhar: d.compartilhar,
    consentimentoEm: d.compartilhar ? (anterior?.compartilhar && anterior.consentimentoEm) || agora.toISOString() : undefined,
    atualizadoEm: agora.toISOString(),
  };
  return fichaPreenchida(ficha) || ficha.compartilhar ? ficha : undefined;
}

/** O evento está na janela em que a gestão pode ver as fichas (7 dias antes até o fim). */
export function eventoNaJanelaDaFicha(ev: { inicioEm: string; fimEm: string }, agora: Date = new Date()): boolean {
  const t = agora.getTime();
  return t >= new Date(ev.inicioEm).getTime() - DIAS_ANTES_DO_EVENTO * DIA && t <= new Date(ev.fimEm).getTime();
}

/** Quem está vendo pode receber a ficha do titular? (titular sempre; gestão só com autorização e na janela) */
export function podeVerFicha(
  base: Pick<BaseDados, "eventos" | "inscricoes">,
  quemVe: Pick<Usuario, "id" | "perfil" | "organizacaoId" | "ativo"> | null,
  titular: Pick<Usuario, "id" | "fichaEmergencia">,
  agora: Date = new Date(),
): boolean {
  if (!quemVe?.ativo || !titular.fichaEmergencia) return false;
  if (quemVe.id === titular.id) return true;
  if (!titular.fichaEmergencia.compartilhar) return false;
  const gestao = (organizacaoId: string) =>
    quemVe.perfil === "admin" || (quemVe.perfil === "organizador" && quemVe.organizacaoId === organizacaoId);
  return base.inscricoes.some((i) => {
    if (i.usuarioId !== titular.id || i.status !== "confirmada") return false;
    const ev = base.eventos.find((e) => e.id === i.eventoId);
    return !!ev && gestao(ev.organizacaoId) && eventoNaJanelaDaFicha(ev, agora);
  });
}

export function telefoneFormatado(digitos: string | undefined): string {
  const d = somenteDigitos(digitos ?? "");
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return d;
}
