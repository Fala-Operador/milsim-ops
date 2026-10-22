import { describe, expect, it } from "vitest";
import { tempoRelativo } from "@/lib/tempoRelativo";

const AGORA = new Date("2026-10-21T15:00:00Z");
const antes = (ms: number) => new Date(AGORA.getTime() - ms).toISOString();
const MIN = 60_000;

describe("tempo relativo das notificações", () => {
  it("minutos, horas e dias", () => {
    expect(tempoRelativo(antes(20_000), AGORA)).toBe("agora");
    expect(tempoRelativo(antes(5 * MIN), AGORA)).toBe("há 5 min");
    expect(tempoRelativo(antes(3 * 60 * MIN), AGORA)).toBe("há 3 h");
    expect(tempoRelativo(antes(30 * 60 * MIN), AGORA)).toBe("ontem");
    expect(tempoRelativo(antes(4 * 24 * 60 * MIN), AGORA)).toBe("há 4 dias");
  });

  it("depois de uma semana mostra a data; inválido fica vazio", () => {
    expect(tempoRelativo("2026-10-01T12:00:00Z", AGORA)).toMatch(/^\d{2}\/\d{2}\/2026$/);
    expect(tempoRelativo("x", AGORA)).toBe("");
  });
});
