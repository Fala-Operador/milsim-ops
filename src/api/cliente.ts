// Lado do navegador da API: aplica a visão devolvida por cada server function ao
// snapshot local (src/services/db.ts), que as telas leem de forma síncrona.
import { definirBaseCliente } from "@/services/db";
import type { Visao } from "@/lib/visao";

let usuarioId: string | null = null;
let carregada = false;
let versaoServidor = 0;

export function aplicarVisao(v: Visao): void {
  usuarioId = v.usuarioId;
  if (v.versao !== undefined) versaoServidor = v.versao;
  carregada = true;
  definirBaseCliente(v.base);
}

/** Id do usuário logado segundo a última visão recebida do servidor. */
export function usuarioIdDaVisao(): string | null {
  return usuarioId;
}

/** Versão da base (base_control) da última visão recebida; 0 antes da primeira. */
export function versaoDaVisao(): number {
  return versaoServidor;
}

export function visaoCarregada(): boolean {
  return carregada;
}

/** Aguarda a server function, aplica a visão nova e devolve só o resultado. */
export async function chamar<T>(resposta: Promise<{ resultado: T; visao: Visao }>): Promise<T> {
  const r = await resposta;
  aplicarVisao(r.visao);
  return r.resultado;
}
