// Catálogo do Stripe dos tipos de impulso: produto com id fixo, preço novo quando o valor
// muda (os antigos são arquivados) e imagens/dados do tipo.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sincronizarProdutoImpulso, type ProdutoImpulso } from "@/server/stripe.server";
import { restaurarBase } from "./baseTeste";
import type { BaseDados, Usuario } from "@/lib/domain/types";
import { imagemAbsoluta, imagemPadraoImpulso, imagemPlanoValida, planosDeImpulso, precoStripeEmDia } from "@/lib/impulsos";
import { registrarSincronizacaoPlanoNaBase, salvarPlanosImpulsoNaBase } from "@/services/impulsos";
import { visaoParaUsuario } from "@/lib/visao";

interface Chamada { metodo: string; caminho: string; corpo: string }

function stripeFalso(estado: { produto: boolean; precos: { id: string; unit_amount: number; currency: string; active: boolean }[] }) {
  const chamadas: Chamada[] = [];
  const fetchFalso = vi.fn(async (url: string, init: RequestInit) => {
    const caminho = url.replace("https://api.stripe.com/v1", "");
    const corpo = String(init.body ?? "");
    chamadas.push({ metodo: init.method ?? "GET", caminho, corpo });
    const ok = (b: unknown) => new Response(JSON.stringify(b), { status: 200 });
    if (caminho.startsWith("/products/") && init.method === "GET") {
      return estado.produto ? ok({ id: "milsim_impulso_7d" }) : new Response(JSON.stringify({ error: { message: "No such product" } }), { status: 404 });
    }
    if (caminho === "/products") return ok({ id: "milsim_impulso_7d", default_price: "price_novo" });
    if (caminho.startsWith("/prices?")) return ok({ data: estado.precos.filter((p) => p.active) });
    if (caminho === "/prices") return ok({ id: "price_criado", unit_amount: 5000, currency: "brl", active: true });
    return ok({});
  });
  vi.stubGlobal("fetch", fetchFalso);
  return chamadas;
}

const produto: ProdutoImpulso = {
  produtoId: "milsim_impulso_7d", nome: "Impulso de 7 dias — MilSim Ops", descricao: "Destaque", imagens: ["https://site.com/impulsos/7d.jpg"],
  ativo: true, precoCentavos: 5000, metadata: { planoImpulso: "7d" },
};

describe("sincronização com o Stripe", () => {
  beforeEach(() => { process.env["STRIPE_SERVER_API_KEY"] = "sk_test_x"; });
  afterEach(() => { vi.unstubAllGlobals(); delete process.env["STRIPE_SERVER_API_KEY"]; });

  it("cria o produto com id fixo, imagem e preço padrão na primeira vez", async () => {
    const chamadas = stripeFalso({ produto: false, precos: [] });
    expect(await sincronizarProdutoImpulso(produto)).toEqual({ produtoId: "milsim_impulso_7d", precoId: "price_novo" });
    const criar = chamadas.find((c) => c.caminho === "/products")!;
    expect(decodeURIComponent(criar.corpo)).toContain("id=milsim_impulso_7d");
    expect(decodeURIComponent(criar.corpo)).toContain("images[0]=https://site.com/impulsos/7d.jpg");
    expect(decodeURIComponent(criar.corpo)).toContain("default_price_data[unit_amount]=5000");
  });

  it("valor novo: cria preço, vira o padrão e arquiva os antigos", async () => {
    const chamadas = stripeFalso({ produto: true, precos: [{ id: "price_velho", unit_amount: 4490, currency: "brl", active: true }] });
    expect((await sincronizarProdutoImpulso(produto)).precoId).toBe("price_criado");
    expect(chamadas.some((c) => c.caminho === "/products/milsim_impulso_7d" && decodeURIComponent(c.corpo).includes("default_price=price_criado"))).toBe(true);
    expect(chamadas.some((c) => c.caminho === "/prices/price_velho" && c.corpo === "active=false")).toBe(true);
  });

  it("mesmo valor: reaproveita o preço e não cria outro", async () => {
    const chamadas = stripeFalso({ produto: true, precos: [{ id: "price_igual", unit_amount: 5000, currency: "brl", active: true }] });
    expect((await sincronizarProdutoImpulso(produto)).precoId).toBe("price_igual");
    expect(chamadas.some((c) => c.caminho === "/prices")).toBe(false);
  });
});

describe("imagens e catálogo dos tipos", () => {
  let base: BaseDados;
  let admin: Usuario;
  beforeEach(() => {
    base = restaurarBase();
    admin = base.usuarios.find((u) => u.id === "usr-admin")!;
  });

  it("cada tipo tem a imagem padrão até a administração trocar", () => {
    expect(planosDeImpulso(base).map((p) => p.imagemUrl)).toEqual(["24h", "3d", "5d", "7d", "15d", "30d"].map((id) => `/impulsos/${id}.jpg`));
    salvarPlanosImpulsoNaBase(base, admin, [{ id: "7d", precoCentavos: 4490, validadeDias: 30, ativo: true, imagemUrl: "https://cdn.exemplo.com/7d.png" }]);
    expect(planosDeImpulso(base).find((p) => p.id === "7d")!.imagemUrl).toBe("https://cdn.exemplo.com/7d.png");
    expect(() => salvarPlanosImpulsoNaBase(base, admin, [{ id: "7d", precoCentavos: 4490, validadeDias: 30, ativo: true, imagemUrl: "javascript:alert(1)" }])).toThrow(/imagem/);
    expect(imagemPadraoImpulso("24h")).toBe("/impulsos/24h.jpg");
  });

  it("valida e monta as URLs das imagens", () => {
    expect(imagemPlanoValida("data:image/png;base64,AAAA")).toBe(true);
    expect(imagemPlanoValida("http://inseguro.com/a.png")).toBe(false);
    expect(imagemAbsoluta("/impulsos/7d.jpg", "https://milsimops.falaoperador.com.br")).toBe("https://milsimops.falaoperador.com.br/impulsos/7d.jpg");
    expect(imagemAbsoluta("/impulsos/7d.jpg", "http://localhost:3000")).toBeUndefined();
    // Atrás do proxy o servidor vê http; o público acessa por https.
    expect(imagemAbsoluta("/impulsos/7d.jpg", "http://milsimops.falaoperador.com.br")).toBe("https://milsimops.falaoperador.com.br/impulsos/7d.jpg");
    expect(imagemAbsoluta("/impulsos/7d.jpg", "http://127.0.0.1:3000")).toBeUndefined();
  });

  it("preço do Stripe deixa de valer quando o tipo muda depois da sincronização", () => {
    registrarSincronizacaoPlanoNaBase(base, "7d", { produtoId: "milsim_impulso_7d", precoId: "price_1" }, new Date(Date.now() + 1000));
    expect(precoStripeEmDia(planosDeImpulso(base).find((p) => p.id === "7d")!)).toBe(true);
    salvarPlanosImpulsoNaBase(base, admin, [{ id: "7d", precoCentavos: 5000, validadeDias: 30, ativo: true }], new Date(Date.now() + 2000));
    expect(precoStripeEmDia(planosDeImpulso(base).find((p) => p.id === "7d")!)).toBe(false);
  });

  it("ids do Stripe só para a administração", () => {
    registrarSincronizacaoPlanoNaBase(base, "7d", { produtoId: "milsim_impulso_7d", precoId: "price_1" });
    expect(visaoParaUsuario(base, admin).planosImpulso[0]!.stripePrecoId).toBe("price_1");
    const v = visaoParaUsuario(base, null).planosImpulso[0]!;
    expect([v.stripeProdutoId, v.stripePrecoId, v.imagemUrl]).toEqual([undefined, undefined, "/impulsos/7d.jpg"]);
  });
});
