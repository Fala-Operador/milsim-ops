import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Botao, Campo, Cartao, Entrada } from "@/components/ui";

export const Route = createFileRoute("/login")({
  validateSearch: (s: Record<string, unknown>) => ({
    redirect: typeof s["redirect"] === "string" ? s["redirect"] : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Entrar — MilSim Ops" },
      { name: "description", content: "Acesse sua conta na plataforma de eventos de simulação militar." },
      { property: "og:title", content: "Entrar — MilSim Ops" },
      { property: "og:description", content: "Acesse sua conta. Ambiente de demonstração." },
    ],
  }),
  component: PaginaLogin,
});

function PaginaLogin() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const { redirect } = useSearch({ from: "/login" });
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(false);

  const aoEnviar = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro("");
    setCarregando(true);
    try {
      await login(email, senha);
      navigate({ to: redirect ?? "/app" });
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Falha ao entrar.");
    } finally {
      setCarregando(false);
    }
  };

  return (
    <div className="mx-auto flex max-w-md flex-col px-4 py-12">
      <Cartao>
        <h1 className="font-display text-2xl font-semibold uppercase tracking-wide">Entrar</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Contas demonstrativas: admin@admin / admin@123 · usuario@teste.com.br / user@123 ·
          organizador@teste.com.br / organizador@123
        </p>
        <form onSubmit={aoEnviar} className="mt-5 space-y-4">
          <Campo rotulo="E-mail" htmlFor="email" erro={erro && undefined}>
            <Entrada
              id="email"
              type="text"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </Campo>
          <Campo rotulo="Senha" htmlFor="senha">
            <Entrada
              id="senha"
              type="password"
              autoComplete="current-password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              required
            />
          </Campo>
          {erro && (
            <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {erro}
            </p>
          )}
          <Botao type="submit" disabled={carregando} className="w-full">
            {carregando ? "Entrando..." : "Entrar"}
          </Botao>
        </form>
        <div className="mt-4 flex justify-between text-sm">
          <Link to="/recuperar-senha" className="text-accent hover:underline">
            Esqueci a senha
          </Link>
          <Link
            to="/cadastro"
            search={{ redirect }}
            className="text-accent hover:underline"
          >
            Criar cadastro
          </Link>
        </div>
      </Cartao>
    </div>
  );
}
