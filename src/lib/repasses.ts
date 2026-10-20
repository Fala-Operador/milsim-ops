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
  settings?: { payouts?: { schedule?: CronogramaStripe | null } | null } | null;
  external_accounts?: { data?: ContaExternaStripe[] | null } | null;
  business_profile?: { url?: string | null; product_description?: string | null; mcc?: string | null } | null;
}

/** Perfil comercial que a plataforma envia ao Stripe para a organização não precisar digitar. */
export type PerfilComercial = {
  name: string;
  mcc: string;
  product_description: string;
  url?: string | undefined;
};

/** Setor "Ingressos para eventos" do cadastro do Stripe (MCC 7922, venda de ingressos). */
export const MCC_EVENTOS = "7922";

/**
 * Site, ramo e descrição da organização para o cadastro do Stripe, que senão pede "Seu site" à
 * organização. O site é o endereço público do Milsim Ops, onde os ingressos são vendidos; fora
 * de https (desenvolvimento local) vai sem site, porque o Stripe recusa endereços locais.
 */
export function perfilComercialPadrao(nome: string, origem: string): PerfilComercial {
  let url: string | undefined;
  try {
    const u = new URL(origem);
    if (u.protocol === "https:" && u.hostname !== "localhost") url = u.origin;
  } catch {
    url = undefined;
  }
  return {
    name: nome,
    mcc: MCC_EVENTOS,
    product_description: `Ingressos para eventos de airsoft organizados por ${nome}, vendidos pelo Milsim Ops.`,
    url,
  };
}

/** Conta ainda em cadastro e sem site nem descrição: a plataforma completa o perfil comercial. */
export function precisaPerfilComercial(conta: ContaStripe): boolean {
  const p = conta.business_profile;
  // Sem o ramo (MCC) o cadastro do Stripe pede o "Setor"; contas criadas antes do envio pela v2
  // podem ter site e descrição mas não o ramo, ou um ramo antigo.
  return !conta.details_submitted && (p?.mcc !== MCC_EVENTOS || (!p.url && !p.product_description));
}

export interface CronogramaStripe {
  interval?: "manual" | "daily" | "weekly" | "monthly" | string;
  delay_days?: number;
  weekly_anchor?: string;
  monthly_anchor?: number;
}

interface ContaExternaStripe {
  object?: string;
  bank_name?: string | null;
  last4?: string | null;
  default_for_currency?: boolean | null;
}

/** GET /v1/balance da conta conectada. */
export interface SaldoStripe {
  available?: { amount: number; currency: string }[];
  pending?: { amount: number; currency: string }[];
}

export type StatusSaque = "paid" | "pending" | "in_transit" | "canceled" | "failed";

/** Item de GET /v1/payouts da conta conectada. */
export interface SaqueStripe {
  id: string;
  amount: number;
  currency: string;
  arrival_date: number;
  status: StatusSaque | string;
  failure_message?: string | null;
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

// ---------- Saldo e saques da conta conectada (lidos do Stripe, nunca guardados na base) ----------

export const ROTULO_SAQUE: Record<StatusSaque, string> = {
  paid: "Pago",
  pending: "Agendado",
  in_transit: "A caminho do banco",
  canceled: "Cancelado",
  failed: "Falhou",
};

export interface SaqueResumido {
  id: string;
  valorCentavos: number;
  /** Data prevista (ou efetiva) de chegada no banco, ISO. */
  chegada: string;
  status: StatusSaque;
  falha?: string | undefined;
}

export interface SaldoRecebimento {
  disponivelCentavos: number;
  aLiberarCentavos: number;
  /** Próximo saque ainda não pago (o de chegada mais próxima). */
  proximoSaque?: SaqueResumido | undefined;
  saques: SaqueResumido[];
  cronograma: string;
  /** Banco de destino, só com os últimos dígitos. */
  banco?: string | undefined;
}

const somaBrl = (itens: { amount: number; currency: string }[] | undefined) =>
  (itens ?? []).filter((i) => i.currency === "brl").reduce((s, i) => s + i.amount, 0);

const statusSaque = (s: string): StatusSaque => (s in ROTULO_SAQUE ? (s as StatusSaque) : "pending");

const DIAS_SEMANA: Record<string, string> = {
  monday: "segunda-feira", tuesday: "terça-feira", wednesday: "quarta-feira", thursday: "quinta-feira",
  friday: "sexta-feira", saturday: "sábado", sunday: "domingo",
};

/** Cronograma de saque em português (ex.: "Semanal, às segundas-feiras"). */
export function descreverCronograma(c: CronogramaStripe | null | undefined): string {
  const prazo = c?.delay_days ? ` (cada venda fica disponível ${c.delay_days} ${c.delay_days === 1 ? "dia" : "dias"} depois)` : "";
  switch (c?.interval) {
    case "daily": return `Diário${prazo}`;
    case "weekly": return `Semanal, toda ${DIAS_SEMANA[c.weekly_anchor ?? ""] ?? "semana"}${prazo}`;
    case "monthly": return `Mensal, no dia ${c.monthly_anchor ?? 1}${prazo}`;
    case "manual": return "Manual, pelo painel do Stripe";
    default: return "Definido pelo Stripe";
  }
}

/** Banco padrão de saque da conta, mostrando só os últimos dígitos. */
export function bancoDaConta(conta: ContaStripe): string | undefined {
  const contas = conta.external_accounts?.data ?? [];
  const c = contas.find((x) => x.default_for_currency) ?? contas[0];
  if (!c?.last4) return undefined;
  return `${c.bank_name ?? (c.object === "card" ? "Cartão" : "Conta")} •••• ${c.last4}`;
}

/** Junta saldo, saques e conta do Stripe no resumo mostrado em Financeiro (valores em BRL). */
export function resumoSaldo(saldo: SaldoStripe, saques: SaqueStripe[], conta: ContaStripe): SaldoRecebimento {
  const lista: SaqueResumido[] = saques
    .filter((p) => p.currency === "brl")
    .map((p) => ({
      id: p.id,
      valorCentavos: p.amount,
      chegada: new Date(p.arrival_date * 1000).toISOString(),
      status: statusSaque(p.status),
      falha: p.failure_message ?? undefined,
    }));
  const proximoSaque = lista
    .filter((p) => p.status === "pending" || p.status === "in_transit")
    .sort((a, b) => a.chegada.localeCompare(b.chegada))[0];
  return {
    disponivelCentavos: somaBrl(saldo.available),
    aLiberarCentavos: somaBrl(saldo.pending),
    proximoSaque,
    saques: lista,
    cronograma: descreverCronograma(conta.settings?.payouts?.schedule),
    banco: bancoDaConta(conta),
  };
}
