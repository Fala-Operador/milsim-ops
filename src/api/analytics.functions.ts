// API de métricas: coleta anônima em lote, leitura (organização/admin) e campanhas.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { tratarErro } from "@/server/unidade.server";
import * as analytics from "@/server/analytics.server";
import type { OrigemCampanha, RegistroAnalytics } from "@/lib/analytics";

const curto = z.string().min(1).max(120);
const registro = z.object({
  id: curto,
  tipo: z.enum(["exibicao", "clique", "visita", "clique_inscrever", "inscricao_iniciada", "inscricao_confirmada", "cortesia_resgatada", "inclusao_administrativa"]),
  eventoId: curto,
  visitanteId: curto,
  sessaoId: curto,
  origem: z.enum(["inicio", "destaques", "regional", "busca", "campanha", "direto"]),
  secaoId: curto.optional(),
  posicao: z.number().int().min(0).max(1000).optional(),
  campanhaId: curto.optional(),
  fluxoId: curto.optional(),
  inscricaoId: curto.optional(),
  em: z.number(),
});

async function comMensagem<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    tratarErro(e);
  }
}

export const registrarAnalyticsFn = createServerFn({ method: "POST" })
  .validator(z.object({ registros: z.array(registro).max(50) }).parse)
  .handler(({ data }) => comMensagem(() => analytics.registrar(data.registros as RegistroAnalytics[])));

export const listarAnalyticsFn = createServerFn({ method: "GET" }).handler(() => comMensagem(() => analytics.listar()));

export const criarCampanhaFn = createServerFn({ method: "POST" })
  .validator(z.object({ eventoId: curto, nome: z.string().trim().min(1, "Digite um nome para identificar a campanha.").max(60), origem: z.enum(["instagram", "whatsapp", "parceiro", "lancamento", "outro"]) }).parse)
  .handler(({ data }) => comMensagem(() => analytics.criarCampanha(data.eventoId, data.nome, data.origem)));

// ---------- Uso no navegador ----------
export const enviarRegistros = (registros: RegistroAnalytics[]) => registrarAnalyticsFn({ data: { registros } });
export const listarMetricas = () => listarAnalyticsFn();
export const criarCampanha = (eventoId: string, nome: string, origem: OrigemCampanha) =>
  criarCampanhaFn({ data: { eventoId, nome, origem } });
