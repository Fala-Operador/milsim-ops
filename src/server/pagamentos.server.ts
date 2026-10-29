// Orquestração do pagamento de ingressos com o Stripe. As regras ficam nos serviços
// (src/services/inscricoes.ts) e rodam dentro de `mutar`; as chamadas ao Stripe ficam
// aqui, sempre FORA de `mutar`, porque `mutar` pode repetir a função em caso de conflito.
//
//  reserva (mutar) → Checkout Session (Stripe) → guarda a sessão (mutar)
//  webhook ou retorno do checkout → confirma / libera (mutar) → reembolsos (Stripe) → registra (mutar)
import "@tanstack/react-start/server-only";
import { getRequestUrl } from "@tanstack/react-start/server";
import { ErroDominio } from "@/services/db";
import {
  confirmarPagamentoNaBase,
  liberarReservaNaBase,
  marcarPagamentoProcessando,
  registrarDisputaNaBase,
  registrarReembolsoNaBase,
  registrarResultadoEstornoNaBase,
} from "@/services/inscricoes";
import { estornoPendente } from "@/lib/pagamentos";
import {
  acaoDaSessao,
  acaoDoEvento,
  contaInacessivel,
  impulsoDaSessao,
  destinoInvalido,
  mensagemDeFalhaStripe,
  disputaDoStripe,
  inscricaoDaSessao,
  intencaoDaCobranca,
  intencaoDaDisputa,
  intencaoDaSessao,
  type AcaoSessao,
  type CobrancaStripe,
  type DisputaStripe,
  type EventoStripe,
  type SessaoCheckout,
} from "@/lib/stripe";
import { contextoSomenteLeitura, ler, mutar, type RespostaApi } from "@/server/unidade.server";
import {
  chavePublicavel,
  problemaChavesStripe,
  completarPerfilComercial,
  criarContaConectada,
  listarContasConectadas,
  obterContaDaPlataforma,
  criarReembolso,
  criarSessaoCheckout,
  criarSessaoCheckoutImpulso,
  sincronizarProdutoImpulso,
  criarSessaoDeConta,
  ErroStripe,
  expirarSessaoCheckout,
  linkDeCadastro,
  linkDoPainel,
  obterContaConectada,
  obterSessaoCheckout,
  saldoDaConta,
  saquesDaConta,
  stripeConfigurado,
} from "@/server/stripe.server";
import { contaExistenteDaOrganizacao, contaParaRepasse, gereRecebimento, MSG_SEM_RECEBIMENTO, perfilComercialPadrao, precisaPerfilComercial, resumoSaldo, type ContaStripe, type PerfilComercial, type SaldoRecebimento } from "@/lib/repasses";
import { descartarContaDeOutroModoNaBase, organizacaoDaConta, registrarRecebimentoNaBase } from "@/services/repasses";
import {
  cancelarImpulsoNaBase,
  confirmarImpulsoNaBase,
  criarCompraImpulsoNaBase,
  impulsoPorIntencao,
  marcarImpulsoProcessando,
  registrarReembolsoImpulsoNaBase,
  registrarSessaoImpulsoNaBase,
  registrarSincronizacaoPlanoNaBase,
} from "@/services/impulsos";
import {
  PRAZO_PAGAMENTO_MIN, gereImpulsos, imagemAbsoluta, planosDeImpulso, precoStripeEmDia, produtoStripeDoPlano, rotuloDuracao,
  statusDoImpulso, type PlanoExibido,
} from "@/lib/impulsos";
import type { ImpulsoComprado, Inscricao, PlanoImpulsoId } from "@/lib/domain/types";
import { tr } from "@/i18n/server/pagamentos.server";

export { stripeConfigurado };

const MSG_FALHA_STRIPE = () => tr("nao_foi_possivel_abrir_o_pagamento_agora");

export interface ResultadoCompra {
  inscricao: Inscricao;
  /** Página de pagamento do Stripe; ausente quando a inscrição já foi confirmada. */
  urlPagamento?: string | undefined;
}

/**
 * Devolve a página de pagamento da reserva: reaproveita a sessão aberta ou cria uma nova.
 * Só o titular da reserva pode pedir.
 */
export async function abrirCheckout(inscricaoId: string): Promise<RespostaApi<ResultadoCompra>> {
  const { resultado: d } = await ler(({ base, usuario }) => {
    const ins = base.inscricoes.find((i) => i.id === inscricaoId);
    if (!usuario || !ins || ins.usuarioId !== usuario.id) throw new ErroDominio("inscricao", tr("reserva_nao_encontrada"));
    if (ins.status !== "pendente" || ins.pagamento?.status !== "aguardando") {
      throw new ErroDominio("reserva", tr("esta_reserva_nao_esta_mais_aguardando"));
    }
    const evento = base.eventos.find((e) => e.id === ins.eventoId);
    const tipo = evento?.tipos.find((t) => t.id === ins.tipoId);
    return {
      pagamento: ins.pagamento,
      eventoId: ins.eventoId,
      email: usuario.email,
      descricao: `${evento?.nome ?? "Evento"} — ${tipo?.nome ?? "Ingresso"}`,
      // Destino decidido na reserva; só vale se a conta continuar apta agora.
      contaDestino: ins.pagamento.contaDestino && contaParaRepasse(base.organizacoes.find((o) => o.id === evento?.organizacaoId)) === ins.pagamento.contaDestino
        ? ins.pagamento.contaDestino : undefined,
    };
  });
  if (new Date(d.pagamento.expiraEm) <= new Date()) throw new Error(tr("o_prazo_desta_reserva_terminou_faca"));

  let sessao: SessaoCheckout;
  try {
    const existente = d.pagamento.sessaoId ? await obterSessaoCheckout(d.pagamento.sessaoId) : undefined;
    if (existente && existente.status !== "open") {
      // Pago ou expirado enquanto a pessoa estava fora: aplica o estado e avisa.
      await aplicarSessao(existente, acaoDaSessao(existente));
      throw new Error(tr("esta_reserva_ja_foi_concluida_ou"));
    }
    const origem = new URL(getRequestUrl()).origin;
    const criar = () => criarSessaoCheckout({
      inscricaoId,
      descricao: d.descricao,
      valorCentavos: d.pagamento.valorCentavos,
      expiraEm: d.pagamento.expiraEm,
      email: d.email,
      contaDestino: d.contaDestino,
      taxaCentavos: d.contaDestino ? d.pagamento.taxaCentavos : undefined,
      taxaCompradorCentavos: d.pagamento.taxaCompradorCentavos,
      urlSucesso: `${origem}/app/ingressos?pagamento=sucesso&sessao={CHECKOUT_SESSION_ID}`,
      urlCancelamento: `${origem}/inscricao/${d.eventoId}?pagamento=cancelado`,
    });
    // Sem conta de recebimento apta (desativada ou trocada depois da reserva) não há venda.
    if (!existente && !d.contaDestino) throw new Error(MSG_SEM_RECEBIMENTO);
    try {
      sessao = existente ?? await criar();
    } catch (e) {
      // Conta de destino que o Stripe não reconhece neste modo (ex.: conta de teste com a chave
      // de produção): a venda não acontece até a organização refazer o cadastro.
      if (!(d.contaDestino && e instanceof ErroStripe && destinoInvalido(e.status, e.message))) throw e;
      console.warn("Stripe: conta de destino inválida, venda bloqueada", d.contaDestino, e.message);
      throw new Error(MSG_SEM_RECEBIMENTO);
    }
  } catch (e) {
    if (!(e instanceof ErroStripe || e instanceof TypeError)) throw e;
    console.error("Stripe: falha ao abrir checkout", e);
    throw new Error(MSG_FALHA_STRIPE());
  }
  if (!sessao.url) throw new Error(MSG_FALHA_STRIPE());
  const url = sessao.url;
  return mutar(({ base }) => {
    const ins = base.inscricoes.find((i) => i.id === inscricaoId)!;
    if (ins.pagamento && !ins.pagamento.sessaoId) {
      // Registra o destino efetivo da cobrança (a conta pode ter deixado de estar apta).
      ins.pagamento = { ...ins.pagamento, sessaoId: sessao.id, contaDestino: d.contaDestino, taxaCentavos: d.contaDestino ? ins.pagamento.taxaCentavos : undefined };
    }
    return { inscricao: ins, urlPagamento: url };
  });
}

/** Reserva recém-criada: abre o checkout; se o Stripe falhar, libera a vaga na hora. */
export async function checkoutDaNovaReserva(inscricaoId: string): Promise<RespostaApi<ResultadoCompra>> {
  try {
    return await abrirCheckout(inscricaoId);
  } catch (e) {
    await mutar(({ base }) => {
      const ins = base.inscricoes.find((i) => i.id === inscricaoId);
      if (ins) liberarReservaNaBase(base, ins, "Falha ao abrir o pagamento", "falhou");
    });
    throw e;
  }
}

/** Aplica o estado de uma Checkout Session à inscrição (idempotente) e executa reembolsos devidos. */
export async function aplicarSessao(sessao: SessaoCheckout, acao: AcaoSessao): Promise<RespostaApi<string> | undefined> {
  const inscricaoId = inscricaoDaSessao(sessao);
  if (!inscricaoId || acao === "nada") return undefined;
  const stripe = { sessaoId: sessao.id, intencaoId: intencaoDaSessao(sessao) };
  const r = await mutar(({ base }) => {
    const ins = base.inscricoes.find((i) => i.id === inscricaoId);
    // Só a sessão desta reserva decide sobre ela.
    if (!ins?.pagamento || (ins.pagamento.sessaoId && ins.pagamento.sessaoId !== sessao.id)) return "ignorada";
    if (acao === "confirmar") return confirmarPagamentoNaBase(base, inscricaoId, stripe);
    if (acao === "processando") {
      marcarPagamentoProcessando(base, inscricaoId, stripe);
      return "processando";
    }
    liberarReservaNaBase(base, ins, acao === "liberar_falha" ? "Pagamento não aprovado" : "Prazo para pagamento encerrado", acao === "liberar_falha" ? "falhou" : "expirado");
    return "liberada";
  }, { exigirLogin: false });
  if (r.resultado === "estornar") return (await processarEstornos()) ?? r;
  return r;
}

/** Retorno do checkout: consulta a sessão no Stripe e aplica, sem depender do webhook. */
export async function sincronizarSessao(sessaoId: string, usuarioId: string): Promise<RespostaApi<{ inscricao?: Inscricao | undefined; situacao: string }>> {
  let sessao: SessaoCheckout;
  try {
    sessao = await obterSessaoCheckout(sessaoId);
  } catch (e) {
    console.error("Stripe: falha ao consultar sessão", e);
    throw new Error(tr("nao_foi_possivel_consultar_o_pagamento"));
  }
  const inscricaoId = inscricaoDaSessao(sessao);
  // Confere o titular antes de aplicar qualquer coisa.
  const { resultado: dono } = await ler(({ base }) => base.inscricoes.find((i) => i.id === inscricaoId)?.usuarioId);
  if (!inscricaoId || dono !== usuarioId) throw new Error(tr("pagamento_nao_encontrado"));
  await aplicarSessao(sessao, acaoDaSessao(sessao));
  return ler(({ base }) => {
    const inscricao = base.inscricoes.find((i) => i.id === inscricaoId);
    return { inscricao, situacao: inscricao?.pagamento?.status ?? "desconhecida" };
  });
}

/** Expira sessões do Stripe de reservas liberadas, para que não possam mais ser pagas. */
export async function expirarSessoes(ids: (string | undefined)[]): Promise<void> {
  if (!stripeConfigurado()) return;
  for (const id of ids) {
    if (!id) continue;
    try {
      await expirarSessaoCheckout(id);
    } catch (e) {
      console.error("Stripe: falha ao expirar sessão", id, e); // se for paga mesmo assim, o webhook reembolsa
    }
  }
}

/**
 * Executa no Stripe todos os reembolsos marcados na base (estorno_pendente) e registra o
 * resultado. Seguro para repetir: cada reembolso usa a chave de idempotência da inscrição.
 */
export async function processarEstornos(): Promise<RespostaApi<string> | undefined> {
  if (!stripeConfigurado()) return undefined;
  const { base } = await contextoSomenteLeitura();
  const alvos = base.inscricoes.filter(estornoPendente);
  if (!alvos.length) return undefined;
  const resultados: { id: string; r: { reembolsoId: string } | { erro: string } }[] = [];
  for (const ins of alvos) {
    const intencao = ins.pagamento?.intencaoId;
    if (!intencao) {
      resultados.push({ id: ins.id, r: { erro: tr("pagamento_sem_identificador_no_stripe_re") } });
      continue;
    }
    try {
      const re = await criarReembolso(ins.id, intencao, !!ins.pagamento?.contaDestino);
      resultados.push({ id: ins.id, r: { reembolsoId: re.id } });
    } catch (e) {
      console.error("Stripe: falha no reembolso", ins.id, e);
      resultados.push({ id: ins.id, r: { erro: e instanceof Error ? e.message.slice(0, 300) : tr("falha_no_reembolso") } });
    }
  }
  return mutar(({ base: b }) => {
    for (const { id, r } of resultados) registrarResultadoEstornoNaBase(b, id, r);
    return "estornos";
  }, { exigirLogin: false });
}

/** Webhook: interpreta o evento já autenticado pela assinatura. */
export async function tratarEventoStripe(evento: EventoStripe): Promise<void> {
  if (evento.type.startsWith("checkout.session.")) {
    const sessao = evento.data.object as SessaoCheckout;
    if (impulsoDaSessao(sessao)) await aplicarSessaoImpulso(sessao, acaoDoEvento(evento.type, sessao));
    else await aplicarSessao(sessao, acaoDoEvento(evento.type, sessao));
  } else if (evento.type === "charge.refunded") {
    const cobranca = evento.data.object as CobrancaStripe;
    const intencao = intencaoDaCobranca(cobranca);
    const integral = cobranca.refunded === true || cobranca.amount_refunded >= cobranca.amount;
    await mutar(({ base }) => {
      // Compra de impulso: reembolso integral cancela o impulso (e a campanha gerada por ele).
      const impulso = base.impulsosComprados.find((i) => i.id === cobranca.metadata?.["impulsoId"]) ?? (intencao ? impulsoPorIntencao(base, intencao) : undefined);
      if (impulso) {
        if (integral) registrarReembolsoImpulsoNaBase(base, impulso.id);
        return;
      }
      const ins = base.inscricoes.find(
        (i) => (cobranca.metadata?.["inscricaoId"] && i.id === cobranca.metadata["inscricaoId"]) || (!!intencao && i.pagamento?.intencaoId === intencao),
      );
      if (ins) registrarReembolsoNaBase(base, ins.id, integral);
    }, { exigirLogin: false });
  } else if (evento.type.startsWith("charge.dispute.")) {
    // Contestação: com cobrança com destino, o valor sai da plataforma; só registramos e avisamos.
    const disputa = evento.data.object as DisputaStripe;
    const intencao = intencaoDaDisputa(disputa);
    if (intencao) await mutar(({ base }) => void registrarDisputaNaBase(base, intencao, disputaDoStripe(disputa)), { exigirLogin: false });
  } else if (evento.type === "account.updated") {
    await aplicarContaAtualizada(evento.data.object as ContaStripe);
    return;
  }
  // Reembolsos que falharam antes são tentados de novo a cada evento recebido.
  await processarEstornos();
}

// ---------- Impulsos comprados pelas organizações (pagos à plataforma) ----------

export interface ResultadoCompraImpulso {
  impulso: ImpulsoComprado;
  /** Página de pagamento do Stripe; ausente quando o impulso já está disponível (tipo gratuito). */
  urlPagamento?: string | undefined;
}

/** Compra um impulso: registra a compra e abre o checkout (tipo gratuito já fica disponível). */
export async function comprarImpulso(planoId: PlanoImpulsoId): Promise<RespostaApi<ResultadoCompraImpulso>> {
  const online = stripeConfigurado();
  const r = await mutar(({ base, usuario }) => criarCompraImpulsoNaBase(base, usuario, planoId, { pagamentoOnline: online }));
  if (r.resultado.status !== "aguardando_pagamento") return { ...r, resultado: { impulso: r.resultado } };
  try {
    return await abrirCheckoutImpulso(r.resultado.id);
  } catch (e) {
    await mutar(({ base }) => cancelarImpulsoNaBase(base, r.resultado.id));
    throw e;
  }
}

/** Devolve a página de pagamento do impulso: reaproveita a sessão aberta ou cria uma nova. */
export async function abrirCheckoutImpulso(impulsoId: string): Promise<RespostaApi<ResultadoCompraImpulso>> {
  const { resultado: d } = await ler(({ base, usuario }) => {
    const i = base.impulsosComprados.find((x) => x.id === impulsoId);
    if (!i || !gereImpulsos(usuario, i.organizacaoId)) throw new ErroDominio("impulso", tr("impulso_nao_encontrado"));
    if (statusDoImpulso(i, new Date()) !== "aguardando_pagamento") throw new ErroDominio("impulso", tr("este_impulso_nao_esta_mais_aguardando"));
    return { impulso: i, email: usuario?.email, plano: planosDeImpulso(base).find((p) => p.id === i.planoId) };
  });
  let sessao: SessaoCheckout;
  try {
    const existente = d.impulso.sessaoId ? await obterSessaoCheckout(d.impulso.sessaoId) : undefined;
    if (existente && existente.status !== "open") {
      await aplicarSessaoImpulso(existente, acaoDaSessao(existente));
      throw new Error(tr("este_pagamento_ja_foi_concluido_ou"));
    }
    const origem = new URL(getRequestUrl()).origin;
    // Produto do catálogo da plataforma; tipo ainda não sincronizado é sincronizado agora.
    const catalogo = d.plano ? await produtoDoPlano(d.plano, origem) : undefined;
    sessao = existente ?? await criarSessaoCheckoutImpulso({
      precoId: catalogo?.precoId && d.plano?.precoCentavos === d.impulso.precoCentavos ? catalogo.precoId : undefined,
      produtoId: catalogo?.produtoId,
      imagens: d.plano?.imagemUrl ? [imagemAbsoluta(d.plano.imagemUrl, origem)].filter((x): x is string => !!x) : undefined,
      impulsoId,
      descricao: `Impulso de ${rotuloDuracao(d.impulso.duracaoHoras)} — MilSim Ops`,
      valorCentavos: d.impulso.precoCentavos,
      expiraEm: new Date(new Date(d.impulso.criadoEm).getTime() + PRAZO_PAGAMENTO_MIN * 60_000).toISOString(),
      email: d.email,
      urlSucesso: `${origem}/organizacao/impulsos?pagamento=sucesso&sessao={CHECKOUT_SESSION_ID}`,
      urlCancelamento: `${origem}/organizacao/impulsos?pagamento=cancelado`,
    });
  } catch (e) {
    if (!(e instanceof ErroStripe || e instanceof TypeError)) throw e;
    console.error("Stripe: falha ao abrir checkout do impulso", e);
    throw new Error(MSG_FALHA_STRIPE());
  }
  if (!sessao.url) throw new Error(MSG_FALHA_STRIPE());
  const url = sessao.url;
  return mutar(({ base }) => ({ impulso: registrarSessaoImpulsoNaBase(base, impulsoId, sessao.id), urlPagamento: url }));
}

const dadosDoProduto = (p: PlanoExibido, origem: string) => ({
  produtoId: produtoStripeDoPlano(p.id),
  nome: `${p.rotulo} — MilSim Ops`,
  descricao: `Destaque da operação na página inicial e no topo da listagem por ${rotuloDuracao(p.duracaoHoras)}. Use em até ${p.validadeDias} dias após a compra.`,
  imagens: [imagemAbsoluta(p.imagemUrl ?? "", origem)].filter((x): x is string => !!x),
  ativo: p.ativo,
  precoCentavos: p.precoCentavos,
  metadata: { planoImpulso: p.id, duracaoHoras: String(p.duracaoHoras), validadeDias: String(p.validadeDias) },
});

/**
 * Produto e preço do tipo no catálogo: usa o que já está em dia ou sincroniza agora. Falha do
 * Stripe aqui não impede a venda (o checkout cai no item avulso).
 */
async function produtoDoPlano(p: PlanoExibido, origem: string): Promise<{ produtoId: string; precoId?: string | undefined } | undefined> {
  if (p.stripeProdutoId && precoStripeEmDia(p)) return { produtoId: p.stripeProdutoId, precoId: p.stripePrecoId };
  try {
    const r = await sincronizarProdutoImpulso(dadosDoProduto(p, origem));
    await mutar(({ base }) => registrarSincronizacaoPlanoNaBase(base, p.id, r), { exigirLogin: false });
    return r;
  } catch (e) {
    console.error("Stripe: falha ao sincronizar o produto do impulso", p.id, e);
    return undefined;
  }
}

export interface ResultadoSincronizacaoPlanos {
  sincronizados: number;
  /** Tipos que falharam, com a mensagem do Stripe (sem chaves). */
  erros: string[];
}

/**
 * Sincroniza os seis tipos de impulso com o catálogo do Stripe da plataforma (produto com
 * nome, descrição, imagem e preço padrão; tipos fora de venda ficam arquivados). Só admin.
 */
export async function sincronizarPlanosNoStripe(): Promise<RespostaApi<ResultadoSincronizacaoPlanos>> {
  const { resultado: planos } = await ler(({ base, usuario }) => {
    if (usuario?.perfil !== "admin" || !usuario.ativo) throw new ErroDominio("permissao", tr("somente_a_administracao_sincroniza_os_im"));
    return planosDeImpulso(base);
  });
  if (!stripeConfigurado()) throw new Error(tr("os_pagamentos_online_ainda_nao_estao"));
  const origem = new URL(getRequestUrl()).origin;
  const feitos: { id: PlanoImpulsoId; produtoId: string; precoId: string }[] = [];
  const erros: string[] = [];
  for (const p of planos) {
    try {
      feitos.push({ id: p.id, ...(await sincronizarProdutoImpulso(dadosDoProduto(p, origem))) });
    } catch (e) {
      console.error("Stripe: falha ao sincronizar o produto do impulso", p.id, e);
      erros.push(`${p.rotulo}: ${e instanceof ErroStripe ? mensagemDeFalhaStripe(e.status, e.message) : MSG_FALHA_STRIPE()}`);
    }
  }
  return mutar(({ base }) => {
    for (const f of feitos) registrarSincronizacaoPlanoNaBase(base, f.id, f);
    return { sincronizados: feitos.length, erros };
  });
}

/** Aplica o estado de uma Checkout Session de impulso (idempotente). */
export async function aplicarSessaoImpulso(sessao: SessaoCheckout, acao: AcaoSessao): Promise<void> {
  const impulsoId = impulsoDaSessao(sessao);
  if (!impulsoId || acao === "nada") return;
  const stripe = { sessaoId: sessao.id, intencaoId: intencaoDaSessao(sessao) };
  await mutar(({ base }) => {
    const i = base.impulsosComprados.find((x) => x.id === impulsoId);
    // Só a sessão desta compra decide sobre ela.
    if (!i || (i.sessaoId && i.sessaoId !== sessao.id)) return;
    if (acao === "confirmar") confirmarImpulsoNaBase(base, impulsoId, stripe);
    else if (acao === "processando") marcarImpulsoProcessando(base, impulsoId, stripe);
    else cancelarImpulsoNaBase(base, impulsoId);
  }, { exigirLogin: false });
}

/** Retorno do checkout do impulso: consulta a sessão no Stripe e aplica, sem depender do webhook. */
export async function sincronizarSessaoImpulso(sessaoId: string): Promise<RespostaApi<ImpulsoComprado | undefined>> {
  const { resultado: usuario } = await ler(({ usuario }) => usuario);
  let sessao: SessaoCheckout;
  try {
    sessao = await obterSessaoCheckout(sessaoId);
  } catch (e) {
    console.error("Stripe: falha ao consultar sessão do impulso", e);
    throw new Error(tr("nao_foi_possivel_consultar_o_pagamento"));
  }
  const impulsoId = impulsoDaSessao(sessao);
  const { resultado: org } = await ler(({ base }) => base.impulsosComprados.find((i) => i.id === impulsoId)?.organizacaoId);
  if (!impulsoId || !org || !gereImpulsos(usuario, org)) throw new Error(tr("pagamento_nao_encontrado"));
  await aplicarSessaoImpulso(sessao, acaoDaSessao(sessao));
  return ler(({ base }) => base.impulsosComprados.find((i) => i.id === impulsoId));
}

// ---------- Repasse às organizações (Stripe Connect Express) ----------

/** Dados da organização para as operações de recebimento; exige quem a gere. */
async function organizacaoGerida(organizacaoId: string) {
  const { resultado } = await ler(({ base, usuario }) => {
    const org = base.organizacoes.find((o) => o.id === organizacaoId);
    if (!org || !gereRecebimento(usuario, organizacaoId)) throw new ErroDominio("permissao", tr("voce_so_pode_configurar_os_recebimentos"));
    const responsavel = base.usuarios.find((u) => u.id === org.responsavelId);
    return { nome: org.nome, contaId: org.recebimento?.contaId, ativa: org.recebimento?.status === "ativa", email: responsavel?.email };
  });
  return resultado;
}

async function comStripe<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    if (!(e instanceof ErroStripe || e instanceof TypeError)) throw e;
    console.error("Stripe Connect", e);
    throw new Error(mensagemDeFalhaStripe(e instanceof ErroStripe ? e.status : 0, e.message), { cause: e });
  }
}

/**
 * A conta guardada não é alcançável com a chave atual (conta de teste com a chave de produção,
 * ou conta de outra plataforma/sandbox): esquece a conta para a organização cadastrar uma nova.
 * Devolve se descartou.
 */
async function descartarSeInacessivel(organizacaoId: string, contaId: string, e: unknown): Promise<boolean> {
  if (!(e instanceof ErroStripe && contaInacessivel(e.status, e.message))) return false;
  console.warn("Stripe: conta de recebimento inacessível descartada", organizacaoId, contaId, e.status);
  await mutar(({ base }) => descartarContaDeOutroModoNaBase(base, organizacaoId, contaId));
  saldosRecentes.delete(contaId);
  return true;
}

/**
 * Conta da organização no modo atual do Stripe. Cria (e grava) uma conta Express quando não há
 * nenhuma ou quando a guardada é inacessível (outro modo ou outra plataforma).
 */
async function contaDaOrganizacao(
  organizacaoId: string,
  org: { contaId?: string | undefined; email?: string | undefined },
  perfil: PerfilComercial,
): Promise<{ conta: ContaStripe; nova: boolean }> {
  let substituida: string | undefined;
  if (org.contaId) {
    try {
      return { conta: await comStripe(() => obterContaConectada(org.contaId!)), nova: false };
    } catch (e) {
      if (!(await descartarSeInacessivel(organizacaoId, org.contaId, (e as Error).cause))) throw e;
      substituida = org.contaId;
    }
  }
  // Uma conta por organização: se o registro na base se perdeu (ou outra pessoa da organização
  // já começou o cadastro), reaproveita a conta que o Stripe já tem para ela.
  const contas = await comStripe(() => listarContasConectadas());
  const existente = contaExistenteDaOrganizacao(contas, organizacaoId, substituida);
  if (existente) {
    console.warn("Stripe: conta de recebimento existente reaproveitada", organizacaoId, existente.id);
    await gravarConta(organizacaoId, existente);
    return { conta: existente, nova: false };
  }
  const conta = await comStripe(() => criarContaConectada({ organizacaoId, perfil, email: org.email, substituida }))
    .catch(async (e: Error) => { throw await comContaDaPlataforma(e); });
  const gravada = (await gravarConta(organizacaoId, conta)).resultado;
  if (gravada && gravada.contaId !== conta.id) {
    // Outra pessoa da organização gravou uma conta ao mesmo tempo: vale a que ficou na base.
    console.warn("Stripe: conta criada em paralelo ignorada", organizacaoId, conta.id, "mantida", gravada.contaId);
    return { conta: await comStripe(() => obterContaConectada(gravada.contaId)), nova: false };
  }
  await completarPerfil(conta, perfil); // site, ramo e descrição, que a criação pela v2 não leva
  return { conta, nova: true };
}

/**
 * Quando o Stripe diz que a plataforma não está ativada, acrescenta qual conta a chave do site
 * usa e se ela recebe pagamentos, para comparar com a conta aberta no painel do Stripe.
 */
async function comContaDaPlataforma(e: Error): Promise<Error> {
  if (!/must be activated in order to create accounts/i.test(e.message)) return e;
  try {
    const p = await obterContaDaPlataforma();
    const nome = p.settings?.dashboard?.display_name || p.business_profile?.name || tr("sem_nome");
    const sim = (v?: boolean) => (v ? tr("sim") : tr("nao"));
    // Plataforma ativa para pagamentos: o que falta é o cadastro do Connect em produção (perfil da
    // plataforma), que o Stripe exige antes da primeira conta conectada e responde com o mesmo erro.
    if (p.charges_enabled) {
      return new Error(
        tr("a_conta_stripe_da_plataforma_id", { id: p.id, nome }),
        { cause: e.cause },
      );
    }
    return new Error(
      tr("message_conta_do_stripe_usada_pela", { message: e.message, id: p.id, nome, charges_enabled: sim(p.charges_enabled), payouts_enabled: sim(p.payouts_enabled) }),
      { cause: e.cause },
    );
  } catch {
    return e;
  }
}

/**
 * Contas criadas antes do preenchimento automático: envia site, ramo e descrição enquanto o
 * cadastro não foi enviado. Uma recusa do Stripe não impede o cadastro (a organização ainda
 * pode preencher o campo).
 */
async function completarPerfil(conta: ContaStripe, perfil: PerfilComercial): Promise<void> {
  if (!precisaPerfilComercial(conta)) return;
  await completarPerfilComercial(conta.id, perfil).catch((e) => console.error("Stripe: perfil comercial", e));
}

const gravarConta = (organizacaoId: string, conta: ContaStripe) =>
  mutar(({ base }) => {
    registrarRecebimentoNaBase(base, organizacaoId, conta);
    return base.organizacoes.find((o) => o.id === organizacaoId)?.recebimento;
  });

/**
 * Inicia ou continua o cadastro da conta de recebimento: cria a conta Express na primeira
 * vez e devolve o link do cadastro hospedado pelo Stripe.
 */
export async function iniciarCadastroRecebimento(organizacaoId: string): Promise<RespostaApi<{ url: string }>> {
  if (!stripeConfigurado()) throw new Error(tr("os_pagamentos_online_ainda_nao_estao"));
  const org = await organizacaoGerida(organizacaoId);
  const origem = new URL(getRequestUrl()).origin;
  const perfil = perfilComercialPadrao(org.nome, origem);
  // Conta nova já fica gravada antes de sair para o Stripe.
  const { conta, nova } = await contaDaOrganizacao(organizacaoId, org, perfil);
  if (!nova) await completarPerfil(conta, perfil);
  const contaId = conta.id;
  const { url } = await comStripe(() =>
    linkDeCadastro(contaId, `${origem}/organizacao/financeiro?recebimento=retorno`, `${origem}/organizacao/financeiro?recebimento=renovar`),
  );
  const r = await mutar(({ base }) => base.organizacoes.find((o) => o.id === organizacaoId)?.recebimento?.contaId === contaId);
  return { resultado: { url }, visao: r.visao };
}

/** Consulta a conta no Stripe e atualiza a situação (retorno do cadastro, abertura da página). */
export async function sincronizarRecebimento(organizacaoId: string) {
  const org = await organizacaoGerida(organizacaoId);
  const atual = () => ler(({ base }) => base.organizacoes.find((o) => o.id === organizacaoId)?.recebimento);
  if (!org.contaId || !stripeConfigurado()) return atual();
  try {
    const conta = await comStripe(() => obterContaConectada(org.contaId!));
    return await gravarConta(organizacaoId, conta);
  } catch (e) {
    if (await descartarSeInacessivel(organizacaoId, org.contaId, (e as Error).cause)) return atual();
    throw e;
  }
}

/** Link para o painel Express: saldo, calendário de repasses e conta bancária. */
export async function abrirPainelRecebimento(organizacaoId: string): Promise<{ url: string }> {
  const org = await organizacaoGerida(organizacaoId);
  if (!org.contaId) throw new Error(tr("a_organizacao_ainda_nao_tem_conta"));
  return comStripe(() => linkDoPainel(org.contaId!));
}

/** Webhook de Connect (account.updated): mantém a situação da conta em dia. */
export async function aplicarContaAtualizada(conta: ContaStripe): Promise<void> {
  await mutar(({ base }) => {
    const org = organizacaoDaConta(base, conta.id);
    if (org) registrarRecebimentoNaBase(base, org.id, conta);
  }, { exigirLogin: false });
}

// ---------- Saldo, saques e componentes embutidos (só leitura, nada vai para a base) ----------

const VALIDADE_SALDO_MS = 60_000;
const saldosRecentes = new Map<string, { em: number; saldo: SaldoRecebimento }>();

/**
 * Saldo disponível e a liberar, últimos saques, cronograma e banco da conta da organização,
 * lidos do Stripe com o cabeçalho Stripe-Account. Cache curto por conta para não estourar o
 * limite de chamadas; `undefined` quando a conta ainda não está ativa.
 */
export async function consultarSaldoRecebimento(organizacaoId: string, atualizar = false): Promise<SaldoRecebimento | undefined> {
  const org = await organizacaoGerida(organizacaoId);
  if (!org.contaId || !org.ativa || !stripeConfigurado()) return undefined;
  const contaId = org.contaId;
  const guardado = saldosRecentes.get(contaId);
  if (!atualizar && guardado && Date.now() - guardado.em < VALIDADE_SALDO_MS) return guardado.saldo;
  let saldo: SaldoRecebimento;
  try {
    saldo = await comStripe(async () => {
      const [b, p, c] = await Promise.all([saldoDaConta(contaId), saquesDaConta(contaId, 10), obterContaConectada(contaId)]);
      return resumoSaldo(b, p, c);
    });
  } catch (e) {
    if (await descartarSeInacessivel(organizacaoId, contaId, (e as Error).cause)) return undefined;
    throw e;
  }
  saldosRecentes.set(contaId, { em: Date.now(), saldo });
  return saldo;
}

/**
 * Componentes embutidos do Stripe (cadastro, avisos, dados da conta e, com a conta ativa,
 * saques e pagamentos): chave publicável + segredo da sessão. Na primeira vez cria a conta
 * Express da organização, como o cadastro hospedado.
 */
export async function sessaoComponentesStripe(organizacaoId: string): Promise<{ chavePublicavel: string; clientSecret: string }> {
  const org = await organizacaoGerida(organizacaoId);
  const chave = chavePublicavel();
  if (!chave || !stripeConfigurado()) throw new Error(tr("os_paineis_do_stripe_ainda_nao"));
  const problema = problemaChavesStripe();
  if (problema) throw new Error(tr("os_paineis_do_stripe_estao_mal", { problema }));
  const perfil = perfilComercialPadrao(org.nome, new URL(getRequestUrl()).origin);
  const { conta, nova } = await contaDaOrganizacao(organizacaoId, org, perfil);
  if (!nova && !org.ativa) await completarPerfil(conta, perfil);
  const sessao = await comStripe(() => criarSessaoDeConta(conta.id));
  return { chavePublicavel: chave, clientSecret: sessao.client_secret };
}

/**
 * Os componentes embutidos só aparecem com a chave publicável configurada e compatível com a
 * secreta; com chaves trocadas, o site volta ao cadastro e ao painel hospedados pelo Stripe.
 */
export function componentesStripeAtivos(): boolean {
  if (!stripeConfigurado() || !chavePublicavel()) return false;
  const problema = problemaChavesStripe();
  if (problema) console.error("Stripe:", problema);
  return !problema;
}

export { problemaChavesStripe };
