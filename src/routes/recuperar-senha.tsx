import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { definirNovaSenha, recuperarSenha, trocarCodigoRecuperacao, validarTokenRecuperacao } from "@/api/sessao.functions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Campo, Spinner } from "@/components/ui";

export const Route = createFileRoute("/recuperar-senha")({
  // O e-mail de recuperação (supabase/templates/recuperar-senha.html) volta para esta página com
  // ?token_hash=…&type=recovery; links antigos (template padrão do Supabase) chegam com ?code=….
  validateSearch: (s: Record<string, unknown>): {
    code?: string | undefined; token_hash?: string | undefined; type?: string | undefined; error_description?: string | undefined;
  } => ({
    code: typeof s["code"] === "string" ? s["code"] : undefined,
    token_hash: typeof s["token_hash"] === "string" ? s["token_hash"] : undefined,
    type: typeof s["type"] === "string" ? s["type"] : undefined,
    error_description: typeof s["error_description"] === "string" ? s["error_description"] : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Recuperar senha — MilSim Ops" },
      { name: "description", content: "Receba um link por e-mail para redefinir a sua senha." },
      { property: "og:title", content: "Recuperar senha — MilSim Ops" },
      { property: "og:description", content: "Redefinição de senha." },
    ],
  }),
  component: PaginaRecuperar,
});

function PaginaRecuperar() {
  const { code, token_hash, type, error_description } = Route.useSearch();
  const link = token_hash && (!type || type === "recovery") ? { tokenHash: token_hash } : code ? { codigo: code } : null;
  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <Card>
        <h1 className="font-display text-2xl font-semibold uppercase tracking-wide">Recuperar senha</h1>
        {link ? <NovaSenha link={link} /> : <PedirLink erroLink={error_description} />}
        <p className="mt-4 text-sm">
          <Link to="/login" search={{ redirect: undefined }} className="text-accent hover:underline">Voltar ao login</Link>
        </p>
      </Card>
    </div>
  );
}

function PedirLink({ erroLink }: { erroLink?: string | undefined }) {
  const [email, setEmail] = useState("");
  const [enviado, setEnviado] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState(erroLink ? "O link de recuperação é inválido ou expirou. Solicite um novo." : "");

  const aoEnviar = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro("");
    setEnviando(true);
    try {
      await recuperarSenha(email);
      setEnviado(true);
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Falha ao processar.");
    } finally {
      setEnviando(false);
    }
  };

  if (enviado) {
    return (
      <p className="mt-4 rounded-md border border-success/40 bg-success/10 px-3 py-2 text-sm text-success">
        Se houver uma conta com este e-mail, enviamos um link para redefinir a senha. Confira também a caixa de spam.
      </p>
    );
  }
  return (
    <form onSubmit={aoEnviar} className="mt-4 space-y-4">
      <Campo rotulo="E-mail" htmlFor="email" erro={erro || undefined}>
        <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      </Campo>
      <Button type="submit" className="w-full" disabled={enviando}>{enviando ? "Enviando..." : "Enviar link de recuperação"}</Button>
    </form>
  );
}

/** Link do e-mail: token_hash (template atual, qualquer aparelho) ou code (PKCE, links antigos). */
type LinkRecuperacao = { tokenHash: string } | { codigo: string };

// O link é de uso único: se a página montar de novo, reaproveita a mesma validação em vez de
// gastar o token uma segunda vez (o que daria "link inválido" mesmo com a sessão já aberta).
const validacoes = new Map<string, Promise<void>>();
function validarLink(link: LinkRecuperacao): Promise<void> {
  const chave = "tokenHash" in link ? `t:${link.tokenHash}` : `c:${link.codigo}`;
  let p = validacoes.get(chave);
  if (!p) {
    p = "tokenHash" in link ? validarTokenRecuperacao(link.tokenHash) : trocarCodigoRecuperacao(link.codigo);
    validacoes.set(chave, p);
  }
  return p;
}

function NovaSenha({ link }: { link: LinkRecuperacao }) {
  const navigate = useNavigate();
  const [estado, setEstado] = useState<"validando" | "pronto" | "invalido">("validando");
  const [senha, setSenha] = useState("");
  const [confirmacao, setConfirmacao] = useState("");
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);

  const chave = "tokenHash" in link ? link.tokenHash : link.codigo;
  useEffect(() => {
    validarLink(link)
      .then(() => setEstado("pronto"))
      .catch((e) => {
        setErro(e instanceof Error ? e.message : "Link inválido.");
        setEstado("invalido");
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chave]);

  const aoSalvar = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro("");
    if (senha !== confirmacao) return setErro("A confirmação de senha não confere.");
    setSalvando(true);
    try {
      await definirNovaSenha(senha);
      navigate({ to: "/app" });
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Falha ao salvar a senha.");
      setSalvando(false);
    }
  };

  if (estado === "validando") return <div className="mt-4"><Spinner texto="Validando o link..." /></div>;
  if (estado === "invalido") {
    return (
      <p role="alert" className="mt-4 text-sm text-destructive">
        {erro} <Link to="/recuperar-senha" search={{}} className="text-accent hover:underline">Solicitar novo link</Link>
      </p>
    );
  }
  return (
    <form onSubmit={aoSalvar} className="mt-4 space-y-4">
      <Campo rotulo="Nova senha" htmlFor="senha">
        <Input id="senha" type="password" autoComplete="new-password" value={senha} onChange={(e) => setSenha(e.target.value)} required />
      </Campo>
      <Campo rotulo="Confirme a nova senha" htmlFor="confirmacao" erro={erro || undefined}>
        <Input id="confirmacao" type="password" autoComplete="new-password" value={confirmacao} onChange={(e) => setConfirmacao(e.target.value)} required />
      </Campo>
      <Button type="submit" className="w-full" disabled={salvando}>{salvando ? "Salvando..." : "Salvar nova senha"}</Button>
    </form>
  );
}
