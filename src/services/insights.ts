// Orquestra a análise: monta o resumo agregado e chama o servidor (Lovable AI).
import { carregarBase } from "@/services/db";
import { gerarInsights } from "@/lib/insights.functions";
import { lerResultado, montarResumo, type PeriodoAnalise, type ResultadoAnalise, type ResumoAnalise } from "@/lib/insights";

export const resumoAtual = (periodo: PeriodoAnalise): ResumoAnalise => montarResumo(carregarBase(), periodo);

export async function analisar(resumo: ResumoAnalise, pergunta: string): Promise<ResultadoAnalise> {
  const r = await gerarInsights({ data: { resumo: resumo as unknown as Record<string, unknown>, pergunta: pergunta.trim() || undefined } });
  if (!r.ok) throw new Error(r.erro);
  return lerResultado(r.texto);
}
