// Autenticação com Supabase Auth. A sessão fica em cookies HTTP gerenciados pelo
// @supabase/ssr; a aplicação guarda o perfil (papel, dados cadastrais) na tabela
// usuarios, cujo id é o mesmo de auth.users.
import "@tanstack/react-start/server-only";
import { getRequestUrl } from "@tanstack/react-start/server";
import { ErroDominio } from "@/services/db";
import { registrarPerfil, validarCadastro, SENHA_MINIMA, type DadosCadastro } from "@/services/auth";
import { normalizarEmail } from "@/lib/domain/validators";
import { ler, mutar, type RespostaApi } from "@/server/unidade.server";
import { supabaseAdmin, supabaseSessao } from "@/server/supabase.server";

function mensagem(e: unknown): never {
  if (e instanceof ErroDominio) throw new Error(e.message);
  throw e;
}

export async function entrar(email: string, senha: string): Promise<RespostaApi<null>> {
  const sessao = supabaseSessao();
  const { data, error } = await sessao.auth.signInWithPassword({ email: normalizarEmail(email), password: senha });
  if (error || !data.user) throw new Error("E-mail ou senha incorretos.");
  const { data: perfil } = await supabaseAdmin().from("usuarios").select("ativo").eq("id", data.user.id).maybeSingle();
  if (!perfil?.ativo) {
    await sessao.auth.signOut();
    throw new Error("Conta inativa.");
  }
  return ler(() => null, { usuarioId: data.user.id });
}

export async function sair(): Promise<RespostaApi<null>> {
  await supabaseSessao().auth.signOut();
  return ler(() => null, { usuarioId: null });
}

export async function cadastrar(dados: DadosCadastro): Promise<RespostaApi<null>> {
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
    if (error?.code === "weak_password") throw new Error("Senha fraca. Use uma senha mais longa.");
    console.error(error);
    throw new Error("Não foi possível criar a conta. Tente novamente.");
  }
  const id = data.user.id;
  try {
    await mutar(() => registrarPerfil(id, dados), { exigirLogin: false });
  } catch (e) {
    await admin.auth.admin.deleteUser(id); // desfaz a conta do Auth se o perfil não foi criado
    throw e;
  }
  await supabaseSessao().auth.signInWithPassword({ email, password: dados.senha });
  return ler(() => null, { usuarioId: id });
}

/** Envia o e-mail de redefinição (sempre responde sucesso para não revelar contas). */
export async function recuperarSenha(email: string): Promise<void> {
  const destino = new URL("/recuperar-senha", getRequestUrl()).toString();
  const { error } = await supabaseSessao().auth.resetPasswordForEmail(normalizarEmail(email), { redirectTo: destino });
  if (error) console.error("recuperarSenha:", error.message);
}

/** Troca o código do link de e-mail por uma sessão de recuperação. */
export async function trocarCodigoRecuperacao(codigo: string): Promise<void> {
  const { error } = await supabaseSessao().auth.exchangeCodeForSession(codigo);
  if (error) throw new Error("Link de recuperação inválido ou expirado. Solicite um novo.");
}

export async function definirNovaSenha(senha: string): Promise<RespostaApi<null>> {
  if (senha.length < SENHA_MINIMA) throw new Error(`A senha deve ter ao menos ${SENHA_MINIMA} caracteres.`);
  const { data, error } = await supabaseSessao().auth.updateUser({ password: senha });
  if (error || !data.user) throw new Error("Sessão de recuperação expirada. Solicite um novo link.");
  return ler(() => null, { usuarioId: data.user.id });
}
