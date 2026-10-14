// API dos impulsionamentos (somente admin; o serviço também verifica e audita).
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import * as s from "@/services/impulsionamentos";
import { mutar } from "@/server/unidade.server";
import { chamar } from "@/api/cliente";

const abrangencia = z.object({
  escopo: z.enum(["nacional", "regiao", "estado", "cidade"]),
  regiao: z.enum(["Norte", "Nordeste", "Centro-Oeste", "Sudeste", "Sul"]).optional(),
  uf: z.string().max(2).optional(),
  cidade: z.string().max(120).optional(),
});

const dados = z.object({
  id: z.string().max(100).optional(),
  eventoId: z.string().min(1).max(100),
  nome: z.string().max(120),
  objetivo: z.enum(["divulgacao", "inscricoes"]),
  posicoes: z.array(z.string().min(1).max(100)).max(30),
  abrangencia,
  inicioEm: z.string().datetime(),
  fimEm: z.string().datetime(),
  fuso: z.string().min(1).max(60),
  prioridade: z.enum(["normal", "alta"]),
  ordem: z.number().int().min(0).max(999),
  imagemPromocional: z.string().url().max(2000).regex(/^https:\/\//, "Use um endereço https.").optional(),
  chamada: z.string().max(120).optional(),
  ativar: z.boolean(),
});

export const salvarImpulsionamentoFn = createServerFn({ method: "POST" })
  .validator((v: unknown) => dados.parse(v) as s.DadosImpulsionamento)
  .handler(({ data }) => mutar(({ usuario }) => s.salvarImpulsionamento(usuario, data)));

export const alterarImpulsionamentoFn = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.string().min(1).max(100), acao: z.enum(["pausar", "retomar", "encerrar"]) }).parse)
  .handler(({ data }) => mutar(({ usuario }) => s.alterarImpulsionamento(usuario, data.id, data.acao)));

export const salvarImpulsionamento = (d: s.DadosImpulsionamento) => chamar(salvarImpulsionamentoFn({ data: d }));
export const alterarImpulsionamento = (id: string, acao: s.AcaoImpulsionamento) => chamar(alterarImpulsionamentoFn({ data: { id, acao } }));
