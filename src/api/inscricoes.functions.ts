// API de inscrições: confirmação/reserva com pagamento, cancelamento e prévia de cupom.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { ErroDominio } from "@/services/db";
import {
  cancelarInscricao as cancelar,
  confirmarInscricao as confirmar,
  incluirParticipantes as incluir,
  LIMITE_INCLUSAO_MANUAL,
  validarCupom,
} from "@/services/inscricoes";
import { registrarConfirmacao } from "@/services/analytics";
import { gereEvento } from "@/lib/visao";
import { exigirUsuario, ler, mutar } from "@/server/unidade.server";
import {
  abrirCheckout,
  checkoutDaNovaReserva,
  expirarSessoes,
  processarEstornos,
  sincronizarSessao,
  stripeConfigurado,
  type ResultadoCompra,
} from "@/server/pagamentos.server";
import { chamar } from "@/api/cliente";
import { METODOS_PAGAMENTO, type MetodoPagamento } from "@/lib/stripe";
import { tr } from "@/i18n/api/inscricoes.functions";

const id = z.string().min(1).max(100);
/** Forma de pagamento escolhida no site (o checkout abre direto nela). */
const metodoPagamento = z.enum(METODOS_PAGAMENTO).optional();

/**
 * Inscrição. Sem valor a pagar (ou sem Stripe configurado) confirma na hora; com valor,
 * reserva a vaga e devolve a página de pagamento do Stripe.
 */
export const confirmarInscricaoFn = createServerFn({ method: "POST" })
  .validator(
    z.object({
      eventoId: id,
      tipoId: id,
      exercitoId: id,
      codigoCupom: z.string().max(40).optional(),
      cortesiaId: id.optional(),
      voucherId: z.string().max(200).optional(),
      clienteId: z.string().max(64).optional(),
      precoEsperadoCentavos: z.number().int().min(0).optional(),
      metodoPagamento,
    }).parse,
  )
  .handler(async ({ data }) => {
    const online = stripeConfigurado();
    const { metodoPagamento: metodo, ...dados } = data;
    // A pessoa só se inscreve a si mesma; a origem é decidida pelo servidor.
    const r = await mutar(async ({ base, usuario }) => {
      const usuarioId = exigirUsuario(usuario).id;
      // Reservas abertas da pessoa neste evento: uma nova tentativa as substitui.
      const abertas = base.inscricoes.filter(
        (i) => i.eventoId === dados.eventoId && i.usuarioId === usuarioId && i.status === "pendente" && !!i.pagamento?.sessaoId,
      );
      const inscricao = await confirmar({ ...dados, usuarioId }, { pagamentoOnline: online });
      // Checkouts das reservas substituídas: fechados abaixo, para não serem pagos depois.
      const substituidas = abertas.filter((i) => i.id !== inscricao.id && i.status === "cancelada").map((i) => i.pagamento?.sessaoId);
      return { inscricao, substituidas };
    });
    await expirarSessoes(r.resultado.substituidas);
    const inscricao = r.resultado.inscricao;
    if (inscricao.status !== "pendente") return { ...r, resultado: { inscricao } as ResultadoCompra };
    return checkoutDaNovaReserva(inscricao.id, metodo);
  });

/** Volta à página de pagamento de uma reserva ainda aberta (opcionalmente em outra forma de pagamento). */
export const retomarPagamentoFn = createServerFn({ method: "POST" })
  .validator(z.object({ inscricaoId: id, metodoPagamento }).parse)
  .handler(({ data }) => abrirCheckout(data.inscricaoId, data.metodoPagamento));

/** Retorno do checkout: aplica o resultado consultando o Stripe (não depende do webhook). */
export const sincronizarPagamentoFn = createServerFn({ method: "POST" })
  .validator(z.object({ sessaoId: z.string().min(1).max(300) }).parse)
  .handler(async ({ data }) => {
    const { resultado: usuarioId } = await ler(({ usuario }) => exigirUsuario(usuario).id);
    return sincronizarSessao(data.sessaoId, usuarioId);
  });

export const cancelarInscricaoFn = createServerFn({ method: "POST" })
  .validator(z.object({ inscricaoId: id, motivo: z.string().max(1000) }).parse)
  .handler(async ({ data }) => {
    const r = await mutar(({ base, usuario }) => {
      const u = exigirUsuario(usuario);
      const ins = base.inscricoes.find((i) => i.id === data.inscricaoId);
      const evento = ins && base.eventos.find((e) => e.id === ins.eventoId);
      // Titular da inscrição, organização do evento ou admin.
      if (!ins || !evento || (ins.usuarioId !== u.id && !gereEvento(u, evento))) {
        throw new ErroDominio("inscricao", tr("inscricao_nao_encontrada"));
      }
      return cancelar(data.inscricaoId, data.motivo, u.id);
    });
    // Efeitos no Stripe só depois de gravar: fecha o checkout aberto e executa o reembolso.
    await expirarSessoes([r.resultado.sessaoAExpirar]);
    const estornos = await processarEstornos();
    return { resultado: null, visao: (estornos ?? r).visao };
  });

/**
 * Inclusão manual (pagamento combinado por fora) pela organização do evento ou pelo admin.
 * Organização informa e-mail/CPF; admin pode mandar várias contas escolhidas na lista.
 */
export const incluirParticipantesFn = createServerFn({ method: "POST" })
  .validator(
    z.object({
      eventoId: id,
      identificador: z.string().max(200).optional(),
      usuarioIds: z.array(id).max(LIMITE_INCLUSAO_MANUAL).optional(),
      tipoId: id,
      exercitoId: id,
      observacao: z.string().max(500).optional(),
    }).parse,
  )
  .handler(({ data }) =>
    mutar(({ base, usuario }) => {
      const u = exigirUsuario(usuario);
      const evento = base.eventos.find((e) => e.id === data.eventoId);
      if (!evento || !gereEvento(u, evento)) {
        throw new ErroDominio("permissao", tr("voce_so_pode_gerenciar_eventos_da"));
      }
      return incluir(data, u);
    }),
  );

export const previsualizarCupomFn = createServerFn({ method: "POST" })
  .validator(z.object({ eventoId: id, codigo: z.string().max(40), tipoId: id }).parse)
  .handler(({ data }) =>
    ler(({ base, usuario }) => {
      exigirUsuario(usuario); // sem login não há prévia: evita testar códigos de cupom à vontade
      const c = validarCupom(base, data.eventoId, data.codigo, data.tipoId);
      return { codigo: c.codigo, descontoPercentual: c.descontoPercentual };
    }),
  );

// ---------- Uso no navegador ----------
/** Devolve a inscrição e, se houver valor a pagar online, a URL do checkout do Stripe. */
export async function confirmarInscricao(d: {
  eventoId: string;
  tipoId: string;
  exercitoId: string;
  codigoCupom?: string | undefined;
  cortesiaId?: string | undefined;
  voucherId?: string | undefined;
  /** Mesma chave em todas as tentativas do mesmo envio (idempotência). */
  clienteId?: string | undefined;
  /** Preço do ingresso mostrado na tela: se o lote virou e ele subiu, o servidor recusa. */
  precoEsperadoCentavos?: number | undefined;
  /** Forma de pagamento escolhida (só quando há mais de uma ativa). */
  metodoPagamento?: MetodoPagamento | undefined;
}) {
  const r = await chamar(confirmarInscricaoFn({ data: d }));
  if (r.inscricao.status === "confirmada") registrarConfirmacao(r.inscricao);
  return r;
}
export const retomarPagamento = (inscricaoId: string, metodoPagamento?: MetodoPagamento) =>
  chamar(retomarPagamentoFn({ data: { inscricaoId, metodoPagamento } }));
export async function sincronizarPagamento(sessaoId: string) {
  const r = await chamar(sincronizarPagamentoFn({ data: { sessaoId } }));
  if (r.inscricao?.status === "confirmada") registrarConfirmacao(r.inscricao);
  return r;
}
export const cancelarInscricao = (inscricaoId: string, motivo: string) =>
  chamar(cancelarInscricaoFn({ data: { inscricaoId, motivo } }));
export const incluirParticipantes = (d: {
  eventoId: string;
  identificador?: string | undefined;
  usuarioIds?: string[] | undefined;
  tipoId: string;
  exercitoId: string;
  observacao?: string | undefined;
}) => chamar(incluirParticipantesFn({ data: d }));
export const previsualizarCupom = (eventoId: string, codigo: string, tipoId: string) =>
  chamar(previsualizarCupomFn({ data: { eventoId, codigo, tipoId } }));
