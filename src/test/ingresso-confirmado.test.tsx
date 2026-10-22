import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Inscricao } from "@/lib/domain/types";

const consultarEntrada = vi.fn();
vi.mock("@/api/checkin.functions", () => ({ consultarEntrada: (id: string) => consultarEntrada(id) }));
vi.mock("@/services/checkin", () => ({ tokenDaInscricao: () => "Ttoken" }));
vi.mock("qrcode", () => ({ default: { toDataURL: vi.fn(async () => "data:image/png;base64,AAAA") } }));

import { IngressoQr } from "@/components/IngressoQr";

const inscricao = { id: "ins-1", codigo: "ABC123" } as Inscricao;

beforeEach(() => {
  vi.useFakeTimers();
  consultarEntrada.mockReset();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("QR Code do ingresso", () => {
  it("troca o QR pela confirmação quando a portaria confirma a entrada e fecha após 15s", async () => {
    consultarEntrada.mockResolvedValueOnce({ confirmada: false });
    consultarEntrada.mockResolvedValue({ confirmada: true, em: "2026-10-22T14:00:00.000Z" });
    const onFechar = vi.fn();
    render(<IngressoQr inscricao={inscricao} evento={undefined} usuarioId="u1" onFechar={onFechar} />);
    await act(async () => {});
    expect(screen.getByAltText(/QR Code de entrada/)).toBeTruthy();
    expect(screen.queryByText("Entrada confirmada")).toBeNull();

    await act(async () => { await vi.advanceTimersByTimeAsync(3000); });
    expect(screen.getByText("Entrada confirmada")).toBeTruthy();
    expect(screen.queryByAltText(/QR Code de entrada/)).toBeNull();

    await act(async () => { await vi.advanceTimersByTimeAsync(14_000); });
    expect(onFechar).not.toHaveBeenCalled();
    await act(async () => { await vi.advanceTimersByTimeAsync(1_000); });
    expect(onFechar).toHaveBeenCalledTimes(1);
  });

  it("segue mostrando o QR quando a consulta falha (ex.: sem sinal)", async () => {
    consultarEntrada.mockRejectedValue(new Error("offline"));
    render(<IngressoQr inscricao={inscricao} evento={undefined} usuarioId="u1" onFechar={() => {}} />);
    await act(async () => { await vi.advanceTimersByTimeAsync(10_000); });
    expect(screen.getByAltText(/QR Code de entrada/)).toBeTruthy();
    expect(consultarEntrada.mock.calls.length).toBeGreaterThan(1);
  });
});
