// Lado do navegador da API: aplica a visão devolvida por cada server function ao
// snapshot local (src/services/db.ts), que as telas leem de forma síncrona.
import { definirBaseCliente } from "@/services/db";
import type { Visao } from "@/lib/visao";

let usuarioId: string | null = null;
let carregada = false;

export function aplicarVisao(v: Visao): void {
  usuarioId = v.usuarioId;
  carregada = true;
  definirBaseCliente(v.base);
}

/** Id do usuário logado segundo a última visão recebida do servidor. */
export function usuarioIdDaVisao(): string | null {
  return usuarioId;
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
