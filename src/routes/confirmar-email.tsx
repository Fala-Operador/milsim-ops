import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { confirmarEmail } from "@/api/sessao.functions";
import { CHAVE_DESTINO_CONFIRMACAO, linkDaUrl, MSG_LINK_CONFIRMACAO_INVALIDO, type LinkConfirmacao } from "@/lib/confirmacaoEmail";
import { destinoDoLink, redirectSeguro } from "@/lib/links";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Campo, Spinner } from "@/components/ui";
import { ReenviarConfirmacao } from "@/components/ReenviarConfirmacao";
import { tr } from "@/i18n/routes/confirmar-email";

// Link do e-mail de confirmação de cadastro: ?token_hash=…&type=email (modelo próprio, vale em
// qualquer aparelho) ou ?code=… (modelo padrão do Supabase). Confirma, entra e segue.
export const Route = createFileRoute("/confirmar-email")({
  validateSearch: (s: Record<string, unknown>): {
    code?: string | undefined; token_hash?: string | undefined; type?: string | undefined; error_description?: string | undefined;
  } => ({
    code: typeof s["code"] === "string" ? s["code"] : undefined,
    token_hash: typeof s["token_hash"] === "string" ? s["token_hash"] : undefined,
    type: typeof s["type"] === "string" ? s["type"] : undefined,
    error_description: typeof s["error_description"] === "string" ? s["error_description"] : undefined,
  }),
  head: () => ({ meta: [{ title: tr("confirmar_e_mail_milsim_ops") }, { name: "robots", content: "noindex" }] }),
  component: PaginaConfirmar,
});

// O link é de uso único: se a página montar de novo, reaproveita a mesma validação.
const validacoes = new Map<string, Promise<unknown>>();
function validar(link: LinkConfirmacao): Promise<unknown> {
  const chave = "tokenHash" in link ? `t:${link.tokenHash}` : `c:${link.codigo}`;
  let p = validacoes.get(chave);
  if (!p) {
    p = confirmarEmail(link);
    validacoes.set(chave, p);
  }
  return p;
}

function destinoGuardado(): string {
  try {
    const d = localStorage.getItem(CHAVE_DESTINO_CONFIRMACAO);
    localStorage.removeItem(CHAVE_DESTINO_CONFIRMACAO);
    return redirectSeguro(d ?? undefined);
  } catch {
    return "/app";
  }
}

function PaginaConfirmar() {
  const busca = Route.useSearch();
  const navigate = useNavigate();
  const link = linkDaUrl(busca);
  const [estado, setEstado] = useState<"validando" | "ok" | "erro">(link ? "validando" : "erro");
  const [erro, setErro] = useState(link ? "" : MSG_LINK_CONFIRMACAO_INVALIDO());
  const [email, setEmail] = useState("");

  useEffect(() => {
    if (!link) return;
    let ativo = true;
    validar(link)
      .then(() => {
        if (!ativo) return;
        setEstado("ok");
        const destino = destinoGuardado();
        setTimeout(() => navigate({ ...destinoDoLink(destino) } as { to: string }), 1500);
      })
      .catch((e: unknown) => {
        if (!ativo) return;
        setEstado("erro");
        setErro(e instanceof Error ? e.message : MSG_LINK_CONFIRMACAO_INVALIDO());
      });
    return () => { ativo = false; };
  }, [link && ("tokenHash" in link ? link.tokenHash : link.codigo)]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <Card>
        <h1 className="font-display text-2xl font-semibold uppercase tracking-wide">{tr("confirmar_e_mail")}</h1>
        {estado === "validando" && <div className="mt-6"><Spinner texto={tr("confirmando_seu_e_mail")} /></div>}
        {estado === "ok" && (
          <div className="mt-4 space-y-3">
            <p role="status" className="flex items-center gap-2 text-success"><CheckCircle2 className="h-5 w-5" aria-hidden="true" />{" "}{tr("e_mail_confirmado_bem_vindo_ao")}</p>
            <p className="text-sm text-muted-foreground">{tr("voce_ja_esta_conectado_redirecionando")}</p>
            <Link to="/app"><Button className="w-full">{tr("ir_para_minha_area")}</Button></Link>
          </div>
        )}
        {estado === "erro" && (
          <div className="mt-4 space-y-4">
            <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">{erro}</p>
            <p className="text-sm text-muted-foreground">
              {tr("o_link_vale_por_1_hora")}{" "}
              <Link to="/login" search={{ redirect: undefined }} className="text-accent hover:underline">{tr("entrar")}</Link>{tr("para_receber_um_novo_link_informe")}</p>
            <Campo rotulo={tr("e_mail")} htmlFor="conf-email">
              <Input id="conf-email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </Campo>
            <ReenviarConfirmacao email={email} />
          </div>
        )}
      </Card>
    </div>
  );
}
