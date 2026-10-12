// Filtro regional do visitante, escolhido manualmente (sem geolocalização) e salvo no dispositivo.
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { storage } from "@/lib/storage";
import type { Abrangencia } from "@/lib/domain/types";
import { NACIONAL } from "@/lib/divulgacao";

interface Valor {
  local: Abrangencia;
  definirLocal: (a: Abrangencia) => void;
}

const CHAVE = "localizacao";
const g = globalThis as unknown as { __locCtx?: React.Context<Valor | null> };
const Ctx = (g.__locCtx ??= createContext<Valor | null>(null));

export function LocalizacaoProvider({ children }: { children: ReactNode }) {
  const [local, setLocal] = useState<Abrangencia>(NACIONAL);
  useEffect(() => {
    const salvo = storage.ler<Abrangencia>(CHAVE);
    if (salvo?.escopo) setLocal(salvo);
  }, []);
  const definirLocal = (a: Abrangencia) => {
    setLocal(a);
    storage.gravar(CHAVE, a);
  };
  return <Ctx.Provider value={{ local, definirLocal }}>{children}</Ctx.Provider>;
}

export function useLocalizacao(): Valor {
  return useContext(Ctx) ?? { local: NACIONAL, definirLocal: () => {} };
}
