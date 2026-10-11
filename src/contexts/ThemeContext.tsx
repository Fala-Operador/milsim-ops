import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { storage } from "@/lib/storage";

export type PreferenciaTema = "dark" | "light" | "system";
export type TemaEfetivo = "dark" | "light";

interface ThemeContextValue {
  preferencia: PreferenciaTema;
  tema: TemaEfetivo;
  definirPreferencia: (p: PreferenciaTema) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);
const CHAVE = "tema";

function temaDoSistema(): TemaEfetivo {
  if (typeof window === "undefined" || !window.matchMedia) return "dark";
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preferencia, setPreferencia] = useState<PreferenciaTema>(
    () => storage.ler<PreferenciaTema>(CHAVE) ?? "system",
  );
  const [temaSistema, setTemaSistema] = useState<TemaEfetivo>(temaDoSistema);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: light)");
    const ouvinte = () => setTemaSistema(mq.matches ? "light" : "dark");
    mq.addEventListener("change", ouvinte);
    return () => mq.removeEventListener("change", ouvinte);
  }, []);

  const tema: TemaEfetivo = preferencia === "system" ? temaSistema : preferencia;

  useEffect(() => {
    document.documentElement.classList.toggle("dark", tema === "dark");
  }, [tema]);

  const definirPreferencia = (p: PreferenciaTema) => {
    setPreferencia(p);
    storage.gravar(CHAVE, p);
  };

  return (
    <ThemeContext.Provider value={{ preferencia, tema, definirPreferencia }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme() deve ser usado dentro de <ThemeProvider>.");
  return ctx;
}
