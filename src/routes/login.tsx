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
import { tr } from "@/i18n/routes/login";

export const Route = createFileRoute("/login")({
  // ?google=…: aviso da volta do Google que não abriu a sessão (src/routes/entrar-google.tsx).
  validateSearch: (s: Record<string, unknown>): { redirect?: string | undefined; google?: AvisoLoginGoogle | undefined } => ({
    redirect: typeof s["redirect"] === "string" ? s["redirect"] : undefined,
    google: typeof s["google"] === "string" && s["google"] in AVISOS_LOGIN_GOOGLE ? (s["google"] as AvisoLoginGoogle) : undefined,
  }),
  head: () => ({
    meta: [
      { title: tr("entrar_milsim_ops") },
      { name: "description", content: tr("acesse_sua_conta_na_plataforma_de") },
      { property: "og:title", content: tr("entrar_milsim_ops") },
      { property: "og:description", content: tr("acesse_sua_conta") },
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
      setErro(err instanceof Error ? err.message : tr("falha_ao_entrar"));
      turnstile.resetar();
    } finally {
      setCarregando(false);
    }
  };

  return (
    <LayoutAcesso titulo={tr("entrar")} subtitulo={tr("use_a_sua_conta_google_ou")} rotulo={tr("ingresso_qr_code_check_in")} frase={tr("seu_ingresso_e_o_briefing_da")}>
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
          <Campo rotulo={tr("e_mail")} htmlFor="email" erro={erro && undefined}>
            <Input
              id="email"
              type="text"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </Campo>
          <Campo rotulo={tr("senha")} htmlFor="senha">
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
          {erro === MSG_EMAIL_NAO_CONFIRMADO() && <ReenviarConfirmacao email={email} />}
          {turnstile.elemento}
          <Button type="submit" disabled={carregando || !turnstile.pronto} size="lg" className="w-full">
            {carregando ? tr("entrando") : tr("entrar")}
          </Button>
        </form>
        <div className="mt-4 flex justify-between text-sm">
          <Link to="/recuperar-senha" className="text-accent hover:underline">
            {tr("esqueci_a_senha")}</Link>
          <Link
            to="/cadastro"
            search={{ redirect }}
            className="text-accent hover:underline"
          >
            {tr("criar_cadastro")}</Link>
        </div>
    </LayoutAcesso>
  );
}
