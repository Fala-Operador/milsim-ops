import { createOpenAI } from "@ai-sdk/openai";
import { streamText } from "ai";

const RUN_HEADER = "X-Lovable-AIG-Run-ID";

export async function gerarInsightsIA(resumo: unknown, pergunta?: string): Promise<string> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new Error("Lovable AI não está configurado.");
  let runId: string | undefined;
  const provider = createOpenAI({
    baseURL: "https://ai.gateway.lovable.dev/v1",
    apiKey,
    headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
    fetch: async (input, init) => {
      const headers = new Headers(init?.headers);
      if (runId) headers.set(RUN_HEADER, runId);
      const res = await fetch(input, { ...init, headers });
      if (!res.ok) {
        if (res.status === 402) throw new Error("Créditos de IA esgotados. Adicione créditos em Configurações → Planos e créditos.");
        if (res.status === 429) throw new Error("Muitas requisições. Tente novamente em instantes.");
        if (res.status === 403) throw new Error("Acesso à IA negado para este workspace.");
      }
      runId ??= res.headers.get(RUN_HEADER) ?? undefined;
      return res;
    },
  });

  const result = streamText({
    model: provider.responses("openai/gpt-6-astra"),
    instructions:
      "Você é um analista de operações de eventos de airsoft/milsim no Brasil. Analise apenas os dados agregados fornecidos (JSON) e responda em português do Brasil, em Markdown simples, exatamente com as seções: '## Panorama geral' (2-3 frases curtas), '## Pontos de atenção', '## Oportunidades' e '## Próximas ações'. Nas três últimas, cada item é uma linha '- Observado: ... | Evidência: ... | Ação: ...', onde a evidência cita números presentes nos dados. Não invente percentuais, previsões nem níveis de confiança. Não trate correlação como causa (ex.: baixa inscrição não prova falta de divulgação). Quando faltar informação, diga qual é a limitação.",
    messages: [
      {
        role: "user",
        content: `Dados:\n${JSON.stringify(resumo)}\n\n${pergunta?.trim() ? `Pergunta do administrador: ${pergunta.trim()}` : "Gere a análise geral."}`,
      },
    ],
    providerOptions: {
      openai: {
        store: false,
        forceReasoning: true,
        reasoningEffort: "low",
        reasoningSummary: "auto",
        include: ["reasoning.encrypted_content"],
      },
    },
  } as Parameters<typeof streamText>[0]);

  const texto = await result.text;
  if (!texto.trim()) throw new Error("A IA não retornou uma análise. Tente novamente mais tarde.");
  return texto;
}
