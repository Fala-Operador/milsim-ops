import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const entrada = z.object({
  resumo: z.record(z.any()),
  pergunta: z.string().max(1000).optional(),
});

export const gerarInsights = createServerFn({ method: "POST" })
  .validator((d: unknown) => entrada.parse(d))
  .handler(async ({ data }) => {
    const { gerarInsightsIA } = await import("./insights.server");
    try {
      return { ok: true as const, texto: await gerarInsightsIA(data.resumo, data.pergunta) };
    } catch (e) {
      return { ok: false as const, erro: e instanceof Error ? e.message : "Falha ao gerar análise." };
    }
  });
