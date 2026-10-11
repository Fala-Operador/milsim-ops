// Repositório da base mockada: carrega, persiste e restaura a demonstração.
import { storage } from "@/lib/storage";
import { criarBaseInicial, VERSAO_BASE } from "@/data/seed";
import type { BaseDados } from "@/lib/domain/types";

const CHAVE = "base";

let cache: BaseDados | null = null;

export function carregarBase(): BaseDados {
  if (cache) return cache;
  const existente = storage.ler<BaseDados>(CHAVE);
  if (existente && existente.versao === VERSAO_BASE) {
    cache = existente;
    return cache;
  }
  // Inicializa somente quando ainda não existe (ou versão inválida)
  cache = criarBaseInicial();
  storage.gravar(CHAVE, cache);
  return cache;
}

export function salvarBase(base: BaseDados): void {
  cache = base;
  storage.gravar(CHAVE, base);
}

/** Restaura a base demonstrativa: limpa apenas os dados desta aplicação. */
export function restaurarBase(): BaseDados {
  storage.limparTudo();
  cache = criarBaseInicial();
  storage.gravar(CHAVE, cache);
  return cache;
}

/** Executa uma mutação na base e persiste. */
export function mutarBase<T>(fn: (base: BaseDados) => T): T {
  const base = carregarBase();
  const resultado = fn(base);
  salvarBase(base);
  return resultado;
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

// Simula latência de rede nos serviços mockados.
export function latencia(ms = 250): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export class ErroDominio extends Error {
  codigo: string;
  constructor(codigo: string, mensagem: string) {
    super(mensagem);
    this.codigo = codigo;
  }
}
