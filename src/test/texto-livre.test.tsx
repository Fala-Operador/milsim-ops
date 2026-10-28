// Texto livre (enredo, descrições): quebras de linha preservadas e nada vira HTML.
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { TextoLivre } from "@/components/ui";

describe("TextoLivre", () => {
  it("mantém parágrafos e quebras de linha como foram digitados", () => {
    const texto = "🎗️ JUNTOS PELO LORENZO 🎗️\n\nO pequeno Lorenzo...\nPIX (CPF): 000";
    const { container } = render(<TextoLivre texto={`  ${texto}  `} className="mt-3" />);
    const p = container.querySelector("p")!;
    expect(p.textContent).toBe(texto);
    expect(p.className).toContain("whitespace-pre-line");
    expect(p.className).toContain("mt-3");
  });

  it("**negrito** e *itálico* viram strong/em, sem os asteriscos", () => {
    const { container } = render(<TextoLivre texto={"meta de **R$ 15 mil**, *urgente*"} />);
    expect(container.querySelector("strong")!.textContent).toBe("R$ 15 mil");
    expect(container.querySelector("em")!.textContent).toBe("urgente");
    expect(container.textContent).toBe("meta de R$ 15 mil, urgente");
  });

  it("não interpreta HTML digitado", () => {
    const { container } = render(<TextoLivre texto="<b>oi</b><script>alert(1)</script>" />);
    expect(container.querySelector("b, script")).toBeNull();
    expect(container.textContent).toBe("<b>oi</b><script>alert(1)</script>");
  });

  it("texto vazio ou só espaços não desenha nada", () => {
    expect(render(<TextoLivre texto="   " />).container.innerHTML).toBe("");
    expect(render(<TextoLivre texto={undefined} />).container.innerHTML).toBe("");
  });
});
