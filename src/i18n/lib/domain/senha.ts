// Textos de src/lib/domain/senha.ts.
import { dicionario } from "@/i18n/dicionario";

export const tr = dicionario("lib/domain/senha", {
  "pelo_menos_senha_minima_caracteres": { pt: "Pelo menos {SENHA_MINIMA} caracteres", en: "At least {SENHA_MINIMA} characters" },
  "uma_letra_minuscula_a_z": { pt: "Uma letra minúscula (a-z)", en: "One lowercase letter (a-z)" },
  "uma_letra_maiuscula_a_z": { pt: "Uma letra maiúscula (A-Z)", en: "One uppercase letter (A-Z)" },
  "um_numero_0_9": { pt: "Um número (0-9)", en: "One number (0-9)" },
  "um_simbolo_ex": { pt: "Um símbolo (ex.: ! @ # $ %)", en: "One symbol (e.g. ! @ # $ %)" },
  "senha_fraca_escolha_uma_senha_mais": { pt: "Senha fraca. Escolha uma senha mais difícil de adivinhar.", en: "Weak password. Choose a password that is harder to guess." },
  "erro_tamanho": { pt: "A senha deve ter ao menos {SENHA_MINIMA} caracteres.", en: "The password must have at least {SENHA_MINIMA} characters." },
  "erro_caracteres": { pt: "A senha deve ter letra minúscula, letra maiúscula, número e símbolo.", en: "The password must have a lowercase letter, an uppercase letter, a number and a symbol." },
  "erro_vazada": { pt: "Esta senha já apareceu em vazamentos de dados e não pode ser usada. Escolha outra.", en: "This password has appeared in data breaches and cannot be used. Choose another one." },
});
