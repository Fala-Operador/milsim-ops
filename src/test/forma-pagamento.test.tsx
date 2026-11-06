// Janela da forma de pagamento (Meus ingressos e impulsos): pergunta só com mais de uma opção
// para o total e entrega a escolhida a quem abre o checkout.
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { MetodoPagamento } from "@/lib/stripe";

const metodos = vi.fn<() => Promise<MetodoPagamento[]>>();
vi.mock("@/api/sessao.functions", () => ({ metodosPagamentoFn: () => metodos() }));

import { useEscolhaFormaPagamento } from "@/components/FormaPagamento";

function Tela({ total, seguir }: { total: number; seguir: (m: MetodoPagamento | undefined) => Promise<void> }) {
  const { pedirForma, janela } = useEscolhaFormaPagamento();
  return (
    <>
      <button type="button" onClick={() => void pedirForma(total, seguir)}>Pagar</button>
      {janela}
    </>
  );
}

afterEach(() => { cleanup(); metodos.mockReset(); });

describe("escolha da forma de pagamento", () => {
  it("com mais de uma opção, abre a janela e segue com a escolhida", async () => {
    metodos.mockResolvedValue(["card", "pix", "boleto"]);
    const seguir = vi.fn(async () => {});
    render(<Tela total={4490} seguir={seguir} />);
    await act(async () => { fireEvent.click(screen.getByText("Pagar")); });
    expect(screen.getByRole("radio", { name: /Pix/ })).toBeTruthy();
    expect(screen.getByRole("radio", { name: /Boleto/ })).toBeTruthy();
    expect(seguir).not.toHaveBeenCalled();

    await act(async () => { fireEvent.click(screen.getByText("Ir para o pagamento")); });
    expect(screen.getByRole("alert").textContent).toContain("Escolha a forma de pagamento");
    await act(async () => { fireEvent.click(screen.getByRole("radio", { name: /Pix/ })); });
    await act(async () => { fireEvent.click(screen.getByText("Ir para o pagamento")); });
    expect(seguir).toHaveBeenCalledWith("pix");
  });

  it("esconde o Boleto abaixo de R$ 5,00 e, com uma opção só, segue direto sem forma", async () => {
    metodos.mockResolvedValue(["card", "boleto"]);
    const seguir = vi.fn(async () => {});
    render(<Tela total={300} seguir={seguir} />);
    await act(async () => { fireEvent.click(screen.getByText("Pagar")); });
    expect(screen.queryByRole("radio")).toBeNull();
    expect(seguir).toHaveBeenCalledWith(undefined);
  });

  it("mostra na janela o erro de quem abre o checkout", async () => {
    metodos.mockResolvedValue(["card", "pix"]);
    const seguir = vi.fn(async () => { throw new Error("Esta forma de pagamento não está disponível para este valor. Escolha outra."); });
    render(<Tela total={4490} seguir={seguir} />);
    await act(async () => { fireEvent.click(screen.getByText("Pagar")); });
    await act(async () => { fireEvent.click(screen.getByRole("radio", { name: /Cartão/ })); });
    await act(async () => { fireEvent.click(screen.getByText("Ir para o pagamento")); });
    expect(screen.getByRole("alert").textContent).toContain("não está disponível");
  });
});
