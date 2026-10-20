// API de gamificação: insígnias, campanhas (admin e organização) e correções de participação.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import * as gam from "@/services/gamificacao";
import { exigirUsuario, mutar } from "@/server/unidade.server";
import { chamar } from "@/api/cliente";

const id = z.string().min(1).max(120);

export const salvarInsigniaFn = createServerFn({ method: "POST" })
  .validator(z.object({
    id: id.optional(), nome: z.string().max(100), descricao: z.string().max(400), icone: z.string().max(16),
    criterio: z.object({ tipo: z.enum(["operacoes", "estados", "modalidades", "missoes"]), meta: z.number().int() }), ativa: z.boolean(),
  }).parse)
  .handler(({ data }) => mutar(({ base, usuario }) => gam.salvarInsignia(base, exigirUsuario(usuario), data)));

const campanha = z.object({
  id: id.optional(), nome: z.string().max(120), descricao: z.string().max(600), insigniaId: id, organizacaoId: id,
  tipo: z.enum(["percentual", "fixo", "gratuito"]), valor: z.number().int().min(0).max(10_000_000),
  eventosElegiveis: z.array(id).max(100), tiposElegiveis: z.array(id).max(200),
  maximo: z.number().int().min(1).max(100_000), limitePorParticipante: z.number().int().min(1).max(10),
  inicioEm: z.string().max(40), conquistarAte: z.string().max(40), resgatarAte: z.string().max(40),
  regras: z.string().max(1200), aceitaAnteriores: z.boolean(), ativa: z.boolean(), autorizacao: z.string().max(300).optional(),
});

export const salvarCampanhaFn = createServerFn({ method: "POST" })
  .validator(campanha.parse)
  .handler(({ data }) => mutar(({ base, usuario }) => gam.salvarCampanha(base, exigirUsuario(usuario), data)));

export const corrigirParticipacaoFn = createServerFn({ method: "POST" })
  .validator(z.object({ usuarioId: id, eventoId: id, tipo: z.enum(["invalidar", "validar"]), justificativa: z.string().max(1000) }).parse)
  .handler(({ data }) => mutar(({ base, usuario }) => gam.corrigirParticipacao(base, exigirUsuario(usuario), data)));

export const salvarInsignia = (d: gam.DadosInsignia) => chamar(salvarInsigniaFn({ data: d }));
export const salvarCampanha = (d: gam.DadosCampanha) => chamar(salvarCampanhaFn({ data: d }));
export const corrigirParticipacao = (d: { usuarioId: string; eventoId: string; tipo: "invalidar" | "validar"; justificativa: string }) => chamar(corrigirParticipacaoFn({ data: d }));
