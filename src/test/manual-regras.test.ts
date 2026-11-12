// Regras do manual de regras: texto simples vira HTML seguro e volta a ser editável.
import { describe, expect, it } from "vitest";
import { htmlParaTexto, regrasRecebidas, textoParaHtml } from "@/lib/regras";

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

describe("Manual de regras recebido do editor", () => {
  const base = { titulo: "Manual", versao: "1", atualizadoEm: "2026-11-12", formato: "pdf" as const };

  it("descarta HTML livre (XSS)", () => {
    const r = regrasRecebidas({ ...base, formato: "html" as const, conteudoHtml: "<img src=x onerror=alert(1)>" });
    expect(r).not.toHaveProperty("conteudoHtml");
    expect(r?.formato).toBe("pdf");
  });

  it("mantém PDF em data URL e https, recusa outros esquemas", () => {
    expect(regrasRecebidas({ ...base, pdfDataUrl: "data:application/pdf;base64,JVBE" })?.pdfDataUrl).toBe("data:application/pdf;base64,JVBE");
    expect(regrasRecebidas({ ...base, pdfDataUrl: "https://x.supabase.co/a.pdf" })?.pdfDataUrl).toBe("https://x.supabase.co/a.pdf");
    expect(regrasRecebidas({ ...base, pdfDataUrl: "data:text/html,<script>1</script>" })?.pdfDataUrl).toBeUndefined();
    expect(regrasRecebidas({ ...base, arquivoUrl: "javascript:alert(1)" })?.arquivoUrl).toBeUndefined();
  });
});
