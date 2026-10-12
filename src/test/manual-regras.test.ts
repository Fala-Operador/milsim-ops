// Regras do manual de regras: texto simples vira HTML seguro e volta a ser editável.
import { describe, expect, it } from "vitest";
import { htmlParaTexto, textoParaHtml } from "@/lib/regras";

describe("Manual de regras", () => {
  it("monta título, parágrafo e lista a partir do texto simples", () => {
    const html = textoParaHtml("## Segurança\n\nLimite de 350 FPS.\n\n- Óculos\n- Touca");
    expect(html).toBe("<h2>Segurança</h2><p>Limite de 350 FPS.</p><ul><li>Óculos</li><li>Touca</li></ul>");
  });

  it("escapa HTML digitado no conteúdo em vez de executar", () => {
    expect(textoParaHtml("<script>alert(1)</script>")).toBe("<p>&lt;script&gt;alert(1)&lt;/script&gt;</p>");
  });

  it("devolve o texto editável ao reabrir o formulário", () => {
    const html = "<h2>Segurança</h2><p>Limite de 350 FPS.</p><ul><li>Óculos</li><li>Touca</li></ul>";
    expect(htmlParaTexto(html)).toBe("## Segurança\n\nLimite de 350 FPS.\n\n- Óculos\n- Touca");
  });
});
