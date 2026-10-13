// Instagram dos parceiros: formatos aceitos, recusados, normalização de dados antigos e pendências.
import { describe, it, expect } from "vitest";
import { analisarInstagram, erroDoLink, hrefDoLink, linkPrincipal, linksPendentes, normalizarInstagram, normalizarLinks } from "@/lib/divulgacao";
import type { LinkParceiro, Parceiro } from "@/lib/domain/types";

const CANONICO = "https://www.instagram.com/falaoperador/";

describe("formatos aceitos", () => {
  it.each([
    "@falaoperador",
    "falaoperador",
    "instagram.com/falaoperador",
    "https://www.instagram.com/falaoperador/",
    "  @falaoperador  ",
    "http://instagram.com/falaoperador",
    "https://m.instagram.com/falaoperador",
    "https://www.instagram.com/falaoperador/?igsh=MWx3eGR5&utm_source=qr",
    "www.instagram.com/FalaOperador#topo",
  ])("%s → canônico", (entrada) => {
    expect(normalizarInstagram(entrada)).toBe(CANONICO);
  });

  it("preserva pontos e sublinhados do nome", () => {
    expect(normalizarInstagram("@bazar.do_airsoft")).toBe("https://www.instagram.com/bazar.do_airsoft/");
    expect(normalizarInstagram("instagram.com/clean.antifog")).toBe("https://www.instagram.com/clean.antifog/");
  });
});

describe("formatos recusados (com mensagem)", () => {
  it.each([
    ["", /Informe/],
    ["@", /depois do @/],
    ["@fala operador", /espaços/],
    ["facebook.com/falaoperador", /instagram\.com/],
    ["https://www.instagram.com/p/C0abc123/", /publicação/],
    ["https://www.instagram.com/reel/C0abc123/", /publicação/],
    ["https://www.instagram.com/stories/falaoperador/123/", /publicação/],
    ["instagram.com/", /Falta o nome/],
    ["@fala-operador", /letras, números/],
    ["@.falaoperador", /ponto/],
    ["@" + "a".repeat(31), /30 caracteres/],
    ["falaoperador.com.br", /parece um site/],
    ["javascript:alert(1)", /letras, números/],
  ])("%s", (entrada, mensagem) => {
    const r = analisarInstagram(entrada);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erro).toMatch(mensagem);
  });
});

const ig = (url: string, principal = false): LinkParceiro => ({ id: `lk-${url}`, tipo: "instagram", url, principal });
const site = (url: string, principal = false): LinkParceiro => ({ id: `lk-${url}`, tipo: "site", url, principal });
const parceiro = (links: LinkParceiro[]): Parceiro => ({
  id: "par", nome: "P", tipo: "patrocinador", textoAlt: "", links, ativo: true, criadoEm: "", atualizadoEm: "",
});

describe("links do parceiro", () => {
  it("Instagram com @ gera link mesmo sendo o principal (caso Clean Antifog)", () => {
    const p = parceiro([ig("@cleanantifog", true)]);
    expect(linkPrincipal(p)).toBe("https://www.instagram.com/cleanantifog/");
    expect(p.links.filter((l) => hrefDoLink(l))).toHaveLength(1); // o card mostra o botão
  });

  it("vários links: todos válidos viram botão; site continua principal", () => {
    const p = parceiro([site("https://www.falaoperador.com.br/", true), ig("@falaoperadorpdc")]);
    expect(linkPrincipal(p)).toBe("https://www.falaoperador.com.br/");
    expect(p.links.map((l) => hrefDoLink(l))).toEqual(["https://www.falaoperador.com.br/", "https://www.instagram.com/falaoperadorpdc/"]);
  });

  it("normaliza dados antigos sem mexer nos demais campos e mantém o inválido como pendência", () => {
    const antigos = [site("http://arqtek.com.br/", true), ig("@ArqTek"), ig("https://www.instagram.com/p/xyz/")];
    const novos = normalizarLinks(antigos);
    expect(novos[0]).toBe(antigos[0]); // site intocado
    expect(novos[1]).toEqual({ ...antigos[1], url: "https://www.instagram.com/arqtek/" });
    expect(novos[2]).toBe(antigos[2]); // inválido não é "inventado"
    const pend = linksPendentes(parceiro(novos));
    expect(pend).toHaveLength(1);
    expect(pend[0]!.erro).toMatch(/publicação/);
  });

  it("erroDoLink explica cada tipo", () => {
    expect(erroDoLink(ig("@ok_perfil"))).toBeNull();
    expect(erroDoLink(site("nao é url"))).toMatch(/http/);
    expect(erroDoLink({ id: "w", tipo: "whatsapp", telefone: "123" })).toMatch(/WhatsApp/);
    expect(erroDoLink({ id: "o", tipo: "outro", url: "https://x.com" })).toMatch(/rótulo/);
  });
});
