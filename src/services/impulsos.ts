// Impulsos comprados pelas organizações: compra, pagamento, uso num evento e reembolso, e os
// preços definidos pela administração. Tudo roda dentro de `mutar`; as chamadas ao Stripe
// ficam em src/server/pagamentos.server.ts. Regras em src/lib/impulsos.ts.
import { ErroDominio, gerarId } from "./db";
import type { BaseDados, ImpulsoComprado, Impulsionamento, PlanoImpulsoId, Usuario } from "@/lib/domain/types";
import {
  ABRANGENCIA_IMPULSO, erroPlano, expiracaoDoImpulso, imagemPlanoValida, gereImpulsos, pendenciasUso, periodoDoImpulso,
  planosDeImpulso, posicoesDoImpulso, rotuloDuracao,
} from "@/lib/impulsos";
import { formatarBRL } from "@/lib/domain/money";

function auditar(b: BaseDados, autorId: string, acao: string, id: string, detalhe?: string) {
  b.auditoria.push({ id: gerarId("aud"), autorId, acao, entidade: "impulso", entidadeId: id, justificativa: detalhe, criadoEm: new Date().toISOString() });
}

function notificar(b: BaseDados, usuarioId: string, titulo: string, corpo: string, agora: Date) {
  b.notificacoes.push({ id: gerarId("not"), usuarioId, titulo, corpo, link: "/organizacao/impulsos", lida: false, criadoEm: agora.toISOString() });
}

/**
 * Registra a compra de um impulso pela organização de quem compra. Tipo gratuito (preço 0)
 * entra disponível na hora; os demais aguardam o pagamento no Stripe, que só é aberto com os
 * pagamentos online ativos.
 */
export function criarCompraImpulsoNaBase(
  base: BaseDados, usuario: Usuario | null, planoId: PlanoImpulsoId, opcoes: { pagamentoOnline: boolean }, agora = new Date(),
): ImpulsoComprado {
  const organizacaoId = usuario?.organizacaoId;
  if (!usuario || !organizacaoId || !gereImpulsos(usuario, organizacaoId)) {
    throw new ErroDominio("permissao", "Somente a organização compra impulsos para os próprios eventos.");
  }
  const plano = planosDeImpulso(base).find((p) => p.id === planoId);
  if (!plano?.ativo) throw new ErroDominio("plano", "Este tipo de impulso não está à venda no momento.");
  const gratis = plano.precoCentavos === 0;
  if (!gratis && !opcoes.pagamentoOnline) throw new ErroDominio("pagamento", "Os pagamentos online ainda não estão ativados na plataforma.");
  const iso = agora.toISOString();
  const impulso: ImpulsoComprado = {
    id: gerarId("ipc"), organizacaoId, planoId, compradoPor: usuario.id,
    duracaoHoras: plano.duracaoHoras, precoCentavos: plano.precoCentavos, validadeDias: plano.validadeDias,
    status: gratis ? "disponivel" : "aguardando_pagamento", criadoEm: iso,
    ...(gratis ? { pagoEm: iso, expiraEm: expiracaoDoImpulso(agora, plano.validadeDias).toISOString() } : {}),
  };
  base.impulsosComprados.push(impulso);
  auditar(base, usuario.id, gratis ? "impulso_confirmado" : "impulso_reservado", impulso.id, `${plano.rotulo} — ${formatarBRL(plano.precoCentavos, "pt-BR")}`);
  return impulso;
}

export function registrarSessaoImpulsoNaBase(base: BaseDados, impulsoId: string, sessaoId: string): ImpulsoComprado {
  const i = base.impulsosComprados.find((x) => x.id === impulsoId);
  if (!i) throw new ErroDominio("impulso", "Impulso não encontrado.");
  if (!i.sessaoId) i.sessaoId = sessaoId;
  return i;
}

/**
 * Pagamento aprovado: o impulso fica disponível e a validade conta a partir de agora.
 * Idempotente (webhook e retorno do checkout podem chegar os dois).
 */
export function confirmarImpulsoNaBase(base: BaseDados, impulsoId: string, stripe: { sessaoId?: string | undefined; intencaoId?: string | undefined }, agora = new Date()): void {
  const i = base.impulsosComprados.find((x) => x.id === impulsoId);
  if (!i || (i.status !== "aguardando_pagamento" && i.status !== "processando")) return;
  i.status = "disponivel";
  i.pagoEm = agora.toISOString();
  i.expiraEm = expiracaoDoImpulso(agora, i.validadeDias).toISOString();
  i.sessaoId ??= stripe.sessaoId;
  i.intencaoId ??= stripe.intencaoId;
  auditar(base, i.compradoPor, "impulso_confirmado", i.id, `Pago ${formatarBRL(i.precoCentavos, "pt-BR")}`);
  notificar(base, i.compradoPor, "Impulso disponível",
    `Seu impulso de ${rotuloDuracao(i.duracaoHoras)} está pronto. Use em uma operação até ${new Date(i.expiraEm).toLocaleDateString("pt-BR")}.`, agora);
}

/** Pagamento assíncrono (ex.: Pix) ainda em processamento. */
export function marcarImpulsoProcessando(base: BaseDados, impulsoId: string, stripe: { sessaoId?: string | undefined; intencaoId?: string | undefined }): void {
  const i = base.impulsosComprados.find((x) => x.id === impulsoId);
  if (!i || i.status !== "aguardando_pagamento") return;
  i.status = "processando";
  i.sessaoId ??= stripe.sessaoId;
  i.intencaoId ??= stripe.intencaoId;
}

/** Sessão expirada ou pagamento recusado: a compra é cancelada. */
export function cancelarImpulsoNaBase(base: BaseDados, impulsoId: string, agora = new Date()): void {
  const i = base.impulsosComprados.find((x) => x.id === impulsoId);
  if (!i || (i.status !== "aguardando_pagamento" && i.status !== "processando")) return;
  i.status = "cancelado";
  i.encerradoEm = agora.toISOString();
}

/** Reembolso no Stripe: o impulso deixa de valer e a campanha gerada por ele é encerrada. */
export function registrarReembolsoImpulsoNaBase(base: BaseDados, impulsoId: string, agora = new Date()): void {
  const i = base.impulsosComprados.find((x) => x.id === impulsoId);
  if (!i || i.status === "reembolsado") return;
  i.status = "reembolsado";
  i.encerradoEm = agora.toISOString();
  const c = i.impulsionamentoId ? base.impulsionamentos.find((x) => x.id === i.impulsionamentoId) : undefined;
  if (c && c.status !== "encerrado") {
    c.status = "encerrado";
    c.atualizadoEm = agora.toISOString();
  }
  auditar(base, "sistema", "impulso_reembolsado", i.id, formatarBRL(i.precoCentavos, "pt-BR"));
}

export const impulsoPorIntencao = (base: BaseDados, intencaoId: string) => base.impulsosComprados.find((i) => i.intencaoId === intencaoId);

/**
 * Usa um impulso disponível num evento publicado da organização: cria a campanha de
 * impulsionamento (destaques e listagem, todo o Brasil) pelo período do impulso.
 */
export function usarImpulsoNaBase(base: BaseDados, usuario: Usuario | null, impulsoId: string, eventoId: string, agora = new Date()): Impulsionamento {
  const i = base.impulsosComprados.find((x) => x.id === impulsoId);
  if (!usuario || !i || !gereImpulsos(usuario, i.organizacaoId)) throw new ErroDominio("impulso", "Impulso não encontrado.");
  const evento = base.eventos.find((e) => e.id === eventoId);
  const erros = pendenciasUso(base, i, evento, agora);
  if (erros.length) throw new ErroDominio("elegibilidade", erros.join(" "));
  const periodo = periodoDoImpulso(base, evento!, i.duracaoHoras, agora);
  const iso = agora.toISOString();
  const campanha: Impulsionamento = {
    id: gerarId("imp"), eventoId, nome: `Impulso de ${rotuloDuracao(i.duracaoHoras)} (organização)`, objetivo: "divulgacao",
    posicoes: posicoesDoImpulso(base), abrangencia: { ...ABRANGENCIA_IMPULSO },
    inicioEm: periodo.inicioEm, fimEm: periodo.fimEm, fuso: "America/Sao_Paulo", prioridade: "normal", ordem: 0,
    status: "ativo", criadoPor: usuario.id, criadoEm: iso, atualizadoEm: iso, impulsoId: i.id,
  };
  base.impulsionamentos.push(campanha);
  Object.assign(i, { status: "usado", usadoEm: iso, eventoId, impulsionamentoId: campanha.id });
  auditar(base, usuario.id, "impulso_usado", i.id, `${evento!.nome}: ${new Date(periodo.inicioEm).toLocaleString("pt-BR")} → ${new Date(periodo.fimEm).toLocaleString("pt-BR")}`);
  return campanha;
}

export interface DadosPlanoImpulso {
  id: PlanoImpulsoId;
  precoCentavos: number;
  validadeDias: number;
  ativo: boolean;
  /** Ausente mantém a imagem atual. */
  imagemUrl?: string | undefined;
}

/** Administração define preço, validade e venda dos tipos. Vale para compras novas. */
export function salvarPlanosImpulsoNaBase(base: BaseDados, admin: Usuario, planos: DadosPlanoImpulso[], agora = new Date()): void {
  const atuais = planosDeImpulso(base);
  const iso = agora.toISOString();
  for (const d of planos) {
    const antes = atuais.find((p) => p.id === d.id);
    if (!antes) throw new ErroDominio("plano", "Tipo de impulso desconhecido.");
    const erro = erroPlano(d);
    if (erro) throw new ErroDominio("plano", `${antes.rotulo}: ${erro}`);
    const imagemUrl = d.imagemUrl ?? antes.imagemUrl;
    if (imagemUrl && !imagemPlanoValida(imagemUrl)) throw new ErroDominio("plano", `${antes.rotulo}: imagem inválida.`);
    if (antes.precoCentavos === d.precoCentavos && antes.validadeDias === d.validadeDias && antes.ativo === d.ativo && antes.imagemUrl === imagemUrl && antes.atualizadoEm) continue;
    const salvo = base.planosImpulso.find((p) => p.id === d.id);
    const novo = { id: d.id, precoCentavos: d.precoCentavos, validadeDias: d.validadeDias, ativo: d.ativo, imagemUrl, atualizadoEm: iso, atualizadoPor: admin.id };
    if (salvo) Object.assign(salvo, novo);
    else base.planosImpulso.push(novo);
    auditar(base, admin.id, "plano_impulso", d.id,
      `${antes.rotulo}: ${formatarBRL(d.precoCentavos, "pt-BR")}, validade ${d.validadeDias} dias, ${d.ativo ? "à venda" : "fora de venda"}${antes.imagemUrl !== imagemUrl ? ", imagem trocada" : ""}.`);
  }
}

/** Grava o produto e o preço do tipo no Stripe depois da sincronização (feita fora de `mutar`). */
export function registrarSincronizacaoPlanoNaBase(
  base: BaseDados, planoId: PlanoImpulsoId, stripe: { produtoId: string; precoId: string }, agora = new Date(),
): void {
  const atual = planosDeImpulso(base).find((p) => p.id === planoId);
  if (!atual) return;
  const salvo = base.planosImpulso.find((p) => p.id === planoId);
  const campos = { stripeProdutoId: stripe.produtoId, stripePrecoId: stripe.precoId, sincronizadoEm: agora.toISOString() };
  if (salvo) Object.assign(salvo, campos);
  else {
    base.planosImpulso.push({
      id: atual.id, precoCentavos: atual.precoCentavos, validadeDias: atual.validadeDias, ativo: atual.ativo, imagemUrl: atual.imagemUrl,
      atualizadoEm: agora.toISOString(), atualizadoPor: "sistema", ...campos,
    });
  }
}

