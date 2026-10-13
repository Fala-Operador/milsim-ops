// Base demonstrativa em memória para testes das regras (sem Supabase).
import { criarBaseInicial } from "@/data/seed";
import { definirBaseEmMemoria } from "@/services/db";
import type { BaseDados } from "@/lib/domain/types";

/** Recria a base demonstrativa em memória; os serviços passam a ler e mutar essa base. */
export function restaurarBase(): BaseDados {
  return definirBaseEmMemoria(criarBaseInicial())!;
}
