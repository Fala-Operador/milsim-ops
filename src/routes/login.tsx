import { destinoDoLink, redirectSeguro } from "@/lib/links";
import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { InputSenha } from "@/components/ui/input-senha";
import { Campo } from "@/components/ui";
import { LayoutAcesso } from "@/components/LayoutAcesso";
import { useTurnstile } from "@/components/Turnstile";
import { ReenviarConfirmacao } from "@/components/ReenviarConfirmacao";
import { MSG_EMAIL_NAO_CONFIRMADO } from "@/lib/confirmacaoEmail";
import { EntrarComGoogle, SeparadorOu } from "@/components/EntrarComGoogle";
import { AVISOS_LOGIN_GOOGLE, type AvisoLoginGoogle } from "@/lib/loginGoogle";

export const Route = createFileRoute("/login")({
  // ?google=…: aviso da volta do Google que não abriu a sessão (src/routes/entrar-google.tsx).
  validateSearch: (s: Record<string, unknown>): { redirect?: string | undefined; google?: AvisoLoginGoogle | undefined } => ({
    redirect: typeof s["redirect"] === "string" ? s["redirect"] : undefined,
    google: typeof s["google"] === "string" && s["google"] in AVISOS_LOGIN_GOOGLE ? (s["google"] as AvisoLoginGoogle) : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Entrar — MilSim Ops" },
      { name: "description", content: "Acesse sua conta na plataforma de eventos de simulação militar." },
      { property: "og:title", content: "Entrar — MilSim Ops" },
      { property: "og:description", content: "Acesse sua conta." },
    ],
  }),
  component: PaginaLogin,
});

function PaginaLogin() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const { redirect, google } = useSearch({ from: "/login" });
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(false);
  const turnstile = useTurnstile("login");

  const aoEnviar = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro("");
    setCarregando(true);
    try {
      await login(email, senha, turnstile.token);
      navigate({ ...destinoDoLink(redirectSeguro(redirect)) } as { to: string });
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Falha ao entrar.");
      turnstile.resetar();
    } finally {
      setCarregando(false);
    }
  };

  return (
    <LayoutAcesso titulo="Entrar" subtitulo="Use a sua conta Google ou o e-mail da sua conta MilsimOps." rotulo="Ingresso · QR Code · Check-in" frase="Seu ingresso e o briefing da operação no mesmo lugar.">
        <div className="mt-6 space-y-4">
          {google && (
            <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {AVISOS_LOGIN_GOOGLE[google]}
            </p>
          )}
          <EntrarComGoogle redirect={redirect} />
          <SeparadorOu />
        </div>
        <form onSubmit={aoEnviar} className="mt-4 space-y-4">
          <Campo rotulo="E-mail" htmlFor="email" erro={erro && undefined}>
            <Input
              id="email"
              type="text"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </Campo>
          <Campo rotulo="Senha" htmlFor="senha">
            <InputSenha
              id="senha"
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
          {erro === MSG_EMAIL_NAO_CONFIRMADO && <ReenviarConfirmacao email={email} />}
          {turnstile.elemento}
          <Button type="submit" disabled={carregando || !turnstile.pronto} size="lg" className="w-full">
            {carregando ? "Entrando..." : "Entrar"}
          </Button>
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
    </LayoutAcesso>
  );
}
