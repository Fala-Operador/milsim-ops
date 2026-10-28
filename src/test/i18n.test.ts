import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { criarTradutor, escolherIdioma, filtrarPorPrefixo, interpolar, langDaBusca } from "@/lib/i18n";
import { blocos, trechos } from "@/lib/textoRico";

describe("escolherIdioma", () => {
  it("?lang vence o cookie, que vence o navegador", () => {
    expect(escolherIdioma({ pedido: "en", cookie: "pt", acceptLanguage: "pt-BR" })).toBe("en");
    expect(escolherIdioma({ pedido: "xx", cookie: "pt", acceptLanguage: "en-US" })).toBe("pt");
    expect(escolherIdioma({ cookie: "en", acceptLanguage: "pt-BR,pt;q=0.9" })).toBe("en");
  });

  it("navegador em português fica em pt; qualquer outro idioma vai para en", () => {
    expect(escolherIdioma({ acceptLanguage: "pt-BR,pt;q=0.9,en;q=0.8" })).toBe("pt");
    expect(escolherIdioma({ acceptLanguage: "pt" })).toBe("pt");
    expect(escolherIdioma({ acceptLanguage: "en-US,en;q=0.9" })).toBe("en");
    expect(escolherIdioma({ acceptLanguage: "es-ES" })).toBe("en");
  });

  it("sem nenhuma pista, documentos legais saem em inglês e o resto em português", () => {
    expect(escolherIdioma({ caminho: "/privacidade" })).toBe("en");
    expect(escolherIdioma({ caminho: "/termos", acceptLanguage: "*" })).toBe("en");
    expect(escolherIdioma({ caminho: "/" })).toBe("pt");
    expect(escolherIdioma({})).toBe("pt");
  });
});

describe("tradutor", () => {
  it("interpola variáveis e mostra a chave quando falta o texto", () => {
    const t = criarTradutor({ "a.b": "Atualizado em {data} ({x})" });
    expect(t("a.b", { data: "28/10/2026" })).toBe("Atualizado em 28/10/2026 ({x})");
    expect(t("nao.existe")).toBe("nao.existe");
    expect(interpolar("{n} itens", { n: 3 })).toBe("3 itens");
  });

  it("filtra por prefixo inteiro", () => {
    expect(filtrarPorPrefixo({ "nav.a": "1", "navx.b": "2", termos: "3", "termos.c.x": "4" }, ["nav", "termos"]))
      .toEqual({ "nav.a": "1", termos: "3", "termos.c.x": "4" });
  });

  it("lê ?lang só quando é texto", () => {
    expect(langDaBusca({ lang: "en" })).toBe("en");
    expect(langDaBusca({ lang: 1 })).toBeUndefined();
    expect(langDaBusca(undefined)).toBeUndefined();
  });
});

describe("texto rico", () => {
  it("separa parágrafos, listas e blocos especiais", () => {
    const r = blocos("Primeiro\nainda o primeiro.\n\n- um\n- **dois**\n\n[[contato]]");
    expect(r.map((b) => b.tipo)).toEqual(["paragrafo", "lista", "especial"]);
    expect(r[0]).toEqual({ tipo: "paragrafo", trechos: [{ tipo: "texto", texto: "Primeiro ainda o primeiro." }] });
    expect(r[2]).toEqual({ tipo: "especial", nome: "contato" });
  });

  it("reconhece negrito, código e links", () => {
    expect(trechos("Use **[aqui](/termos)**, `email` e [Google](https://google.com).")).toEqual([
      { tipo: "texto", texto: "Use " },
      { tipo: "negrito", filhos: [{ tipo: "link", href: "/termos", filhos: [{ tipo: "texto", texto: "aqui" }] }] },
      { tipo: "texto", texto: ", " },
      { tipo: "codigo", texto: "email" },
      { tipo: "texto", texto: " e " },
      { tipo: "link", href: "https://google.com", filhos: [{ tipo: "texto", texto: "Google" }] },
      { tipo: "texto", texto: "." },
    ]);
  });

  it("não aceita links perigosos", () => {
    expect(trechos("[x](javascript:alert(1))")[0]).toMatchObject({ tipo: "texto" });
    expect(trechos("[x](//mal.com)")).toEqual([{ tipo: "texto", texto: "[x](//mal.com)" }]);
    expect(trechos("[x](http://inseguro.com)")).toEqual([{ tipo: "texto", texto: "[x](http://inseguro.com)" }]);
  });
});

// Textos semeados pelas migrations: toda chave tem pt e en, e toda chave fixa usada no código existe.
describe("textos do site no banco", () => {
  const raiz = join(__dirname, "../..");
  const pasta = join(raiz, "supabase/migrations");
  const sql = readdirSync(pasta).filter((f) => f.endsWith(".sql")).sort().map((f) => readFileSync(join(pasta, f), "utf8")).join("\n");
  const linhas = [...sql.matchAll(/\('([a-z0-9_.-]+)', '(pt|en)', '((?:[^']|'')*)'\)/g)].map((m) => ({ chave: m[1]!, idioma: m[2]!, valor: m[3]!.replace(/''/g, "'") }));
  const chaves = (idioma: string) => new Set(linhas.filter((l) => l.idioma === idioma).map((l) => l.chave));

  it("cada chave existe nos dois idiomas", () => {
    expect(linhas.length).toBeGreaterThan(100);
    expect([...chaves("pt")].sort()).toEqual([...chaves("en")].sort());
  });

  it("as chaves fixas usadas no código existem", () => {
    const arquivos = ["src/routes/__root.tsx", "src/routes/index.tsx", "src/components/Header.tsx", "src/components/SobrePlataforma.tsx", "src/components/DocumentoLegal.tsx"];
    const usadas = arquivos.flatMap((a) => [...readFileSync(join(raiz, a), "utf8").matchAll(/\bt\("([a-z0-9_.-]+)"/g)].map((m) => m[1]!));
    expect(usadas.length).toBeGreaterThan(20);
    const pt = chaves("pt");
    expect(usadas.filter((c) => !pt.has(c))).toEqual([]);
  });

  it("cada cláusula dos documentos legais tem título e texto, com os mesmos links nos dois idiomas", () => {
    for (const doc of ["privacidade", "termos"]) {
      const fonte = readFileSync(join(raiz, `src/routes/${doc}.tsx`), "utf8");
      const ids = [.../const CLAUSULAS = \[([^\]]+)\]/.exec(fonte)![1]!.matchAll(/"([a-z-]+)"/g)].map((m) => m[1]!);
      expect(ids.length).toBeGreaterThan(10);
      for (const id of ids) {
        for (const parte of ["titulo", "texto"]) expect(chaves("pt").has(`${doc}.c.${id}.${parte}`)).toBe(true);
        const links = (idioma: string) => [...linhas.find((l) => l.idioma === idioma && l.chave === `${doc}.c.${id}.texto`)!.valor.matchAll(/\]\(([^)]+)\)/g)].map((m) => m[1]).sort();
        expect(links("en")).toEqual(links("pt"));
      }
    }
  });

  it("o aviso de privacidade em inglês traz a declaração de Uso Limitado do Google", () => {
    const google = linhas.find((l) => l.idioma === "en" && l.chave === "privacidade.c.google.texto")!.valor;
    expect(google).toContain("Google API Services User Data Policy");
    expect(google).toContain("Limited Use");
  });
});
