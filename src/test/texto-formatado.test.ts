// **negrito** e *itálico* no texto livre, sem falsos positivos.
import { describe, it, expect } from "vitest";
import { formatarTexto } from "@/lib/textoFormatado";

describe("formatarTexto", () => {
  it("negrito no meio da frase e em linha inteira", () => {
    expect(formatarTexto("a meta é **R$ 15 mil** para o tratamento")).toEqual([
      { tipo: "texto", texto: "a meta é " },
      { tipo: "negrito", texto: "R$ 15 mil" },
      { tipo: "texto", texto: " para o tratamento" },
    ]);
    expect(formatarTexto("🎗️ **JUNTOS PELO LORENZO** 🎗️\n**PIX (CPF): 000**")).toEqual([
      { tipo: "texto", texto: "🎗️ " },
      { tipo: "negrito", texto: "JUNTOS PELO LORENZO" },
      { tipo: "texto", texto: " 🎗️\n" },
      { tipo: "negrito", texto: "PIX (CPF): 000" },
    ]);
  });

  it("itálico com um asterisco", () => {
    expect(formatarTexto("leve *sempre* o colete")).toEqual([
      { tipo: "texto", texto: "leve " },
      { tipo: "italico", texto: "sempre" },
      { tipo: "texto", texto: " o colete" },
    ]);
  });

  it.each([
    "sem marcação nenhuma",
    "conta 5*3*2 = 30",
    "asterisco solto * no meio",
    "** espaço depois de abrir**",
    "**espaço antes de fechar **",
    "****",
    "nota* de rodapé*",
  ])("deixa como texto: %s", (t) => {
    expect(formatarTexto(t)).toEqual([{ tipo: "texto", texto: t }]);
  });

  it("marcação nunca vira HTML: o conteúdo continua texto", () => {
    expect(formatarTexto("**<script>x</script>**")).toEqual([{ tipo: "negrito", texto: "<script>x</script>" }]);
  });
});
