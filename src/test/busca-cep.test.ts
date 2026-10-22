// Autopreenchimento por CEP (ViaCEP simulado): consulta com 8 dígitos, erros claros e sem
// sobrescrever o CEP com que o formulário abriu.
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { consultarCep } from "@/services/geolocalizacao";
import { useBuscaCep } from "@/hooks/useBuscaCep";

const VIA_CEP = { logradouro: "Avenida Paulista", bairro: "Bela Vista", localidade: "São Paulo", uf: "SP" };

function respostas(corpo: unknown, status = 200) {
  const f = vi.fn(async () => new Response(JSON.stringify(corpo), { status }));
  vi.stubGlobal("fetch", f);
  return f;
}

afterEach(() => vi.unstubAllGlobals());

describe("consultarCep", () => {
  it("envia só os dígitos e devolve o endereço", async () => {
    const f = respostas(VIA_CEP);
    await expect(consultarCep("01310-100")).resolves.toEqual({ logradouro: "Avenida Paulista", bairro: "Bela Vista", cidade: "São Paulo", uf: "SP" });
    expect(f).toHaveBeenCalledWith("https://viacep.com.br/ws/01310100/json/", expect.anything());
  });

  it("CEP incompleto não consulta; inexistente e falha de rede têm mensagens próprias", async () => {
    const f = respostas({ erro: true });
    await expect(consultarCep("0131")).rejects.toThrow("CEP inválido.");
    expect(f).not.toHaveBeenCalled();
    await expect(consultarCep("99999-999")).rejects.toThrow("CEP não encontrado.");
    vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("rede"); }));
    await expect(consultarCep("01310-100")).rejects.toThrow("Não foi possível consultar o CEP agora.");
  });
});

describe("useBuscaCep", () => {
  it("consulta ao completar 8 dígitos e entrega o endereço", async () => {
    respostas(VIA_CEP);
    const aoEncontrar = vi.fn();
    const { result, rerender } = renderHook(({ cep }) => useBuscaCep(cep, aoEncontrar), { initialProps: { cep: "0131" } });
    expect(result.current.status).toBe("ocioso");
    rerender({ cep: "01310-100" });
    await waitFor(() => expect(result.current.status).toBe("encontrado"));
    expect(aoEncontrar).toHaveBeenCalledWith(expect.objectContaining({ cidade: "São Paulo", uf: "SP" }));
  });

  it("não sobrescreve o CEP com que o formulário abriu", async () => {
    const f = respostas(VIA_CEP);
    const aoEncontrar = vi.fn();
    const { result } = renderHook(() => useBuscaCep("01310-100", aoEncontrar));
    await new Promise((r) => setTimeout(r, 20));
    expect(f).not.toHaveBeenCalled();
    expect(aoEncontrar).not.toHaveBeenCalled();
    expect(result.current.status).toBe("ocioso");
  });

  it("CEP inexistente vira erro, sem preencher nada", async () => {
    respostas({ erro: true });
    const aoEncontrar = vi.fn();
    const { result, rerender } = renderHook(({ cep }) => useBuscaCep(cep, aoEncontrar), { initialProps: { cep: "" } });
    rerender({ cep: "99999-999" });
    await waitFor(() => expect(result.current).toEqual({ status: "erro", mensagem: "CEP não encontrado." }));
    expect(aoEncontrar).not.toHaveBeenCalled();
  });
});
