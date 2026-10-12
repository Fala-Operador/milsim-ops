import { useSyncExternalStore } from "react";
import { assinarBase, versaoBase } from "@/services/db";

/**
 * Número que muda toda vez que a base é salva.
 * Use como dependência de useMemo/useEffect para que a tela reflita a última escrita.
 */
export function useVersaoBase(): number {
  return useSyncExternalStore(assinarBase, versaoBase, versaoBase);
}
