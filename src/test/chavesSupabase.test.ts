import { describe, expect, it } from "vitest";
import { papelDaChave } from "@/lib/chavesSupabase";

const jwt = (carga: object) =>
  ["e30", btoa(JSON.stringify(carga)).replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_"), "assinatura"].join(".");

describe("papelDaChave", () => {
  it("reconhece as chaves novas", () => {
    expect(papelDaChave("sb_secret_abc")).toBe("service_role");
    expect(papelDaChave("sb_publishable_abc")).toBe("anon");
  });
  it("lê o papel das chaves JWT legadas", () => {
    expect(papelDaChave(jwt({ role: "service_role" }))).toBe("service_role");
    expect(papelDaChave(jwt({ role: "anon" }))).toBe("anon");
  });
  it("não opina sobre formatos desconhecidos", () => {
    expect(papelDaChave("qualquer-coisa")).toBeNull();
    expect(papelDaChave("a.!!!.c")).toBeNull();
  });
});
