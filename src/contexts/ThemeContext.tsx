// Regras de tema: visitante sempre escuro; conta autenticada usa a própria preferência (padrão escuro).
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { definirTemaDaConta, temaDaConta } from "@/services/aparencia";
import { temaEfetivo, type Tema } from "@/lib/localizacao";

interface ThemeContextValue {
  tema: Tema;
  /** Só pode alterar quem está autenticado. */
  podeAlterar: boolean;
  definirTema: (t: Tema) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

/** Script executado antes da primeira pintura (lê sessão e preferência da conta). */
export const SCRIPT_TEMA_INICIAL = `try{var p="milsim-demo:",s=JSON.parse(localStorage.getItem(p+"sessao")||"null"),t="dark";if(s){var b=JSON.parse(localStorage.getItem(p+"base")||"null");var u=b&&b.usuarios&&b.usuarios.find(function(x){return x.id===s});if(u&&u.tema==="light")t="light"}document.documentElement.classList.toggle("dark",t==="dark")}catch(_){document.documentElement.classList.add("dark")}`;

export function ThemeProvider({ children }: { children: ReactNode }) {
  const { usuario } = useAuth();
  const [preferencia, setPreferencia] = useState<Tema | undefined>(undefined);

  useEffect(() => {
    setPreferencia(usuario ? temaDaConta(usuario.id) : undefined);
  }, [usuario]);

  const tema = temaEfetivo(!!usuario, preferencia);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", tema === "dark");
  }, [tema]);

  const definirTema = (t: Tema) => {
    if (!usuario) return;
    setPreferencia(t);
    definirTemaDaConta(usuario.id, t);
  };

  return (
    <ThemeContext.Provider value={{ tema, podeAlterar: !!usuario, definirTema }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme() deve ser usado dentro de <ThemeProvider>.");
  return ctx;
}
