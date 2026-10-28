// Autenticação com Supabase Auth. A sessão fica em cookies HTTP gerenciados pelo
// @supabase/ssr; a aplicação guarda o perfil (papel, dados cadastrais) na tabela
// usuarios, cujo id é o mesmo de auth.users.
import "@tanstack/react-start/server-only";
import { getRequestUrl } from "@tanstack/react-start/server";
import { ErroDominio } from "@/services/db";
import { registrarPerfil, validarCadastro, validarPerfil, type DadosCadastro, type DadosPerfil } from "@/services/auth";
import { erroSenha, mensagemSenhaFraca } from "@/lib/domain/senha";
import { normalizarEmail } from "@/lib/domain/validators";
import { contextoSomenteLeitura, idDaSessao, ler, mutar, type RespostaApi } from "@/server/unidade.server";
import {
  CAMINHO_CONFIRMACAO,
  MSG_AGUARDE_REENVIO,
  MSG_EMAIL_NAO_CONFIRMADO,
  MSG_LINK_CONFIRMACAO_INVALIDO,
  type LinkConfirmacao,
} from "@/lib/confirmacaoEmail";
import { CAMINHO_RETORNO_GOOGLE, MSG_GOOGLE_FALHOU } from "@/lib/loginGoogle";
import { somenteDigitos } from "@/lib/domain/validators";
import { supabaseAdmin, supabaseSessao } from "@/server/supabase.server";
import { ERRO_CAPTCHA, erroDeCaptcha } from "@/server/turnstile.server";

/** `captchaToken` só quando houver (o Supabase recusa sem ele se o CAPTCHA estiver ligado). */
const comCaptcha = (token: string | undefined) => (token ? { captchaToken: token } : {});

function mensagem(e: unknown): never {
  if (e instanceof ErroDominio) throw new Error(e.message);
  throw e;
}

export async function entrar(email: string, senha: string, captchaToken?: string): Promise<RespostaApi<null>> {
  const sessao = supabaseSessao();
  const { data, error } = await sessao.auth.signInWithPassword({
    email: normalizarEmail(email), password: senha, options: comCaptcha(captchaToken),
  });
  if (erroDeCaptcha(error)) throw new Error(ERRO_CAPTCHA);
  // Senha certa, mas a conta ainda não abriu o link do e-mail (a tela oferece o reenvio).
  if (error?.code === "email_not_confirmed") throw new Error(MSG_EMAIL_NAO_CONFIRMADO);
  if (error || !data.user) throw new Error("E-mail ou senha incorretos.");
  const { data: perfil } = await supabaseAdmin().from("users").select("active").eq("id", data.user.id).maybeSingle();
  if (!perfil?.active) {
    await sessao.auth.signOut();
    throw new Error("Conta inativa.");
  }
  return ler(() => null, { usuarioId: data.user.id });
}

export async function sair(): Promise<RespostaApi<null>> {
  await supabaseSessao().auth.signOut();
  return ler(() => null, { usuarioId: null });
}

export interface ResultadoCadastro {
  /** true: a conta foi criada e precisa abrir o link do e-mail antes de entrar. */
  precisaConfirmar: boolean;
  email: string;
}

/** Endereço que o Supabase usa no link do modelo padrão (o modelo próprio usa {{ .SiteURL }}). */
const urlConfirmacao = () => new URL(CAMINHO_CONFIRMACAO, getRequestUrl()).toString();

/**
 * Cria a conta pelo cadastro normal do Supabase, que envia o e-mail de confirmação (com o
 * CAPTCHA validado pelo próprio Supabase). Antes, confere duplicidade de e-mail e CPF na base,
 * para não mandar e-mail de confirmação a quem já tem conta. Se o projeto estiver sem
 * confirmação obrigatória (ex.: ambiente local), a conta já entra logada, como antes.
 */
export async function cadastrar(dados: DadosCadastro, captchaToken?: string): Promise<RespostaApi<ResultadoCadastro>> {
  let email: string;
  try {
    email = validarCadastro(dados).email;
  } catch (e) {
    mensagem(e);
  }
  const { base } = await contextoSomenteLeitura();
  if (base.usuarios.some((u) => u.email === email)) throw new Error("Já existe um cadastro com este e-mail.");
  if (base.usuarios.some((u) => u.cpf === somenteDigitos(dados.cpf))) throw new Error("Já existe um cadastro com este CPF.");

  const sessao = supabaseSessao();
  const { data, error } = await sessao.auth.signUp({
    email, password: dados.senha, options: { emailRedirectTo: urlConfirmacao(), ...comCaptcha(captchaToken) },
  });
  if (erroDeCaptcha(error)) throw new Error(ERRO_CAPTCHA);
  if (error?.code === "weak_password") throw new Error(mensagemSenhaFraca(motivosSenhaFraca(error)));
  if (error?.code === "user_already_exists" || error?.code === "email_exists") throw new Error("Já existe um cadastro com este e-mail.");
  if (error?.code === "over_email_send_rate_limit") throw new Error("Muitos cadastros neste momento. Tente de novo em alguns minutos.");
  if (error || !data.user) {
    console.error("cadastrar:", error);
    throw new Error("Não foi possível criar a conta. Tente novamente.");
  }
  // Conta já existente no Auth: o Supabase responde sem identidades (e sem enviar e-mail). Não
  // é uma conta nova — nunca apagar.
  if (!data.user.identities?.length) throw new Error("Já existe um cadastro com este e-mail.");
  const id = data.user.id;
  try {
    await mutar(() => registrarPerfil(id, dados), { exigirLogin: false });
  } catch (e) {
    if (data.session) await sessao.auth.signOut();
    await supabaseAdmin().auth.admin.deleteUser(id); // desfaz a conta do Auth se o perfil não foi criado
    throw e;
  }
  if (data.session) return ler(() => ({ precisaConfirmar: false, email }), { usuarioId: id });
  return ler(() => ({ precisaConfirmar: true, email }), { usuarioId: null });
}

/** Abre a sessão a partir do link do e-mail de confirmação (token_hash ou code). */
export async function confirmarEmail(link: LinkConfirmacao): Promise<RespostaApi<null>> {
  const sessao = supabaseSessao();
  const { data, error } = "tokenHash" in link
    ? await sessao.auth.verifyOtp({ type: "email", token_hash: link.tokenHash })
    : await sessao.auth.exchangeCodeForSession(link.codigo);
  if (error || !data.user) throw new Error(MSG_LINK_CONFIRMACAO_INVALIDO);
  const { data: perfil } = await supabaseAdmin().from("users").select("active").eq("id", data.user.id).maybeSingle();
  if (!perfil?.active) {
    await sessao.auth.signOut();
    throw new Error("Conta inativa.");
  }
  return ler(() => null, { usuarioId: data.user.id });
}

/** Reenvia o e-mail de confirmação (sempre responde sucesso para não revelar contas). */
export async function reenviarConfirmacao(email: string, captchaToken?: string): Promise<void> {
  const { error } = await supabaseSessao().auth.resend({
    type: "signup", email: normalizarEmail(email), options: { emailRedirectTo: urlConfirmacao(), ...comCaptcha(captchaToken) },
  });
  if (erroDeCaptcha(error)) throw new Error(ERRO_CAPTCHA);
  if (error?.code === "over_email_send_rate_limit" || error?.status === 429) throw new Error(MSG_AGUARDE_REENVIO);
  if (error) console.error("reenviarConfirmacao:", error.message);
}

/** Envia o e-mail de redefinição (sempre responde sucesso para não revelar contas). */
export async function recuperarSenha(email: string, captchaToken?: string): Promise<void> {
  const destino = new URL("/recuperar-senha", getRequestUrl()).toString();
  const { error } = await supabaseSessao().auth.resetPasswordForEmail(normalizarEmail(email), {
    redirectTo: destino, ...comCaptcha(captchaToken),
  });
  if (erroDeCaptcha(error)) throw new Error(ERRO_CAPTCHA);
  if (error) console.error("recuperarSenha:", error.message);
}

/** Troca o código do link de e-mail por uma sessão de recuperação. */
export async function trocarCodigoRecuperacao(codigo: string): Promise<void> {
  const { error } = await supabaseSessao().auth.exchangeCodeForSession(codigo);
  if (error) throw new Error("Link de recuperação inválido ou expirado. Solicite um novo.");
}

/**
 * Valida o link do template de e-mail (`?token_hash=…&type=recovery`) e abre a sessão de
 * recuperação. Diferente do `code` (PKCE), funciona em qualquer aparelho: não depende de um
 * cookie criado no navegador que pediu a troca de senha.
 */
export async function validarTokenRecuperacao(tokenHash: string): Promise<void> {
  const { error } = await supabaseSessao().auth.verifyOtp({ type: "recovery", token_hash: tokenHash });
  if (error) throw new Error("Link de recuperação inválido ou expirado. Solicite um novo.");
}

export async function definirNovaSenha(senha: string): Promise<RespostaApi<null>> {
  const problemaSenha = erroSenha(senha);
  if (problemaSenha) throw new Error(problemaSenha);
  const { data, error } = await supabaseSessao().auth.updateUser({ password: senha });
  if (error?.code === "weak_password") throw new Error(mensagemSenhaFraca(motivosSenhaFraca(error)));
  if (error?.code === "same_password") throw new Error("A nova senha precisa ser diferente da atual.");
  if (error || !data.user) throw new Error("Sessão de recuperação expirada. Solicite um novo link.");
  return ler(() => null, { usuarioId: data.user.id });
}

/** Motivos do `weak_password` (`AuthWeakPasswordError.reasons`: pwned, length, characters). */
function motivosSenhaFraca(error: unknown): string[] | undefined {
  const motivos = (error as { reasons?: unknown }).reasons;
  return Array.isArray(motivos) ? motivos.filter((m): m is string => typeof m === "string") : undefined;
}

// ---------- Entrar com o Google (Supabase Auth, provedor OAuth "google") ----------
// O fluxo é PKCE pelo servidor: o verificador fica em cookie do Supabase e o código que o
// Google devolve em /entrar-google vira sessão aqui. Conta Google com o mesmo e-mail de uma
// conta já confirmada entra nela (vínculo automático do Supabase). Conta nova não tem perfil:
// a pessoa completa os dados obrigatórios em /cadastro?completar=google antes de usar o site.

/** Endereço do Google para onde o navegador vai. */
export async function iniciarLoginGoogle(): Promise<string> {
  const { data, error } = await supabaseSessao().auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: new URL(CAMINHO_RETORNO_GOOGLE, getRequestUrl()).toString(),
      skipBrowserRedirect: true,
      queryParams: { prompt: "select_account" },
    },
  });
  if (error || !data.url) {
    console.error("iniciarLoginGoogle:", error);
    throw new Error("Entrar com o Google não está disponível agora. Use e-mail e senha.");
  }
  return data.url;
}

export interface ResultadoLoginGoogle {
  /** true: conta Google sem perfil; abre o complemento do cadastro. */
  precisaCompletar: boolean;
  /**
   * true: o código era de um link antigo de recuperação de senha (PKCE, ?code=…) que caiu aqui
   * pela página inicial. A sessão de recuperação já está aberta; a tela segue para a nova senha.
   */
  recuperacao?: boolean;
}

/** Troca o código do retorno do Google pela sessão e diz se a conta já tem perfil. */
export async function concluirLoginGoogle(codigo: string): Promise<RespostaApi<ResultadoLoginGoogle>> {
  const sessao = supabaseSessao();
  const { data, error } = await sessao.auth.exchangeCodeForSession(codigo);
  if (error || !data.user) {
    console.error("concluirLoginGoogle:", error);
    throw new Error(MSG_GOOGLE_FALHOU);
  }
  // O verificador PKCE guardado por resetPasswordForEmail leva a marca "recovery"; a troca a devolve
  // em `redirectType` (o tipo do supabase-js ainda não declara o campo).
  if ((data as { redirectType?: string | null }).redirectType === "recovery") return ler(() => ({ precisaCompletar: false, recuperacao: true }), { usuarioId: null });
  const { data: perfil } = await supabaseAdmin().from("users").select("active").eq("id", data.user.id).maybeSingle();
  if (!perfil) return ler(() => ({ precisaCompletar: true }), { usuarioId: null });
  if (!perfil.active) {
    await sessao.auth.signOut();
    throw new Error("Conta inativa.");
  }
  return ler(() => ({ precisaCompletar: false }), { usuarioId: data.user.id });
}

export interface ContaSemPerfil {
  email: string;
  nome: string;
}

/**
 * Conta da sessão que ainda não tem perfil (entrou com o Google pela primeira vez).
 * null = sem sessão ou o perfil já existe.
 */
export async function contaSemPerfil(): Promise<ContaSemPerfil | null> {
  const { data } = await supabaseSessao().auth.getUser();
  const user = data.user;
  if (!user?.email) return null;
  const { data: perfil } = await supabaseAdmin().from("users").select("id").eq("id", user.id).maybeSingle();
  if (perfil) return null;
  const meta = user.user_metadata ?? {};
  const nome = typeof meta["full_name"] === "string" ? meta["full_name"] : typeof meta["name"] === "string" ? meta["name"] : "";
  return { email: normalizarEmail(user.email), nome };
}

/** Cria o perfil da conta Google da sessão. O e-mail vem do Google, nunca do formulário. */
export async function completarCadastroGoogle(dados: Omit<DadosPerfil, "email">): Promise<RespostaApi<null>> {
  const conta = await contaSemPerfil();
  const id = await idDaSessao();
  if (!conta || !id) throw new Error("Sessão expirada. Entre com o Google de novo.");
  const perfil: DadosPerfil = { ...dados, email: conta.email };
  try {
    validarPerfil(perfil);
  } catch (e) {
    mensagem(e);
  }
  await mutar(() => registrarPerfil(id, perfil), { exigirLogin: false });
  return ler(() => null, { usuarioId: id });
}

/** Desiste do complemento: encerra a sessão e apaga a conta do Auth que ficou sem perfil. */
export async function cancelarCadastroGoogle(): Promise<RespostaApi<null>> {
  const conta = await contaSemPerfil();
  const id = await idDaSessao();
  await supabaseSessao().auth.signOut();
  if (conta && id) await supabaseAdmin().auth.admin.deleteUser(id);
  return ler(() => null, { usuarioId: null });
}
