// Comunidade geral: limites do post, fotos, ritmo, moderação por termos (sem barrar o jargão do
// airsoft) e a regra de visibilidade que o banco aplica (espelhada em podeVerAutor).
import { describe, expect, it } from "vitest";
import { erroPost, erroRitmo, podeVerAutor, statusAoSeguir, tamanhoDataUrl, LIMITE_POST } from "@/lib/comunidadeGeral";
import { moderarTexto } from "@/lib/moderacao";

const FOTO = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD";
const fotoDe = (bytes: number) => `data:image/png;base64,${"A".repeat(Math.ceil((bytes * 4) / 3))}`;

describe("post", () => {
  it("texto até 220 caracteres (contando emoji como um) ou só foto", () => {
    expect(erroPost("a".repeat(LIMITE_POST), [])).toBe("");
    expect(erroPost("a".repeat(LIMITE_POST + 1), [])).toMatch(/220/);
    expect(erroPost("🎯".repeat(LIMITE_POST), [])).toBe("");
    expect(erroPost("   ", [])).toMatch(/Escreva algo/);
    expect(erroPost("", [{ dados: FOTO }])).toBe("");
  });

  it("até 4 fotos JPG/PNG/WebP de até 5 MB", () => {
    expect(erroPost("ok", Array.from({ length: 5 }, () => ({ dados: FOTO })))).toMatch(/4 fotos/);
    expect(erroPost("ok", [{ dados: "data:image/gif;base64,R0lGOD" }])).toMatch(/Formato/);
    expect(erroPost("ok", [{ dados: "data:video/mp4;base64,AAAA" }])).toMatch(/Formato/);
    expect(erroPost("ok", [{ dados: fotoDe(5 * 1024 * 1024 + 10) }])).toMatch(/5 MB/);
    expect(tamanhoDataUrl("data:image/png;base64,QUJD")).toBe(3);
  });

  it("ritmo: intervalo mínimo e limite por hora", () => {
    const agora = new Date("2026-10-22T12:00:00Z");
    const antes = (s: number) => new Date(agora.getTime() - s * 1000).toISOString();
    expect(erroRitmo([antes(5)], agora)).toMatch(/Espere/);
    expect(erroRitmo([antes(30)], agora)).toBe("");
    expect(erroRitmo(Array.from({ length: 30 }, (_, i) => antes(60 + i * 60)), agora)).toMatch(/limite/);
  });
});

describe("moderação por termos", () => {
  it("bloqueia sexo, drogas e violência real, inclusive com acento ou número no lugar de letra", () => {
    expect(moderarTexto("link do onlyfans aqui")).toMatchObject({ aprovado: false, categoria: "sexo" });
    expect(moderarTexto("vendo M4C0NHA e cocaína")).toMatchObject({ aprovado: false, categoria: "drogas" });
    expect(moderarTexto("vídeo de corpo decapitado")).toMatchObject({ aprovado: false, categoria: "violencia" });
    expect(moderarTexto("p0rn grátis")).toMatchObject({ aprovado: false, categoria: "sexo" });
  });

  it("não bloqueia o jargão do airsoft nem palavras comuns parecidas", () => {
    for (const ok of [
      "Morri três vezes na Operação Vale da Morte, mas fui eliminado com estilo",
      "Missão suicida no flanco esquerdo, baixa confirmada pelo sniper",
      "Vai rolar jogo domingo? Depois tem pelada no campo",
      "Granada de fumaça, tiro de M4 e muito BB",
      "Sexta tem treino de CQB",
    ]) {
      expect(moderarTexto(ok), ok).toEqual({ aprovado: true });
    }
  });

  it("o post usa a moderação: texto bloqueado não publica", () => {
    expect(erroPost("compro maconha", [])).toMatch(/drogas/);
  });
});

describe("visibilidade (mesma regra do banco)", () => {
  const publico = { id: "a", ativo: true, privado: false };
  const privado = { id: "a", ativo: true, privado: true };

  it("perfil público: todos, inclusive visitante", () => {
    expect(podeVerAutor({ quemVe: null, autor: publico, seguidorAprovado: false, bloqueio: false })).toBe(true);
    expect(podeVerAutor({ quemVe: "b", autor: publico, seguidorAprovado: false, bloqueio: false })).toBe(true);
  });

  it("perfil privado: só o próprio e seguidores aprovados", () => {
    expect(podeVerAutor({ quemVe: "a", autor: privado, seguidorAprovado: false, bloqueio: false })).toBe(true);
    expect(podeVerAutor({ quemVe: "b", autor: privado, seguidorAprovado: true, bloqueio: false })).toBe(true);
    expect(podeVerAutor({ quemVe: "b", autor: privado, seguidorAprovado: false, bloqueio: false })).toBe(false);
    expect(podeVerAutor({ quemVe: null, autor: privado, seguidorAprovado: false, bloqueio: false })).toBe(false);
  });

  it("bloqueio e conta inativa escondem tudo", () => {
    expect(podeVerAutor({ quemVe: "b", autor: publico, seguidorAprovado: true, bloqueio: true })).toBe(false);
    expect(podeVerAutor({ quemVe: "b", autor: { ...publico, ativo: false }, seguidorAprovado: false, bloqueio: false })).toBe(false);
  });

  it("seguir perfil privado vira pedido", () => {
    expect(statusAoSeguir(true)).toBe("pendente");
    expect(statusAoSeguir(false)).toBe("aprovado");
  });
});
