// Conta de recebimento das organizações (Stripe Connect): grava na base o retrato da conta
// devolvido pelo Stripe. As chamadas ao Stripe ficam em src/server/pagamentos.server.ts.
import { gerarId } from "./db";
import { recebimentoDaConta, type ContaStripe } from "@/lib/repasses";
import type { BaseDados } from "@/lib/domain/types";

/**
 * Atualiza a situação da conta da organização. Ignora uma conta diferente da registrada
 * (só a primeira conta criada vale) e avisa o responsável quando os repasses passam a valer.
 */
export function registrarRecebimentoNaBase(base: BaseDados, organizacaoId: string, conta: ContaStripe, agora = new Date()): void {
  const org = base.organizacoes.find((o) => o.id === organizacaoId);
  if (!org || (org.recebimento && org.recebimento.contaId !== conta.id)) return;
  const antes = org.recebimento;
  const novo = recebimentoDaConta(conta, agora);
  const mudou = !antes || antes.status !== novo.status || antes.transferenciasAtivas !== novo.transferenciasAtivas
    || antes.saquesAtivos !== novo.saquesAtivos || antes.pendencias.join() !== novo.pendencias.join();
  if (!mudou) return; // nada a gravar (evita escrita a cada consulta)
  org.recebimento = novo;
  if (novo.status === "ativa" && antes?.status !== "ativa") {
    base.notificacoes.push({
      id: gerarId("not"),
      usuarioId: org.responsavelId,
      titulo: "Recebimentos ativados",
      corpo: `As vendas de ingressos de ${org.nome} passam a ser repassadas automaticamente para a sua conta.`,
      link: "/organizacao/financeiro",
      lida: false,
      criadoEm: agora.toISOString(),
    });
  }
}

export const organizacaoDaConta = (base: BaseDados, contaId: string) => base.organizacoes.find((o) => o.recebimento?.contaId === contaId);
