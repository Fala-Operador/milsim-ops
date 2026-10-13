// API da página inicial e divulgação (somente admin; o serviço também verifica e audita).
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import * as d from "@/services/divulgacao";
import { mutar } from "@/server/unidade.server";
import { chamar } from "@/api/cliente";
import type { DadosParceiro, DadosSecao } from "@/services/divulgacao";
import type { StatusSecao } from "@/lib/domain/types";

const id = z.string().min(1).max(100);
// Estruturas aninhadas (destaques, banner, links) são validadas pelo serviço.
const objeto = z.object({}).passthrough();

export const salvarSecaoFn = createServerFn({ method: "POST" })
  .validator((v: unknown) => objeto.parse(v) as unknown as DadosSecao)
  .handler(({ data }) => mutar(({ usuario }) => d.salvarSecao(usuario, data)));

export const alterarStatusSecaoFn = createServerFn({ method: "POST" })
  .validator(z.object({ id, status: z.enum(["rascunho", "publicada", "desativada"]) }).parse)
  .handler(({ data }) => mutar(({ usuario }) => d.alterarStatusSecao(usuario, data.id, data.status)));

export const excluirSecaoFn = createServerFn({ method: "POST" })
  .validator(z.object({ id }).parse)
  .handler(({ data }) => mutar(({ usuario }) => d.excluirSecao(usuario, data.id)));

export const reordenarSecoesFn = createServerFn({ method: "POST" })
  .validator(z.object({ ids: z.array(id).max(200) }).parse)
  .handler(({ data }) => mutar(({ usuario }) => d.reordenarSecoes(usuario, data.ids)));

export const salvarParceiroFn = createServerFn({ method: "POST" })
  .validator((v: unknown) => objeto.parse(v) as unknown as DadosParceiro)
  .handler(({ data }) => mutar(({ usuario }) => d.salvarParceiro(usuario, data)));

export const excluirParceiroFn = createServerFn({ method: "POST" })
  .validator(z.object({ id }).parse)
  .handler(({ data }) => mutar(({ usuario }) => d.excluirParceiro(usuario, data.id)));

// ---------- Uso no navegador ----------
export const salvarSecao = (dados: DadosSecao) => chamar(salvarSecaoFn({ data: dados }));
export const alterarStatusSecao = (secaoId: string, status: StatusSecao) => chamar(alterarStatusSecaoFn({ data: { id: secaoId, status } }));
export const excluirSecao = (secaoId: string) => chamar(excluirSecaoFn({ data: { id: secaoId } }));
export const reordenarSecoes = (ids: string[]) => chamar(reordenarSecoesFn({ data: { ids } }));
export const salvarParceiro = (dados: DadosParceiro) => chamar(salvarParceiroFn({ data: dados }));
export const excluirParceiro = (parceiroId: string) => chamar(excluirParceiroFn({ data: { id: parceiroId } }));
