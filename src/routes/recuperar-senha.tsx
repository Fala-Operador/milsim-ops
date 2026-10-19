import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { definirNovaSenha, recuperarSenha, trocarCodigoRecuperacao, validarTokenRecuperacao } from "@/api/sessao.functions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Campo, Spinner } from "@/components/ui";
import { Check, CheckCircle2, Circle, Eye, EyeOff, ShieldAlert } from "lucide-react";
import { SENHA_MINIMA } from "@/services/auth";

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
        <h1 className="font-display text-2xl font-semibold uppercase tracking-wide">{link ? "Criar nova senha" : "Recuperar senha"}</h1>
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
  const [estado, setEstado] = useState<"validando" | "pronto" | "invalido" | "concluido">("validando");
  const [senha, setSenha] = useState("");
  const [confirmacao, setConfirmacao] = useState("");
  const [mostrar, setMostrar] = useState(false);
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);

  const chave = "tokenHash" in link ? link.tokenHash : link.codigo;
  useEffect(() => {
    validarLink(link)
      .then(() => setEstado("pronto"))
      .catch(() => setEstado("invalido"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chave]);

  const tamanhoOk = senha.length >= SENHA_MINIMA;
  const iguais = senha.length > 0 && senha === confirmacao;

  const aoSalvar = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro("");
    if (!tamanhoOk) return setErro(`A senha deve ter ao menos ${SENHA_MINIMA} caracteres.`);
    if (!iguais) return setErro("A confirmação de senha não confere.");
    setSalvando(true);
    try {
      await definirNovaSenha(senha);
      setEstado("concluido");
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Falha ao salvar a senha.");
    } finally {
      setSalvando(false);
    }
  };

  if (estado === "validando") return <div className="mt-4"><Spinner texto="Validando o link do e-mail..." /></div>;

  if (estado === "invalido") {
    return (
      <div className="mt-4 space-y-4" role="alert">
        <div className="flex gap-3 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm">
          <ShieldAlert className="mt-0.5 size-5 shrink-0 text-destructive" aria-hidden="true" />
          <div>
            <p className="font-medium text-destructive">Este link não vale mais</p>
            <p className="mt-1 text-muted-foreground">
              O link de redefinição vale por 1 hora e só pode ser usado uma vez. Peça um novo e use o e-mail mais recente.
            </p>
          </div>
        </div>
        <Button asChild className="w-full">
          <Link to="/recuperar-senha" search={{}}>Pedir um novo link</Link>
        </Button>
      </div>
    );
  }

  if (estado === "concluido") {
    return (
      <div className="mt-4 space-y-4" role="status">
        <div className="flex gap-3 rounded-md border border-success/40 bg-success/10 p-3 text-sm">
          <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-success" aria-hidden="true" />
          <div>
            <p className="font-medium text-success">Senha alterada</p>
            <p className="mt-1 text-muted-foreground">Sua nova senha já está valendo e você já entrou na sua conta.</p>
          </div>
        </div>
        <Button className="w-full" onClick={() => navigate({ to: "/app" })}>Ir para minha conta</Button>
      </div>
    );
  }

  const Olho = mostrar ? EyeOff : Eye;
  return (
    <form onSubmit={aoSalvar} className="mt-4 space-y-4" noValidate>
      <p className="text-sm text-muted-foreground">Escolha uma nova senha para a sua conta. Depois de salvar, você entra direto.</p>
      <Campo rotulo="Nova senha" htmlFor="senha">
        <div className="relative">
          <Input
            id="senha"
            type={mostrar ? "text" : "password"}
            autoComplete="new-password"
            autoFocus
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            aria-describedby="requisitos-senha"
            className="pr-11"
          />
          <button
            type="button"
            onClick={() => setMostrar((m) => !m)}
            aria-label={mostrar ? "Ocultar senha" : "Mostrar senha"}
            aria-pressed={mostrar}
            className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
          >
            <Olho className="size-4" aria-hidden="true" />
          </button>
        </div>
      </Campo>
      <Campo rotulo="Confirme a nova senha" htmlFor="confirmacao">
        <Input
          id="confirmacao"
          type={mostrar ? "text" : "password"}
          autoComplete="new-password"
          value={confirmacao}
          onChange={(e) => setConfirmacao(e.target.value)}
        />
      </Campo>
      <ul id="requisitos-senha" className="space-y-1 text-sm" aria-live="polite">
        <Requisito ok={tamanhoOk}>Pelo menos {SENHA_MINIMA} caracteres</Requisito>
        <Requisito ok={iguais}>As duas senhas são iguais</Requisito>
      </ul>
      {erro && <p role="alert" className="text-sm text-destructive">{erro}</p>}
      <Button type="submit" className="w-full" disabled={salvando || !tamanhoOk || !iguais}>
        {salvando ? "Salvando..." : "Salvar nova senha"}
      </Button>
    </form>
  );
}

function Requisito({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  const Icone = ok ? Check : Circle;
  return (
    <li className={`flex items-center gap-2 ${ok ? "text-success" : "text-muted-foreground"}`}>
      <Icone className="size-4 shrink-0" aria-hidden="true" />
      <span>{children}<span className="sr-only">{ok ? " (atendido)" : " (pendente)"}</span></span>
    </li>
  );
}
