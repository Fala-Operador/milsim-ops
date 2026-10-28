// Idioma e textos fixos do site para os componentes. Os textos vêm do loader da rota raiz
// (já no HTML do servidor); páginas com textos próprios (documentos legais) somam os seus.
import { createContext, useCallback, useContext, useMemo, type ReactNode } from "react";
import { useNavigate, useRouter } from "@tanstack/react-router";
import { definirIdiomaFn } from "@/api/textos.functions";
import { criarTradutor, type Idioma, type Textos, type Traduzir } from "@/lib/i18n";

interface IdiomaContextValue {
  idioma: Idioma;
  textos: Textos;
  t: Traduzir;
  trocarIdioma: (idioma: Idioma) => Promise<void>;
}

const g = globalThis as unknown as { __idiomaCtx?: React.Context<IdiomaContextValue | null> };
const IdiomaContext = (g.__idiomaCtx ??= createContext<IdiomaContextValue | null>(null));

export function IdiomaProvider({ idioma, textos, children }: { idioma: Idioma; textos: Textos; children: ReactNode }) {
  const router = useRouter();
  const navigate = useNavigate();
  const trocarIdioma = useCallback(async (novo: Idioma) => {
    await definirIdiomaFn({ data: { idioma: novo } });
    // Tira o ?lang da URL (senão ele venceria o cookie) e recarrega os textos das rotas.
    await navigate({ to: ".", search: (s: Record<string, unknown>) => ({ ...s, lang: undefined }), replace: true } as never);
    await router.invalidate();
  }, [navigate, router]);
  const valor = useMemo(() => ({ idioma, textos, t: criarTradutor(textos), trocarIdioma }), [idioma, textos, trocarIdioma]);
  return <IdiomaContext.Provider value={valor}>{children}</IdiomaContext.Provider>;
}

export function useIdioma(): IdiomaContextValue {
  const ctx = useContext(IdiomaContext);
  if (!ctx) throw new Error("useIdioma precisa estar dentro de IdiomaProvider");
  return ctx;
}

/** Tradutor com os textos comuns mais os textos próprios da página. */
export function useTradutor(proprios?: Textos): Traduzir {
  const { textos } = useIdioma();
  return useMemo(() => criarTradutor(proprios ? { ...textos, ...proprios } : textos), [textos, proprios]);
}
