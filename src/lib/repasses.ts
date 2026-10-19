// Regras puras do repasse das vendas às organizações (Stripe Connect Express).
// A cobrança é feita pela plataforma com destino à conta da organização: o Stripe
// transfere o valor menos a taxa da plataforma, e a organização saca para o banco dela.
import type { BaseDados, Organizacao, RecebimentoOrganizacao, StatusRecebimento, Usuario } from "@/lib/domain/types";

/** Campos da conta conectada (GET /v1/accounts/:id ou evento account.updated) usados aqui. */
export interface ContaStripe {
  id: string;
  details_submitted?: boolean;
  charges_enabled?: boolean;
  payouts_enabled?: boolean;
  capabilities?: { transfers?: string; card_payments?: string } | null;
  requirements?: { currently_due?: string[] | null; disabled_reason?: string | null } | null;
}

/** Converte o retrato da conta no Stripe na situação guardada na organização. */
export function recebimentoDaConta(conta: ContaStripe, agora = new Date()): RecebimentoOrganizacao {
  const transferenciasAtivas = conta.capabilities?.transfers === "active";
  const saquesAtivos = !!conta.payouts_enabled;
  const pendencias = conta.requirements?.currently_due ?? [];
  let status: StatusRecebimento;
  if (transferenciasAtivas && saquesAtivos) status = "ativa";
  else if (conta.details_submitted) status = pendencias.length || conta.requirements?.disabled_reason ? "restrita" : "em_analise";
  else status = "pendente";
  return { provedor: "stripe", contaId: conta.id, status, transferenciasAtivas, saquesAtivos, pendencias, atualizadoEm: agora.toISOString() };
}

/** A organização pode receber o repasse de uma venda agora (transferências ativas no Stripe). */
export function contaParaRepasse(org: Organizacao | undefined): string | undefined {
  const r = org?.recebimento;
  return r?.transferenciasAtivas ? r.contaId : undefined;
}

/** Taxa da plataforma (%) configurada pela administração; sem configuração, zero. */
export function taxaDaPlataforma(base: Pick<BaseDados, "configuracoes">): number {
  const v = base.configuracoes.find((c) => c.id === "plataforma")?.taxaPlataformaPercentual ?? 0;
  return Number.isFinite(v) && v > 0 ? Math.min(v, 100) : 0;
}

/** Erro de validação da taxa digitada pela administração (vazio = válida). */
export function erroTaxa(percentual: number): string {
  if (!Number.isFinite(percentual)) return "Informe a taxa em porcentagem.";
  if (percentual < 0 || percentual > 50) return "A taxa deve ficar entre 0% e 50%.";
  if (Math.round(percentual * 100) !== percentual * 100) return "Use no máximo duas casas decimais.";
  return "";
}

/**
 * Taxa da plataforma sobre o valor cobrado, em centavos (arredonda para baixo, nunca passa
 * do valor). `percentual` vem da configuração da plataforma (ex.: 8.5 = 8,5%).
 */
export function taxaPlataforma(valorCentavos: number, percentual: number): number {
  if (!Number.isFinite(percentual) || percentual <= 0 || valorCentavos <= 0) return 0;
  return Math.min(valorCentavos, Math.floor((valorCentavos * Math.min(percentual, 100)) / 100));
}

/** Quem configura o recebimento: o organizador da própria organização ou a administração. */
export function gereRecebimento(usuario: Usuario | null, organizacaoId: string): boolean {
  if (!usuario?.ativo) return false;
  return usuario.perfil === "admin" || (usuario.perfil === "organizador" && usuario.organizacaoId === organizacaoId);
}

/** Visão: só quem gere a organização vê a conta de recebimento; para os demais ela não existe. */
export function organizacaoVisivel(org: Organizacao, usuario: Usuario | null): Organizacao {
  if (!org.recebimento || gereRecebimento(usuario, org.id)) return org;
  const { recebimento: _r, ...resto } = org;
  return resto;
}

export const ROTULO_RECEBIMENTO: Record<StatusRecebimento, string> = {
  pendente: "Cadastro incompleto",
  em_analise: "Em análise pelo Stripe",
  ativa: "Recebimentos ativos",
  restrita: "Pendências no Stripe",
};

/** Resumo do repasse das vendas pagas online de um evento (confirmadas, não estornadas). */
export function resumoRepasse(base: BaseDados, eventoId: string) {
  const pagas = base.inscricoes.filter((i) => i.eventoId === eventoId && i.status === "confirmada" && i.pagamento?.status === "pago");
  const cobrado = pagas.reduce((s, i) => s + (i.pagamento?.valorCentavos ?? 0), 0);
  const taxas = pagas.reduce((s, i) => s + (i.pagamento?.taxaCentavos ?? 0), 0);
  const repassado = pagas.filter((i) => i.pagamento?.contaDestino).reduce((s, i) => s + i.pagamento!.valorCentavos - (i.pagamento!.taxaCentavos ?? 0), 0);
  // Vendas feitas antes da conta ficar ativa ficaram na plataforma: repasse manual.
  const naPlataforma = pagas.filter((i) => !i.pagamento?.contaDestino).reduce((s, i) => s + i.pagamento!.valorCentavos, 0);
  return { cobrado, taxas, repassado, naPlataforma };
}
