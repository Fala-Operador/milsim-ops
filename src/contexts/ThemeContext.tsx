// Regras de tema: visitante sempre escuro; conta autenticada usa a própria preferência (padrão escuro).
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { definirTema as salvarTemaNaConta } from "@/api/conta.functions";
import { storage } from "@/lib/storage";
import { temaEfetivo, type Tema } from "@/lib/localizacao";

interface ThemeContextValue {
  tema: Tema;
  /** Só pode alterar quem está autenticado. */
  podeAlterar: boolean;
  definirTema: (t: Tema) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

/**
 * Cópia local do tema da conta logada, lida pelo script de pré-pintura.
 * Removida ao sair: visitantes (e a próxima conta) nunca herdam o tema de outra pessoa.
 */
const CHAVE_TEMA_CONTA = "tema-conta";

/** Script executado antes da primeira pintura (mesma regra de temaEfetivo). */
export const SCRIPT_TEMA_INICIAL = `try{var t=JSON.parse(localStorage.getItem("milsim-demo:${CHAVE_TEMA_CONTA}")||"null");document.documentElement.classList.toggle("dark",t!=="light")}catch(_){document.documentElement.classList.add("dark")}`;

export function ThemeProvider({ children }: { children: ReactNode }) {
  // Tolerante à ausência do provedor (ex.: recarga parcial durante a edição): trata como visitante.
  let auth: ReturnType<typeof useAuth> | null = null;
  try { auth = useAuth(); } catch { auth = null; }
  const usuario = auth?.usuario ?? null;
  const carregando = auth?.carga === "carregando";
  const [escolhaLocal, setEscolhaLocal] = useState<Tema | undefined>(undefined);

  // A conta é a fonte da verdade; a escolha local só cobre o intervalo até a API responder.
  const preferencia = usuario ? (escolhaLocal ?? usuario.tema) : undefined;
  const tema = temaEfetivo(!!usuario, preferencia);

  useEffect(() => setEscolhaLocal(undefined), [usuario?.id]);

  useEffect(() => {
    if (carregando) return; // mantém o tema da pré-pintura até saber quem está logado
    document.documentElement.classList.toggle("dark", tema === "dark");
    try {
      if (usuario) storage.gravar(CHAVE_TEMA_CONTA, tema);
      else storage.remover(CHAVE_TEMA_CONTA);
    } catch {
      /* sem armazenamento: só perde a pré-pintura */
    }
  }, [tema, usuario, carregando]);

  const definirTema = (t: Tema) => {
    if (!usuario) return;
    setEscolhaLocal(t);
    void salvarTemaNaConta(t).catch(() => setEscolhaLocal(undefined));
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
