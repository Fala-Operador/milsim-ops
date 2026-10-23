// Link do e-mail de confirmação: token_hash (modelo próprio) ou code (modelo padrão do Supabase).
import { describe, expect, it } from "vitest";
import { linkDaUrl } from "@/lib/confirmacaoEmail";

describe("link de confirmação", () => {
  it("aceita token_hash com type email/signup ou sem type", () => {
    expect(linkDaUrl({ token_hash: "abc", type: "email" })).toEqual({ tokenHash: "abc" });
    expect(linkDaUrl({ token_hash: "abc", type: "signup" })).toEqual({ tokenHash: "abc" });
    expect(linkDaUrl({ token_hash: "abc" })).toEqual({ tokenHash: "abc" });
  });

  it("não usa token de outro tipo (ex.: recuperação de senha)", () => {
    expect(linkDaUrl({ token_hash: "abc", type: "recovery" })).toBeNull();
  });

  it("aceita code (PKCE) e recusa link vazio", () => {
    expect(linkDaUrl({ code: "xyz" })).toEqual({ codigo: "xyz" });
    expect(linkDaUrl({})).toBeNull();
  });
});
