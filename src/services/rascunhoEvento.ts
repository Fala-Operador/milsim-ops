// Rascunhos do editor de eventos guardados no dispositivo (IndexedDB):
// - etapa atual de qualquer evento;
// - alterações de eventos já publicados, mantidas separadas dos dados públicos
//   até "Salvar alterações".
import type { Evento } from "@/lib/domain/types";
import { tr } from "@/i18n/services/rascunhoEvento";

export interface RascunhoLocal {
  eventoId: string;
  etapa: number;
  evento?: Evento | undefined;
  salvoEm: string;
}

const BANCO = "milsim-editor-eventos";
const LOJA = "rascunhos";

function abrir(): Promise<IDBDatabase> {
  return new Promise((ok, falha) => {
    const req = indexedDB.open(BANCO, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(LOJA, { keyPath: "eventoId" });
    req.onsuccess = () => ok(req.result);
    req.onerror = () => falha(req.error ?? new Error(tr("armazenamento_local_indisponivel")));
  });
}

async function operar<T>(modo: IDBTransactionMode, fn: (loja: IDBObjectStore) => IDBRequest): Promise<T> {
  const db = await abrir();
  try {
    return await new Promise<T>((ok, falha) => {
      const tx = db.transaction(LOJA, modo);
      const req = fn(tx.objectStore(LOJA));
      tx.oncomplete = () => ok(req.result as T);
      tx.onerror = () => falha(tx.error ?? new Error(tr("falha_no_armazenamento_local")));
    });
  } finally {
    db.close();
  }
}

export async function lerRascunhoLocal(eventoId: string): Promise<RascunhoLocal | undefined> {
  try {
    return await operar<RascunhoLocal | undefined>("readonly", (l) => l.get(eventoId));
  } catch {
    return undefined;
  }
}

export function salvarRascunhoLocal(r: Omit<RascunhoLocal, "salvoEm">): Promise<unknown> {
  return operar("readwrite", (l) => l.put({ ...r, salvoEm: new Date().toISOString() }));
}

export async function apagarRascunhoLocal(eventoId: string): Promise<void> {
  try {
    await operar("readwrite", (l) => l.delete(eventoId));
  } catch {
    /* sem armazenamento local */
  }
}
