// Evento selecionado compartilhado entre Inscritos, Comunidade e Financeiro.
// Guardado na sessão do navegador; sempre revalidado contra os eventos autorizados.
import { useEffect, useSyncExternalStore } from "react";
import type { Evento } from "@/lib/domain/types";

const CHAVE = "org:eventoSelecionado";
let atual = "";
const ouvintes = new Set<() => void>();

function ler() {
  return atual;
}
function assinar(fn: () => void) {
  ouvintes.add(fn);
  return () => ouvintes.delete(fn);
}
function definir(id: string) {
  atual = id;
  try {
    sessionStorage.setItem(CHAVE, id);
  } catch {
    /* sem armazenamento */
  }
  ouvintes.forEach((f) => f());
}

export function useEventoOrganizacao(eventosAutorizados: Evento[]) {
  const id = useSyncExternalStore(assinar, ler, () => "");
  useEffect(() => {
    if (!atual) {
      try {
        const salvo = sessionStorage.getItem(CHAVE);
        if (salvo) definir(salvo);
      } catch {
        /* ignora */
      }
    }
  }, []);
  // Revalida autorização: só aceita ids da lista do organizador logado.
  const efetivo = id && eventosAutorizados.some((e) => e.id === id) ? id : (eventosAutorizados[0]?.id ?? "");
  return [efetivo, definir] as const;
}
