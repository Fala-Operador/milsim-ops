// Conta de recebimento das organizações (Stripe Connect): grava na base o retrato da conta
// devolvido pelo Stripe. As chamadas ao Stripe ficam em src/server/pagamentos.server.ts.
import { gerarId } from "./db";
import { ErroDominio } from "./db";
import { erroTaxa, gereRecebimento, recebimentoDaConta, taxaDaPlataforma, taxaDoComprador, type ContaStripe } from "@/lib/repasses";
import type { BaseDados, Usuario } from "@/lib/domain/types";
import { tr } from "@/i18n/services/repasses";

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

/**
 * Esquece a conta de recebimento que não existe no modo atual do Stripe (conta de teste depois
 * da troca para as chaves de produção); a organização refaz o cadastro numa conta nova.
 */
export function descartarContaDeOutroModoNaBase(base: BaseDados, organizacaoId: string, contaId: string): void {
  const org = base.organizacoes.find((o) => o.id === organizacaoId);
  if (org?.recebimento?.contaId === contaId) org.recebimento = undefined;
}

export const organizacaoDaConta = (base: BaseDados, contaId: string) => base.organizacoes.find((o) => o.recebimento?.contaId === contaId);

/**
 * Administração define a taxa da plataforma. Vale para as reservas feitas daqui em diante;
 * vendas já reservadas mantêm a taxa da reserva. Fica registrada na auditoria.
 */
export function definirTaxaPlataformaNaBase(base: BaseDados, percentual: number, autorId: string, agora = new Date()): void {
  const erro = erroTaxa(percentual);
  if (erro) throw new ErroDominio("taxa", erro);
  const anterior = taxaDaPlataforma(base);
  const iso = agora.toISOString();
  const atual = base.configuracoes.find((c) => c.id === "plataforma");
  if (atual) Object.assign(atual, { taxaPlataformaPercentual: percentual, atualizadoEm: iso, atualizadoPor: autorId });
  else base.configuracoes.push({ id: "plataforma", taxaPlataformaPercentual: percentual, atualizadoEm: iso, atualizadoPor: autorId });
  base.auditoria.push({
    id: gerarId("aud"), autorId, acao: "taxa_plataforma", entidade: "configuracao", entidadeId: "plataforma",
    justificativa: `Taxa da plataforma alterada de ${anterior}% para ${percentual}%.`, criadoEm: iso,
  });
}

/**
 * A organização define a taxa de serviço paga pelo comprador, somada ao ingresso no checkout
 * e repassada a ela (padrão 0%). Vale para as reservas feitas daqui em diante; fica na auditoria.
 */
export function definirTaxaCompradorNaBase(base: BaseDados, organizacaoId: string, percentual: number, usuario: Usuario | null, agora = new Date()): void {
  if (!usuario || !gereRecebimento(usuario, organizacaoId)) throw new ErroDominio("permissao", tr("apenas_a_organizacao_pode_alterar_a"));
  const org = base.organizacoes.find((o) => o.id === organizacaoId);
  if (!org) throw new ErroDominio("organizacao", tr("organizacao_nao_encontrada"));
  const erro = erroTaxa(percentual);
  if (erro) throw new ErroDominio("taxa", erro);
  const anterior = taxaDoComprador(org);
  org.taxaCompradorPercentual = percentual;
  base.auditoria.push({
    id: gerarId("aud"), autorId: usuario.id, acao: "taxa_comprador", entidade: "organizacao", entidadeId: organizacaoId,
    justificativa: `Taxa de serviço do comprador alterada de ${anterior}% para ${percentual}%.`, criadoEm: agora.toISOString(),
  });
}
