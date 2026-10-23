import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { Usuario } from "@/lib/domain/types";
import type { DadosCadastro } from "@/services/auth";
import { carregarBase } from "@/services/db";
import { useVersaoBase } from "@/hooks/useVersaoBase";
import { usuarioIdDaVisao } from "@/api/cliente";
import { cadastrar, entrar, recarregarVisao, sair } from "@/api/sessao.functions";
import { encerrarStripeConnect } from "@/components/PaineisStripe";
import { iniciarTempoReal } from "@/services/tempoReal";

/** Estado da carga inicial da visão (dados do servidor). */
export type EstadoCarga = "carregando" | "pronto" | "erro";

interface AuthContextValue {
  usuario: Usuario | null;
  autenticado: boolean;
  carga: EstadoCarga;
  login: (email: string, senha: string, captcha?: string) => Promise<Usuario>;
  logout: () => Promise<void>;
  registrar: (dados: DadosCadastro, captcha?: string) => Promise<Usuario>;
  /** Busca a visão mais recente no servidor. */
  recarregar: () => Promise<void>;
  podeGerenciarEvento: (organizacaoId: string) => boolean;
}

// Mantém a mesma instância do contexto entre recarregamentos rápidos do editor.
const g = globalThis as unknown as { __authCtx?: React.Context<AuthContextValue | null> };
const AuthContext = (g.__authCtx ??= createContext<AuthContextValue | null>(null));

const INTERVALO_MINIMO_MS = 5000;

function usuarioDaVisao(): Usuario | null {
  const id = usuarioIdDaVisao();
  return (id && carregarBase().usuarios.find((u) => u.id === id)) || null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  // A sessão vive em cookies HTTP do Supabase Auth; o servidor diz quem está logado
  // em cada visão. O SSR não lê dados: a carga começa depois da montagem.
  useVersaoBase();
  const [carga, setCarga] = useState<EstadoCarga>("carregando");
  const ultimaCarga = useRef(0);
  const cargaRef = useRef(carga);
  cargaRef.current = carga;
  const usuario = carga === "pronto" ? usuarioDaVisao() : null;

  const recarregar = useCallback(async () => {
    ultimaCarga.current = Date.now();
    try {
      await recarregarVisao();
      setCarga("pronto");
    } catch (e) {
      // Já carregada (ex.: atualização ao voltar para a aba): segue com a visão atual.
      if (cargaRef.current === "pronto") {
        console.warn("Não foi possível atualizar os dados; seguindo com os já carregados.", e);
        return;
      }
      // Carga inicial: uma falha passageira (rede, Supabase oscilando) ganha mais uma tentativa.
      try {
        await new Promise((ok) => setTimeout(ok, 1500));
        await recarregarVisao();
        setCarga("pronto");
      } catch (e2) {
        console.error(e2);
        setCarga((c) => (c === "pronto" ? c : "erro"));
      }
    }
  }, []);

  useEffect(() => {
    void recarregar();
    // Ao voltar para a aba, atualiza com o que outras pessoas gravaram.
    const aoFocar = () => {
      if (Date.now() - ultimaCarga.current > INTERVALO_MINIMO_MS) void recarregar();
    };
    window.addEventListener("focus", aoFocar);
    return () => window.removeEventListener("focus", aoFocar);
  }, [recarregar]);

  // Tempo real: gravação de outra pessoa → busca a visão de novo.
  const pronto = carga === "pronto";
  useEffect(() => (pronto ? iniciarTempoReal(recarregar) : undefined), [pronto, recarregar]);

  const login = useCallback(async (email: string, senha: string, captcha?: string) => {
    await entrar(email, senha, captcha);
    const u = usuarioDaVisao();
    if (!u) throw new Error("Não foi possível carregar a conta.");
    return u;
  }, []);

  const logout = useCallback(async () => {
    await encerrarStripeConnect();
    await sair();
  }, []);

  const registrar = useCallback(async (dados: DadosCadastro, captcha?: string) => {
    await cadastrar(dados, captcha);
    const u = usuarioDaVisao();
    if (!u) throw new Error("Não foi possível carregar a conta.");
    return u;
  }, []);

  const podeGerenciarEvento = useCallback(
    (organizacaoId: string) => {
      if (!usuario) return false;
      if (usuario.perfil === "admin") return true;
      return usuario.perfil === "organizador" && usuario.organizacaoId === organizacaoId;
    },
    [usuario],
  );

  return (
    <AuthContext.Provider
      value={{ usuario, autenticado: !!usuario, carga, login, logout, registrar, recarregar, podeGerenciarEvento }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth() deve ser usado dentro de <AuthProvider>.");
  return ctx;
}
