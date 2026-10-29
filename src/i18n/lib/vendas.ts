// Textos de src/lib/vendas.ts.
import { dicionario } from "@/i18n/dicionario";

export const tr = dicionario("lib/vendas", {
  "nenhum_lote_de_venda_configurado": { pt: "nenhum lote de venda configurado", en: "no sales batch configured" },
  "as_vendas_ainda_nao_comecaram": { pt: "as vendas ainda não começaram", en: "sales have not started yet" },
  "o_periodo_de_vendas_terminou": { pt: "o período de vendas terminou", en: "the sales period has ended" },
  "o_lote_de_venda_esta_inativo": { pt: "o lote de venda está inativo", en: "the sales batch is inactive" },
  "as_vagas_do_lote_esgotaram": { pt: "as vagas do lote esgotaram", en: "the batch spots are sold out" },
  "este_tipo_de_ingresso_esgotou": { pt: "este tipo de ingresso esgotou", en: "this ticket type is sold out" },
  "informe_o_codigo_do_cupom": { pt: "Informe o código do cupom.", en: "Enter the coupon code." },
  "use_de_3_a_40_letras": { pt: "Use de 3 a 40 letras, números, hífen ou sublinhado, sem espaços.", en: "Use 3 to 40 letters, numbers, hyphens or underscores, with no spaces." },
  "ja_existe_um_cupom_com_este": { pt: "Já existe um cupom com este código nesta operação.", en: "A coupon with this code already exists in this operation." },
  "o_desconto_deve_ser_um_numero": { pt: "O desconto deve ser um número inteiro maior que 0 e de até 100%.", en: "The discount must be a whole number greater than 0 and up to 100%." },
  "o_limite_deve_ser_um_numero": { pt: "O limite deve ser um número inteiro positivo.", en: "The limit must be a positive whole number." },
  "informe_o_inicio_da_validade": { pt: "Informe o início da validade.", en: "Enter the validity start." },
  "informe_o_fim_da_validade_ou": { pt: "Informe o fim da validade ou marque “Sem data de término”.", en: "Enter the validity end or check “No end date”." },
  "o_fim_deve_ser_posterior_ao": { pt: "O fim deve ser posterior ao início.", en: "The end must be after the start." },
  "selecione_pelo_menos_um_tipo_de": { pt: "Selecione pelo menos um tipo de ingresso desta operação.", en: "Select at least one ticket type from this operation." },
  "codigo": { pt: "CÓDIGO", en: "CODE" },
  "sem_limite_de_utilizacoes": { pt: "sem limite de utilizações", en: "with no usage limit" },
  "em_todos_os_ingressos": { pt: "em todos os ingressos", en: "on all tickets" },
  "nos_ingressos_selecionados": { pt: "nos ingressos selecionados", en: "on the selected tickets" },
  "codigo_concede_valor_de_desconto_usos": { pt: "{codigo} concede {valor}% de desconto, {usos}, {alvo} desta operação.", en: "{codigo} gives {valor}% off, {usos}, {alvo} of this operation." },
  "com_ate_uma_utilizacao": { pt: "com até {n} utilização", en: "with up to {n} use" },
  "com_ate_n_utilizacoes": { pt: "com até {n} utilizações", en: "with up to {n} uses" },
});
