// API do repasse às organizações (Stripe Connect): cadastro da conta de recebimento,
// atualização da situação e acesso ao painel do Stripe (só quem gere a organização), e a
// taxa da plataforma, definida pela administração e guardada em configuracoes_plataforma.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { abrirPainelRecebimento, iniciarCadastroRecebimento, sincronizarRecebimento, stripeConfigurado } from "@/server/pagamentos.server";
import { exigirAdmin, mutar } from "@/server/unidade.server";
import { definirTaxaPlataformaNaBase } from "@/services/repasses";
import { chamar } from "@/api/cliente";

const entrada = z.object({ organizacaoId: z.string().min(1).max(100) });

/** Se os pagamentos online estão ativos (a taxa chega pela visão, em `configuracoes`). */
export const configuracaoRepasseFn = createServerFn({ method: "GET" }).handler(() => ({
  pagamentoOnline: stripeConfigurado(),
}));

export const definirTaxaPlataformaFn = createServerFn({ method: "POST" })
  .validator(z.object({ percentual: z.number().min(0).max(100) }).parse)
  .handler(({ data }) =>
    mutar(({ base, usuario }) => definirTaxaPlataformaNaBase(base, data.percentual, exigirAdmin(usuario).id)),
  );

export const iniciarCadastroRecebimentoFn = createServerFn({ method: "POST" })
  .validator(entrada.parse)
  .handler(({ data }) => iniciarCadastroRecebimento(data.organizacaoId));

export const sincronizarRecebimentoFn = createServerFn({ method: "POST" })
  .validator(entrada.parse)
  .handler(({ data }) => sincronizarRecebimento(data.organizacaoId));

export const abrirPainelRecebimentoFn = createServerFn({ method: "POST" })
  .validator(entrada.parse)
  .handler(({ data }) => abrirPainelRecebimento(data.organizacaoId));

// ---------- Uso no navegador ----------
export const configuracaoRepasse = () => configuracaoRepasseFn();
export const cadastrarRecebimento = (organizacaoId: string) => chamar(iniciarCadastroRecebimentoFn({ data: { organizacaoId } }));
export const atualizarRecebimento = (organizacaoId: string) => chamar(sincronizarRecebimentoFn({ data: { organizacaoId } }));
export const definirTaxaPlataforma = (percentual: number) => chamar(definirTaxaPlataformaFn({ data: { percentual } }));
export const abrirPainelStripe = (organizacaoId: string) => abrirPainelRecebimentoFn({ data: { organizacaoId } });
