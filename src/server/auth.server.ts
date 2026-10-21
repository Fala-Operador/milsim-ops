// Autenticação com Supabase Auth. A sessão fica em cookies HTTP gerenciados pelo
// @supabase/ssr; a aplicação guarda o perfil (papel, dados cadastrais) na tabela
// usuarios, cujo id é o mesmo de auth.users.
import "@tanstack/react-start/server-only";
import { getRequestUrl } from "@tanstack/react-start/server";
import { ErroDominio } from "@/services/db";
import { registrarPerfil, validarCadastro, type DadosCadastro } from "@/services/auth";
import { erroSenha, mensagemSenhaFraca } from "@/lib/domain/senha";
import { normalizarEmail } from "@/lib/domain/validators";
import { ler, mutar, type RespostaApi } from "@/server/unidade.server";
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

export async function cadastrar(dados: DadosCadastro, captchaToken?: string): Promise<RespostaApi<null>> {
  let email: string;
  try {
    email = validarCadastro(dados).email;
  } catch (e) {
    mensagem(e);
  }
  // Protótipo: e-mail confirmado na criação (sem envio). Em produção, exigir confirmação.
  const admin = supabaseAdmin();
  const { data, error } = await admin.auth.admin.createUser({ email, password: dados.senha, email_confirm: true });
  if (error || !data.user) {
    if (error?.code === "email_exists" || /already/i.test(error?.message ?? "")) {
      throw new Error("Já existe um cadastro com este e-mail.");
    }
    if (error?.code === "weak_password") throw new Error(mensagemSenhaFraca(motivosSenhaFraca(error)));
    console.error(error);
    throw new Error("Não foi possível criar a conta. Tente novamente.");
  }
  const id = data.user.id;
  // A criação pelo admin não passa pelo CAPTCHA do Supabase; o login logo em seguida passa. Se o
  // token não valer, a conta recém-criada é desfeita.
  const sessao = supabaseSessao();
  const login = await sessao.auth.signInWithPassword({ email, password: dados.senha, options: comCaptcha(captchaToken) });
  if (login.error) {
    await admin.auth.admin.deleteUser(id);
    if (erroDeCaptcha(login.error)) throw new Error(ERRO_CAPTCHA);
    console.error(login.error);
    throw new Error("Não foi possível criar a conta. Tente novamente.");
  }
  try {
    await mutar(() => registrarPerfil(id, dados), { exigirLogin: false });
  } catch (e) {
    await sessao.auth.signOut();
    await admin.auth.admin.deleteUser(id); // desfaz a conta do Auth se o perfil não foi criado
    throw e;
  }
  return ler(() => null, { usuarioId: id });
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
