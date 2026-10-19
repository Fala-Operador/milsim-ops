// API do repasse às organizações (Stripe Connect): cadastro da conta de recebimento,
// atualização da situação e acesso ao painel do Stripe. Só quem gere a organização.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { abrirPainelRecebimento, iniciarCadastroRecebimento, sincronizarRecebimento, stripeConfigurado, taxaPlataformaPercentual } from "@/server/pagamentos.server";
import { chamar } from "@/api/cliente";

const entrada = z.object({ organizacaoId: z.string().min(1).max(100) });

/** O que a página precisa saber da plataforma: pagamentos ativos e a taxa cobrada. */
export const configuracaoRepasseFn = createServerFn({ method: "GET" }).handler(() => ({
  pagamentoOnline: stripeConfigurado(),
  taxaPercentual: taxaPlataformaPercentual(),
}));

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
export const abrirPainelStripe = (organizacaoId: string) => abrirPainelRecebimentoFn({ data: { organizacaoId } });
