// Áreas com login: só manda para /login com a visão carregada e enquanto o endereço é da área
// (antes, o redirect se aninhava sem fim: /login?redirect=/login?redirect=…).
import { describe, it, expect } from "vitest";
import { dentroDaArea, deveIrParaLogin } from "@/hooks/useExigirLogin";

describe("dentroDaArea", () => {
  it("reconhece a área e as subpáginas, com ou sem busca", () => {
    expect(dentroDaArea("/app", "/app")).toBe(true);
    expect(dentroDaArea("/app/ingressos?pagamento=sucesso", "/app")).toBe(true);
    expect(dentroDaArea("/organizacao/financeiro#movimentacoes", "/organizacao")).toBe(true);
  });
  it("não confunde com outras rotas nem com o próprio login", () => {
    expect(dentroDaArea("/login?redirect=%2Fapp", "/app")).toBe(false);
    expect(dentroDaArea("/aplicativo", "/app")).toBe(false);
    expect(dentroDaArea("/", "/admin")).toBe(false);
  });
});

describe("deveIrParaLogin", () => {
  const base = { carga: "pronto" as const, logado: false, endereco: "/app/ingressos", prefixo: "/app" };
  it("visitante numa área protegida vai para o login", () => {
    expect(deveIrParaLogin(base)).toBe(true);
  });
  it("não redireciona enquanto a visão carrega (a pessoa pode estar logada)", () => {
    expect(deveIrParaLogin({ ...base, carga: "carregando" })).toBe(false);
    expect(deveIrParaLogin({ ...base, carga: "erro" })).toBe(false);
  });
  it("não redireciona quem está logado nem quando o endereço já é o login (sem laço)", () => {
    expect(deveIrParaLogin({ ...base, logado: true })).toBe(false);
    expect(deveIrParaLogin({ ...base, endereco: "/login?redirect=%2Fapp%2Fingressos" })).toBe(false);
  });
});
