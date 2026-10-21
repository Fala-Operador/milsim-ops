// API dos impulsos comprados pelas organizações: compra (Stripe Checkout da plataforma),
// retomada e retorno do pagamento, uso num evento, e os preços definidos pela administração.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { abrirCheckoutImpulso, comprarImpulso as comprar, sincronizarSessaoImpulso } from "@/server/pagamentos.server";
import { exigirAdmin, mutar } from "@/server/unidade.server";
import { salvarPlanosImpulsoNaBase, usarImpulsoNaBase, type DadosPlanoImpulso } from "@/services/impulsos";
import { IDS_PLANO_IMPULSO } from "@/lib/impulsos";
import type { PlanoImpulsoId } from "@/lib/domain/types";
import { chamar } from "@/api/cliente";

const id = z.string().min(1).max(100);
const planoId = z.enum(IDS_PLANO_IMPULSO);

export const comprarImpulsoFn = createServerFn({ method: "POST" })
  .validator(z.object({ planoId }).parse)
  .handler(({ data }) => comprar(data.planoId));

export const retomarPagamentoImpulsoFn = createServerFn({ method: "POST" })
  .validator(z.object({ impulsoId: id }).parse)
  .handler(({ data }) => abrirCheckoutImpulso(data.impulsoId));

export const sincronizarPagamentoImpulsoFn = createServerFn({ method: "POST" })
  .validator(z.object({ sessaoId: z.string().min(1).max(300) }).parse)
  .handler(({ data }) => sincronizarSessaoImpulso(data.sessaoId));

export const usarImpulsoFn = createServerFn({ method: "POST" })
  .validator(z.object({ impulsoId: id, eventoId: id }).parse)
  .handler(({ data }) => mutar(({ base, usuario }) => usarImpulsoNaBase(base, usuario, data.impulsoId, data.eventoId)));

export const salvarPlanosImpulsoFn = createServerFn({ method: "POST" })
  .validator(z.object({
    planos: z.array(z.object({
      id: planoId,
      precoCentavos: z.number().int().min(0).max(1_000_000),
      validadeDias: z.number().int().min(1).max(365),
      ativo: z.boolean(),
    })).min(1).max(IDS_PLANO_IMPULSO.length),
  }).parse)
  .handler(({ data }) => mutar(({ base, usuario }) => salvarPlanosImpulsoNaBase(base, exigirAdmin(usuario), data.planos)));

// ---------- Uso no navegador ----------
export const comprarImpulso = (p: PlanoImpulsoId) => chamar(comprarImpulsoFn({ data: { planoId: p } }));
export const retomarPagamentoImpulso = (impulsoId: string) => chamar(retomarPagamentoImpulsoFn({ data: { impulsoId } }));
export const sincronizarPagamentoImpulso = (sessaoId: string) => chamar(sincronizarPagamentoImpulsoFn({ data: { sessaoId } }));
export const usarImpulso = (impulsoId: string, eventoId: string) => chamar(usarImpulsoFn({ data: { impulsoId, eventoId } }));
export const salvarPlanosImpulso = (planos: DadosPlanoImpulso[]) => chamar(salvarPlanosImpulsoFn({ data: { planos } }));
