import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { concluirLoginGoogle } from "@/api/sessao.functions";
import { CHAVE_DESTINO_GOOGLE, MSG_GOOGLE_FALHOU } from "@/lib/loginGoogle";
import { destinoDoLink, redirectSeguro } from "@/lib/links";
import { Card } from "@/components/ui/card";
import { Spinner } from "@/components/ui";

// Retorno do Google (?code=… ou ?error=…). Abre a sessão; conta nova vai completar o cadastro.
export const Route = createFileRoute("/entrar-google")({
  validateSearch: (s: Record<string, unknown>): { code?: string | undefined; error?: string | undefined } => ({
    code: typeof s["code"] === "string" ? s["code"] : undefined,
    error: typeof s["error"] === "string" ? s["error"] : undefined,
  }),
  head: () => ({ meta: [{ title: "Entrar com o Google — MilSim Ops" }, { name: "robots", content: "noindex" }] }),
  component: PaginaRetornoGoogle,
});

// O código é de uso único: se a página montar de novo, reaproveita a mesma troca.
const trocas = new Map<string, ReturnType<typeof concluirLoginGoogle>>();

function destinoGuardado(): string {
  try {
    const d = localStorage.getItem(CHAVE_DESTINO_GOOGLE);
    localStorage.removeItem(CHAVE_DESTINO_GOOGLE);
    return redirectSeguro(d ?? undefined);
  } catch {
    return "/app";
  }
}

function PaginaRetornoGoogle() {
  const { code, error } = Route.useSearch();
  const navigate = useNavigate();
  // error=access_denied: a pessoa cancelou na tela do Google.
  const [erro, setErro] = useState(
    code ? "" : error === "access_denied" ? "Login com o Google cancelado." : MSG_GOOGLE_FALHOU,
  );

  useEffect(() => {
    if (!code) return;
    let ativo = true;
    let troca = trocas.get(code);
    if (!troca) {
      troca = concluirLoginGoogle(code);
      trocas.set(code, troca);
    }
    troca
      .then(({ precisaCompletar }) => {
        if (!ativo) return;
        const destino = destinoGuardado();
        if (precisaCompletar) {
          navigate({ to: "/cadastro", search: { redirect: destino, completar: "google" }, replace: true });
        } else {
          navigate({ ...destinoDoLink(destino), replace: true } as { to: string });
        }
      })
      .catch((e: unknown) => {
        if (ativo) setErro(e instanceof Error ? e.message : MSG_GOOGLE_FALHOU);
      });
    return () => { ativo = false; };
  }, [code, navigate]);

  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <Card>
        <h1 className="font-display text-2xl font-semibold uppercase tracking-wide">Entrar com o Google</h1>
        {erro ? (
          <div className="mt-4 space-y-4">
            <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">{erro}</p>
            <Link to="/login" search={{ redirect: undefined }} className="text-sm text-accent hover:underline">Voltar para o login</Link>
          </div>
        ) : (
          <div className="mt-6"><Spinner texto="Entrando..." /></div>
        )}
      </Card>
    </div>
  );
}
