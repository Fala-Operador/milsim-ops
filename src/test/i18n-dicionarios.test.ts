// Dicionários de textos de tela (src/i18n/): toda chave tem português e inglês com as mesmas
// variáveis, toda chave é usada no código e o inglês vazio cai no português.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { dicionario, dicionariosRegistrados } from "@/i18n/dicionario";
import { definirIdiomaLocal } from "@/lib/idiomaAtual";

import.meta.glob("../i18n/**/*.ts", { eager: true });

const raiz = join(__dirname, "..");
function arquivos(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const c = join(dir, n);
    return statSync(c).isDirectory() ? (n === "i18n" || n === "test" ? [] : arquivos(c)) : /\.tsx?$/.test(n) ? [c] : [];
  });
}
const variaveis = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

describe("dicionários de tela", () => {
  const dicionarios = Object.entries(dicionariosRegistrados()).filter(([area]) => !area.startsWith("teste/"));

  it("estão carregados", () => {
    expect(dicionarios.length).toBeGreaterThan(10);
  });

  it("cada texto tem português e inglês, com as mesmas variáveis", () => {
    const problemas: string[] = [];
    for (const [area, d] of dicionarios) {
      for (const [chave, par] of Object.entries(d)) {
        if (!par.pt.trim()) problemas.push(`${area}:${chave} sem português`);
        if (!par.en.trim()) problemas.push(`${area}:${chave} sem inglês`);
        if (variaveis(par.pt).join() !== variaveis(par.en).join()) problemas.push(`${area}:${chave} com variáveis diferentes`);
      }
    }
    expect(problemas).toEqual([]);
  });

  it("toda chave é usada no código", () => {
    const fonte = arquivos(raiz).map((f) => readFileSync(f, "utf8")).join("\n");
    const sobrando: string[] = [];
    for (const [area, d] of dicionarios) {
      for (const chave of Object.keys(d)) if (!fonte.includes(`"${chave}"`)) sobrando.push(`${area}:${chave}`);
    }
    expect(sobrando).toEqual([]);
  });
});

describe("tradutor de dicionário", () => {
  afterEach(() => definirIdiomaLocal("pt"));
  const t = dicionario("teste/exemplo", {
    ola: { pt: "Olá, {nome}", en: "Hi, {nome}" },
    so_pt: { pt: "Só português", en: "" },
    um: { pt: "{n} vaga", en: "{n} spot" },
    varios: { pt: "{n} vagas", en: "{n} spots" },
  });

  it("segue o idioma da página e interpola", () => {
    expect(t("ola", { nome: "Ana" })).toBe("Olá, Ana");
    definirIdiomaLocal("en");
    expect(t("ola", { nome: "Ana" })).toBe("Hi, Ana");
    expect(t.plural(2, "um", "varios")).toBe("2 spots");
  });

  it("inglês vazio cai no português; idioma explícito vence o da página", () => {
    definirIdiomaLocal("en");
    expect(t("so_pt")).toBe("Só português");
    expect(t.em("pt")("ola", { nome: "Bia" })).toBe("Olá, Bia");
    expect(t.plural(1, "um", "varios")).toBe("1 spot");
  });
});
