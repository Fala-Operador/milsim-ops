// Destino depois do login: só caminhos internos.
import { describe, expect, it } from "vitest";
import { redirectSeguro } from "@/lib/links";

describe("redirectSeguro", () => {
  it("aceita caminhos internos", () => {
    expect(redirectSeguro("/eventos/evt-1?aba=regras")).toBe("/eventos/evt-1?aba=regras");
  });
  it("recusa outro site, inclusive com TAB ou quebra de linha no meio", () => {
    for (const r of ["//evil.com", "/\t/evil.com", "/\n/evil.com", "/\\evil.com", "https://evil.com", " /x"]) {
      expect(redirectSeguro(r)).toBe("/app");
    }
  });
});
