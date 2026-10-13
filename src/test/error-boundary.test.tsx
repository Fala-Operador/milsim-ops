import { render, screen } from "@testing-library/react";
import { Component, type ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { ErroSecao } from "@/components/ui";

// Limite de erro clássico para simular o que o errorComponent das rotas faz:
// uma quebra de renderização dentro da árvore deve cair na tela de recuperação.
class LimiteErro extends Component<{ children: ReactNode }, { quebrou: boolean }> {
  state = { quebrou: false };
  static getDerivedStateFromError() {
    return { quebrou: true };
  }
  componentDidCatch(error: unknown) {
    void error;
  }
  render() {
    if (this.state.quebrou) return <ErroSecao onTentar={() => this.setState({ quebrou: false })} />;
    return this.props.children;
  }
}

function Bomba(): ReactNode {
  throw new Error("falha de runtime simulada");
}

describe("Error Boundary de seção", () => {
  it("mostra mensagem de recuperação em vez de tela em branco quando um filho quebra", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    render(
      <LimiteErro>
        <Bomba />
      </LimiteErro>,
    );

    expect(screen.getByRole("alert")).toHaveTextContent("Esta seção não carregou");
    expect(screen.getByRole("button", { name: "Tentar novamente" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Voltar ao início" })).toHaveAttribute("href", "/");
  });

  it("o botão Tentar novamente restaura o conteúdo quando o erro some", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    let quebrar = true;
    function TalvezQuebre() {
      if (quebrar) throw new Error("falha temporária");
      return <p>Conteúdo recuperado</p>;
    }
    render(
      <LimiteErro>
        <TalvezQuebre />
      </LimiteErro>,
    );

    quebrar = false;
    screen.getByRole("button", { name: "Tentar novamente" }).click();

    expect(await screen.findByText("Conteúdo recuperado")).toBeInTheDocument();
  });
});
