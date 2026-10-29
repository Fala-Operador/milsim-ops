// Persistência do check-in, separada em três camadas:
// 1) Base de referência (servidor) — tabela checkins no Supabase, lida pela visão da API.
// 2) Base offline do aparelho (ingressos baixados) — IndexedDB.
// 3) Registros locais + fila de sincronização — IndexedDB, gravados na mesma transação.
import { carregarBase } from "@/services/db";
import type { IngressoCredenciamento, RegistroCheckin } from "@/lib/checkin";
import { tr } from "@/i18n/services/checkinStore";

const NOME_DB = "milsim-checkin";

export interface SnapshotOffline {
  eventoId: string;
  atualizadoEm: string;
  ingressos: IngressoCredenciamento[];
  /** Tokens de outros eventos (apenas para avisar "ingresso de outro evento"). */
  tokensOutrosEventos: string[];
  registros: RegistroCheckin[];
}

// ---------- Base de referência (servidor) ----------
export function lerReferencia(): RegistroCheckin[] {
  return carregarBase().checkins;
}

// ---------- IndexedDB ----------
let dbPromise: Promise<IDBDatabase> | null = null;
export const idbDisponivel = () => typeof indexedDB !== "undefined";

function abrir(): Promise<IDBDatabase> {
  if (!idbDisponivel()) return Promise.reject(new Error(tr("indexeddb_indisponivel_neste_navegador")));
  dbPromise ??= new Promise((ok, falha) => {
    const req = indexedDB.open(NOME_DB, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      db.createObjectStore("snapshots", { keyPath: "eventoId" });
      db.createObjectStore("registros", { keyPath: "id" }).createIndex("eventoId", "eventoId");
      db.createObjectStore("fila", { keyPath: "id" });
    };
    req.onsuccess = () => ok(req.result);
    req.onerror = () => falha(req.error);
  });
  return dbPromise;
}

function concluir(tx: IDBTransaction): Promise<void> {
  return new Promise((ok, falha) => {
    tx.oncomplete = () => ok();
    tx.onerror = () => falha(tx.error);
    tx.onabort = () => falha(tx.error);
  });
}
function pedir<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((ok, falha) => {
    req.onsuccess = () => ok(req.result);
    req.onerror = () => falha(req.error);
  });
}

export async function salvarSnapshot(s: SnapshotOffline): Promise<void> {
  const tx = (await abrir()).transaction("snapshots", "readwrite");
  tx.objectStore("snapshots").put(s);
  await concluir(tx);
}
export async function lerSnapshot(eventoId: string): Promise<SnapshotOffline | undefined> {
  const tx = (await abrir()).transaction("snapshots");
  return pedir(tx.objectStore("snapshots").get(eventoId));
}

/** Grava a presença e a operação pendente na MESMA transação. */
export async function registrarLocal(reg: RegistroCheckin): Promise<void> {
  const tx = (await abrir()).transaction(["registros", "fila"], "readwrite");
  tx.objectStore("registros").put(reg);
  tx.objectStore("fila").put({ id: reg.id });
  await concluir(tx);
}

/** Atualiza o status do registro e, se resolvido, tira da fila — também numa transação. */
export async function atualizarOperacao(reg: RegistroCheckin, sairDaFila: boolean): Promise<void> {
  const tx = (await abrir()).transaction(["registros", "fila"], "readwrite");
  tx.objectStore("registros").put(reg);
  if (sairDaFila) tx.objectStore("fila").delete(reg.id);
  await concluir(tx);
}

export async function listarRegistrosLocais(eventoId?: string): Promise<RegistroCheckin[]> {
  const tx = (await abrir()).transaction("registros");
  const store = tx.objectStore("registros");
  return pedir(eventoId ? store.index("eventoId").getAll(eventoId) : store.getAll()) as Promise<RegistroCheckin[]>;
}

export async function listarFila(): Promise<RegistroCheckin[]> {
  const db = await abrir();
  const tx = db.transaction(["fila", "registros"]);
  const ids = (await pedir(tx.objectStore("fila").getAll())) as { id: string }[];
  const regs = await Promise.all(ids.map((i) => pedir(tx.objectStore("registros").get(i.id))));
  return (regs.filter(Boolean) as RegistroCheckin[]).sort((a, b) => a.em.localeCompare(b.em));
}
