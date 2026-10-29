// Requisitos de senha. Espelham a configuração do Supabase Auth (Authentication → Email):
// tamanho mínimo e "minúsculas, maiúsculas, dígitos e símbolos". Se mudar lá, mude aqui.
import { tr } from "@/i18n/lib/domain/senha";

export const SENHA_MINIMA = 6;

// Mesmo conjunto de símbolos aceito pelo Supabase Auth (letras e números são só ASCII lá também).
const SIMBOLOS = "!@#$%^&*()_+-=[]{};'\\:\"|<>?,./`~";

export interface RequisitoSenha {
  id: "tamanho" | "minuscula" | "maiuscula" | "numero" | "simbolo";
  texto: string;
  ok: boolean;
}

export function requisitosSenha(senha: string): RequisitoSenha[] {
  return [
    { id: "tamanho", texto: tr("pelo_menos_senha_minima_caracteres", { SENHA_MINIMA }), ok: senha.length >= SENHA_MINIMA },
    { id: "minuscula", texto: tr("uma_letra_minuscula_a_z"), ok: /[a-z]/.test(senha) },
    { id: "maiuscula", texto: tr("uma_letra_maiuscula_a_z"), ok: /[A-Z]/.test(senha) },
    { id: "numero", texto: tr("um_numero_0_9"), ok: /[0-9]/.test(senha) },
    { id: "simbolo", texto: tr("um_simbolo_ex"), ok: [...senha].some((c) => SIMBOLOS.includes(c)) },
  ];
}

export const ERRO_SENHA_TAMANHO = () => tr("erro_tamanho", { SENHA_MINIMA });
export const ERRO_SENHA_CARACTERES = () => tr("erro_caracteres");
export const ERRO_SENHA_VAZADA = () => tr("erro_vazada");

/** Primeiro problema da senha, ou `null` se ela atende a todos os requisitos. */
export function erroSenha(senha: string): string | null {
  const falhas = requisitosSenha(senha).filter((r) => !r.ok);
  if (falhas.length === 0) return null;
  return falhas.some((r) => r.id === "tamanho") ? ERRO_SENHA_TAMANHO() : ERRO_SENHA_CARACTERES();
}

/** Traduz os motivos do erro `weak_password` do Supabase Auth (`pwned`, `length`, `characters`). */
export function mensagemSenhaFraca(motivos: readonly string[] | undefined): string {
  if (motivos?.includes("pwned")) return ERRO_SENHA_VAZADA();
  if (motivos?.includes("length")) return ERRO_SENHA_TAMANHO();
  if (motivos?.includes("characters")) return ERRO_SENHA_CARACTERES();
  return tr("senha_fraca_escolha_uma_senha_mais");
}
