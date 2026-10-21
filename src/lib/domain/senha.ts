// Requisitos de senha. Espelham a configuração do Supabase Auth (Authentication → Email):
// tamanho mínimo e "minúsculas, maiúsculas, dígitos e símbolos". Se mudar lá, mude aqui.

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
    { id: "tamanho", texto: `Pelo menos ${SENHA_MINIMA} caracteres`, ok: senha.length >= SENHA_MINIMA },
    { id: "minuscula", texto: "Uma letra minúscula (a-z)", ok: /[a-z]/.test(senha) },
    { id: "maiuscula", texto: "Uma letra maiúscula (A-Z)", ok: /[A-Z]/.test(senha) },
    { id: "numero", texto: "Um número (0-9)", ok: /[0-9]/.test(senha) },
    { id: "simbolo", texto: "Um símbolo (ex.: ! @ # $ %)", ok: [...senha].some((c) => SIMBOLOS.includes(c)) },
  ];
}

export const ERRO_SENHA_TAMANHO = `A senha deve ter ao menos ${SENHA_MINIMA} caracteres.`;
export const ERRO_SENHA_CARACTERES = "A senha deve ter letra minúscula, letra maiúscula, número e símbolo.";
export const ERRO_SENHA_VAZADA =
  "Esta senha já apareceu em vazamentos de dados e não pode ser usada. Escolha outra.";

/** Primeiro problema da senha, ou `null` se ela atende a todos os requisitos. */
export function erroSenha(senha: string): string | null {
  const falhas = requisitosSenha(senha).filter((r) => !r.ok);
  if (falhas.length === 0) return null;
  return falhas.some((r) => r.id === "tamanho") ? ERRO_SENHA_TAMANHO : ERRO_SENHA_CARACTERES;
}

/** Traduz os motivos do erro `weak_password` do Supabase Auth (`pwned`, `length`, `characters`). */
export function mensagemSenhaFraca(motivos: readonly string[] | undefined): string {
  if (motivos?.includes("pwned")) return ERRO_SENHA_VAZADA;
  if (motivos?.includes("length")) return ERRO_SENHA_TAMANHO;
  if (motivos?.includes("characters")) return ERRO_SENHA_CARACTERES;
  return "Senha fraca. Escolha uma senha mais difícil de adivinhar.";
}
