import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { definirNovaSenha, recuperarSenha, trocarCodigoRecuperacao, validarTokenRecuperacao } from "@/api/sessao.functions";
import { Button } from "@/components/ui/button";
import { LayoutAcesso } from "@/components/LayoutAcesso";
import { Input } from "@/components/ui/input";
import { Campo, Spinner } from "@/components/ui";
import { CheckCircle2, ShieldAlert } from "lucide-react";
import { InputSenha } from "@/components/ui/input-senha";
import { RequisitosSenha } from "@/components/RequisitosSenha";
import { useTurnstile } from "@/components/Turnstile";
import { erroSenha } from "@/lib/domain/senha";
import imgSar from "@/assets/modalidade-sar.jpg";

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
    <LayoutAcesso titulo={link ? "Criar nova senha" : "Recuperar senha"}
      subtitulo={link ? undefined : "Informe o e-mail da conta. Enviamos um link que vale por 1 hora."}
      imagem={imgSar} rotulo="Acesso à conta" frase="Volte para o campo em menos de um minuto.">
      {link ? <NovaSenha link={link} /> : <PedirLink erroLink={error_description} />}
      <p className="mt-4 text-sm">
        <Link to="/login" search={{ redirect: undefined }} className="text-accent hover:underline">Voltar ao login</Link>
      </p>
    </LayoutAcesso>
  );
}

function PedirLink({ erroLink }: { erroLink?: string | undefined }) {
  const [email, setEmail] = useState("");
  const [enviado, setEnviado] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState(erroLink ? "O link de recuperação é inválido ou expirou. Solicite um novo." : "");
  const turnstile = useTurnstile("recuperar_senha");

  const aoEnviar = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro("");
    setEnviando(true);
    try {
      await recuperarSenha(email, turnstile.token);
      setEnviado(true);
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Falha ao processar.");
      turnstile.resetar();
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
    <form onSubmit={aoEnviar} className="mt-6 space-y-4">
      <Campo rotulo="E-mail" htmlFor="email" erro={erro || undefined}>
        <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      </Campo>
      {turnstile.elemento}
      <Button type="submit" size="lg" className="w-full" disabled={enviando || !turnstile.pronto}>{enviando ? "Enviando..." : "Enviar link de recuperação"}</Button>
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
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);

  const chave = "tokenHash" in link ? link.tokenHash : link.codigo;
  useEffect(() => {
    validarLink(link)
      .then(() => setEstado("pronto"))
      .catch(() => setEstado("invalido"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chave]);

  const problemaSenha = erroSenha(senha);
  const iguais = senha.length > 0 && senha === confirmacao;

  const aoSalvar = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro("");
    if (problemaSenha) return setErro(problemaSenha);
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

  return (
    <form onSubmit={aoSalvar} className="mt-4 space-y-4" noValidate>
      <p className="text-sm text-muted-foreground">Escolha uma nova senha para a sua conta. Depois de salvar, você entra direto.</p>
      <Campo rotulo="Nova senha" htmlFor="senha">
        <InputSenha
          id="senha"
          autoComplete="new-password"
          autoFocus
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
          aria-describedby="requisitos-senha"
        />
      </Campo>
      <Campo rotulo="Confirme a nova senha" htmlFor="confirmacao">
        <InputSenha
          id="confirmacao"
          autoComplete="new-password"
          value={confirmacao}
          onChange={(e) => setConfirmacao(e.target.value)}
        />
      </Campo>
      <RequisitosSenha id="requisitos-senha" senha={senha} confirmacao={confirmacao} />
      {erro && <p role="alert" className="text-sm text-destructive">{erro}</p>}
      <Button type="submit" className="w-full" disabled={salvando || problemaSenha !== null || !iguais}>
        {salvando ? "Salvando..." : "Salvar nova senha"}
      </Button>
    </form>
  );
}

