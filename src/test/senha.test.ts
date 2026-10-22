// Requisitos de senha do cadastro e da redefinição (espelham o Supabase Auth) e a tradução
// do erro weak_password, inclusive senha vazada.
import { describe, expect, it } from "vitest";
import {
  ERRO_SENHA_CARACTERES,
  ERRO_SENHA_TAMANHO,
  ERRO_SENHA_VAZADA,
  erroSenha,
  mensagemSenhaFraca,
  requisitosSenha,
} from "@/lib/domain/senha";

describe("requisitos de senha", () => {
  it("aceita senha com tamanho mínimo, minúscula, maiúscula, número e símbolo", () => {
    expect(erroSenha("Ab1!xy")).toBeNull();
    expect(requisitosSenha("Ab1!xy").every((r) => r.ok)).toBe(true);
  });

  it("marca cada requisito que falta", () => {
    const pendentes = requisitosSenha("abc").filter((r) => !r.ok).map((r) => r.id);
    expect(pendentes).toEqual(["tamanho", "maiuscula", "numero", "simbolo"]);
  });

  it("aponta primeiro o tamanho e depois os tipos de caractere", () => {
    expect(erroSenha("Ab1!")).toBe(ERRO_SENHA_TAMANHO);
    expect(erroSenha("abcdef1!")).toBe(ERRO_SENHA_CARACTERES);
  });

  it("usa os mesmos símbolos e letras ASCII do Supabase", () => {
    expect(erroSenha("Abcde1\\")).toBeNull();
    expect(erroSenha("Abcde1 ")).toBe(ERRO_SENHA_CARACTERES); // espaço não conta como símbolo
    expect(erroSenha("ÁBCDE1!")).toBe(ERRO_SENHA_CARACTERES); // letra acentuada não conta
  });

  it("traduz os motivos do weak_password", () => {
    expect(mensagemSenhaFraca(["pwned"])).toBe(ERRO_SENHA_VAZADA);
    expect(mensagemSenhaFraca(["length", "pwned"])).toBe(ERRO_SENHA_VAZADA);
    expect(mensagemSenhaFraca(["characters"])).toBe(ERRO_SENHA_CARACTERES);
    expect(mensagemSenhaFraca(undefined)).toMatch(/Senha fraca/);
  });
});
