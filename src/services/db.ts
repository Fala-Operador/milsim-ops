// Acesso à BaseDados com três origens possíveis:
//  1) Servidor: a base da requisição atual, carregada do Supabase pela unidade de
//     trabalho (src/server/unidade.server.ts). Os serviços leem e mutam essa base;
//     a unidade de trabalho grava as diferenças no banco ao final.
//  2) Cliente: o snapshot (visão) devolvido pela API para o usuário logado —
//     SOMENTE LEITURA. Toda escrita passa pelas server functions em src/api/.
//  3) Testes: base demonstrativa em memória (definirBaseEmMemoria).
import { baseVazia } from "@/lib/persistencia";
import type { BaseDados } from "@/lib/domain/types";

/** Contexto da requisição no servidor (registrado por src/server/unidade.server.ts). */
export interface ContextoBase {
  base: BaseDados;
}
interface ProvedorContexto {
  obter(): ContextoBase | undefined;
}
const g = globalThis as unknown as { __milsimProvedorBase?: ProvedorContexto };

export function registrarProvedorContexto(p: ProvedorContexto): void {
  g.__milsimProvedorBase = p;
}

const noServidor = () => typeof window === "undefined";

let snapshot: BaseDados = baseVazia();
let memoria: BaseDados | null = null;
let versao = 0;
const ouvintes = new Set<() => void>();

/** Versão da base em memória: aumenta a cada atualização. */
export function versaoBase(): number {
  return versao;
}

/** Inscreve um ouvinte para mudanças na base; devolve a função de cancelamento. */
export function assinarBase(ouvinte: () => void): () => void {
  ouvintes.add(ouvinte);
  return () => {
    ouvintes.delete(ouvinte);
  };
}

function notificarMudanca(): void {
  versao += 1;
  ouvintes.forEach((o) => o());
}

export function carregarBase(): BaseDados {
  const ctx = g.__milsimProvedorBase?.obter();
  if (ctx) return ctx.base;
  if (memoria) return memoria;
  // No servidor, fora de uma unidade de trabalho, nunca compartilha dados entre requisições.
  if (noServidor()) return baseVazia();
  return snapshot;
}

/** Substitui o snapshot do cliente pela visão mais recente devolvida pela API. */
export function definirBaseCliente(base: BaseDados): void {
  snapshot = base;
  notificarMudanca();
}

/** Executa uma mutação. Só é permitida no servidor (ou na base em memória dos testes). */
export function mutarBase<T>(fn: (base: BaseDados) => T): T {
  const ctx = g.__milsimProvedorBase?.obter();
  if (ctx) return fn(ctx.base);
  if (memoria) {
    const r = fn(memoria);
    notificarMudanca();
    return r;
  }
  throw new ErroDominio("somente_servidor", "Esta operação precisa passar pela API do servidor.");
}

/** Testes: usa a base informada, em memória, no lugar do snapshot (null desliga). */
export function definirBaseEmMemoria(base: BaseDados | null): BaseDados | null {
  memoria = base;
  notificarMudanca();
  return memoria;
}

export function gerarId(prefixo: string): string {
  return `${prefixo}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export function gerarCodigo(prefixo: string): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 5; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return `${prefixo}-${s}`;
}

// Mantida por compatibilidade dos serviços: a latência real agora é a da rede.
export function latencia(_ms = 0): Promise<void> {
  return Promise.resolve();
}

export class ErroDominio extends Error {
  codigo: string;
  constructor(codigo: string, mensagem: string) {
    super(mensagem);
    this.codigo = codigo;
  }
}
