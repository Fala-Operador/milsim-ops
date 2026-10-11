import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import type { Usuario } from "@/lib/domain/types";
import { entrar, sair, usuarioDaSessao, cadastrar, type DadosCadastro } from "@/services/auth";

interface AuthContextValue {
  usuario: Usuario | null;
  autenticado: boolean;
  login: (email: string, senha: string) => Promise<Usuario>;
  logout: () => void;
  registrar: (dados: DadosCadastro) => Promise<Usuario>;
  recarregar: () => void;
  podeGerenciarEvento: (organizacaoId: string) => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(() => usuarioDaSessao());

  const login = useCallback(async (email: string, senha: string) => {
    const u = await entrar(email, senha);
    setUsuario(u);
    return u;
  }, []);

  const logout = useCallback(() => {
    sair();
    setUsuario(null);
  }, []);

  const registrar = useCallback(async (dados: DadosCadastro) => {
    const u = await cadastrar(dados);
    setUsuario(u);
    return u;
  }, []);

  const recarregar = useCallback(() => {
    setUsuario(usuarioDaSessao());
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
      value={{ usuario, autenticado: !!usuario, login, logout, registrar, recarregar, podeGerenciarEvento }}
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
