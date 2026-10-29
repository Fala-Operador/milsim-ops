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
import { tr } from "@/i18n/routes/recuperar-senha";

export const Route = createFileRoute("/recuperar-senha")({
  // O e-mail de recuperação (supabase/templates/recuperar-senha.html) volta para esta página com
  // ?token_hash=…&type=recovery; links antigos (template padrão do Supabase) chegam com ?code=….
  validateSearch: (s: Record<string, unknown>): {
    code?: string | undefined; token_hash?: string | undefined; type?: string | undefined; error_description?: string | undefined;
    /** "recuperacao": a sessão de recuperação já foi aberta em /entrar-google (código PKCE antigo). */
    sessao?: "recuperacao" | undefined;
  } => ({
    code: typeof s["code"] === "string" ? s["code"] : undefined,
    token_hash: typeof s["token_hash"] === "string" ? s["token_hash"] : undefined,
    type: typeof s["type"] === "string" ? s["type"] : undefined,
    error_description: typeof s["error_description"] === "string" ? s["error_description"] : undefined,
    sessao: s["sessao"] === "recuperacao" ? "recuperacao" : undefined,
  }),
  head: () => ({
    meta: [
      { title: tr("recuperar_senha_milsim_ops") },
      { name: "description", content: tr("receba_um_link_por_e_mail") },
      { property: "og:title", content: tr("recuperar_senha_milsim_ops") },
      { property: "og:description", content: tr("redefinicao_de_senha") },
    ],
  }),
  component: PaginaRecuperar,
});

function PaginaRecuperar() {
  const { code, token_hash, type, error_description, sessao } = Route.useSearch();
  const link: LinkRecuperacao | null = token_hash && (!type || type === "recovery") ? { tokenHash: token_hash }
    : code ? { codigo: code } : sessao === "recuperacao" ? { sessaoAberta: true } : null;
  return (
    <LayoutAcesso titulo={link ? tr("criar_nova_senha") : tr("recuperar_senha")}
      subtitulo={link ? undefined : tr("informe_o_e_mail_da_conta")}
      imagem={imgSar} rotulo={tr("acesso_a_conta")} frase={tr("volte_para_o_campo_em_menos")}>
      {link ? <NovaSenha link={link} /> : <PedirLink erroLink={error_description} />}
      <p className="mt-4 text-sm">
        <Link to="/login" search={{ redirect: undefined }} className="text-accent hover:underline">{tr("voltar_ao_login")}</Link>
      </p>
    </LayoutAcesso>
  );
}

function PedirLink({ erroLink }: { erroLink?: string | undefined }) {
  const [email, setEmail] = useState("");
  const [enviado, setEnviado] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState(erroLink ? tr("o_link_de_recuperacao_e_invalido") : "");
  const turnstile = useTurnstile("recuperar_senha");

  const aoEnviar = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro("");
    setEnviando(true);
    try {
      await recuperarSenha(email, turnstile.token);
      setEnviado(true);
    } catch (err) {
      setErro(err instanceof Error ? err.message : tr("falha_ao_processar"));
      turnstile.resetar();
    } finally {
      setEnviando(false);
    }
  };

  if (enviado) {
    return (
      <p className="mt-4 rounded-md border border-success/40 bg-success/10 px-3 py-2 text-sm text-success">
        {tr("se_houver_uma_conta_com_este")}</p>
    );
  }
  return (
    <form onSubmit={aoEnviar} className="mt-6 space-y-4">
      <Campo rotulo={tr("e_mail")} htmlFor="email" erro={erro || undefined}>
        <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      </Campo>
      {turnstile.elemento}
      <Button type="submit" size="lg" className="w-full" disabled={enviando || !turnstile.pronto}>{enviando ? tr("enviando") : tr("enviar_link_de_recuperacao")}</Button>
    </form>
  );
}

/**
 * Link do e-mail: token_hash (template atual, qualquer aparelho) ou code (PKCE, links antigos).
 * sessaoAberta: o code já foi trocado em /entrar-google.
 */
type LinkRecuperacao = { tokenHash: string } | { codigo: string } | { sessaoAberta: true };

// O link é de uso único: se a página montar de novo, reaproveita a mesma validação em vez de
// gastar o token uma segunda vez (o que daria "link inválido" mesmo com a sessão já aberta).
const validacoes = new Map<string, Promise<void>>();
function validarLink(link: LinkRecuperacao): Promise<void> {
  if ("sessaoAberta" in link) return Promise.resolve();
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

  const chave = "tokenHash" in link ? link.tokenHash : "codigo" in link ? link.codigo : "sessao";
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
    if (!iguais) return setErro(tr("a_confirmacao_de_senha_nao_confere"));
    setSalvando(true);
    try {
      await definirNovaSenha(senha);
      setEstado("concluido");
    } catch (err) {
      setErro(err instanceof Error ? err.message : tr("falha_ao_salvar_a_senha"));
    } finally {
      setSalvando(false);
    }
  };

  if (estado === "validando") return <div className="mt-4"><Spinner texto={tr("validando_o_link_do_e_mail")} /></div>;

  if (estado === "invalido") {
    return (
      <div className="mt-4 space-y-4" role="alert">
        <div className="flex gap-3 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm">
          <ShieldAlert className="mt-0.5 size-5 shrink-0 text-destructive" aria-hidden="true" />
          <div>
            <p className="font-medium text-destructive">{tr("este_link_nao_vale_mais")}</p>
            <p className="mt-1 text-muted-foreground">
              {tr("o_link_de_redefinicao_vale_por")}</p>
          </div>
        </div>
        <Button asChild className="w-full">
          <Link to="/recuperar-senha" search={{}}>{tr("pedir_um_novo_link")}</Link>
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
            <p className="font-medium text-success">{tr("senha_alterada")}</p>
            <p className="mt-1 text-muted-foreground">{tr("sua_nova_senha_ja_esta_valendo")}</p>
          </div>
        </div>
        <Button className="w-full" onClick={() => navigate({ to: "/app" })}>{tr("ir_para_minha_conta")}</Button>
      </div>
    );
  }

  return (
    <form onSubmit={aoSalvar} className="mt-4 space-y-4" noValidate>
      <p className="text-sm text-muted-foreground">{tr("escolha_uma_nova_senha_para_a")}</p>
      <Campo rotulo={tr("nova_senha")} htmlFor="senha">
        <InputSenha
          id="senha"
          autoComplete="new-password"
          autoFocus
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
          aria-describedby="requisitos-senha"
        />
      </Campo>
      <Campo rotulo={tr("confirme_a_nova_senha")} htmlFor="confirmacao">
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
        {salvando ? tr("salvando") : tr("salvar_nova_senha")}
      </Button>
    </form>
  );
}

