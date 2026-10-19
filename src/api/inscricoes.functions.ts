// API de inscrições: confirmação/reserva com pagamento, cancelamento e prévia de cupom.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { ErroDominio } from "@/services/db";
import { cancelarInscricao as cancelar, confirmarInscricao as confirmar, validarCupom } from "@/services/inscricoes";
import { registrarConfirmacao } from "@/services/analytics";
import { gereEvento } from "@/lib/visao";
import { exigirUsuario, ler, mutar } from "@/server/unidade.server";
import { abrirCheckout, checkoutDaNovaReserva, expirarSessoes, processarEstornos, sincronizarSessao, stripeConfigurado, type ResultadoCompra } from "@/server/pagamentos.server";
import { chamar } from "@/api/cliente";

const id = z.string().min(1).max(100);

/**
 * Inscrição. Sem valor a pagar (ou sem Stripe configurado) confirma na hora; com valor,
 * reserva a vaga e devolve a página de pagamento do Stripe.
 */
export const confirmarInscricaoFn = createServerFn({ method: "POST" })
  .validator(
    z.object({ eventoId: id, tipoId: id, exercitoId: id, codigoCupom: z.string().max(40).optional(), cortesiaId: id.optional(), voucherId: z.string().max(200).optional() }).parse,
  )
  .handler(async ({ data }) => {
    const online = stripeConfigurado();
    // A pessoa só se inscreve a si mesma; a origem é decidida pelo servidor.
    const r = await mutar(({ usuario }) => confirmar({ ...data, usuarioId: exigirUsuario(usuario).id }, { pagamentoOnline: online }));
    if (r.resultado.status !== "pendente") return { ...r, resultado: { inscricao: r.resultado } as ResultadoCompra };
    return checkoutDaNovaReserva(r.resultado.id);
  });

/** Volta à página de pagamento de uma reserva ainda aberta. */
export const retomarPagamentoFn = createServerFn({ method: "POST" })
  .validator(z.object({ inscricaoId: id }).parse)
  .handler(({ data }) => abrirCheckout(data.inscricaoId));

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
        throw new ErroDominio("inscricao", "Inscrição não encontrada.");
      }
      return cancelar(data.inscricaoId, data.motivo, u.id);
    });
    // Efeitos no Stripe só depois de gravar: fecha o checkout aberto e executa o reembolso.
    await expirarSessoes([r.resultado.sessaoAExpirar]);
    const estornos = await processarEstornos();
    return { resultado: null, visao: (estornos ?? r).visao };
  });

export const previsualizarCupomFn = createServerFn({ method: "POST" })
  .validator(z.object({ eventoId: id, codigo: z.string().max(40), tipoId: id }).parse)
  .handler(({ data }) =>
    ler(({ base }) => {
      const c = validarCupom(base, data.eventoId, data.codigo, data.tipoId);
      return { codigo: c.codigo, descontoPercentual: c.descontoPercentual };
    }),
  );

// ---------- Uso no navegador ----------
/** Devolve a inscrição e, se houver valor a pagar online, a URL do checkout do Stripe. */
export async function confirmarInscricao(d: {
  eventoId: string; tipoId: string; exercitoId: string; codigoCupom?: string | undefined; cortesiaId?: string | undefined; voucherId?: string | undefined;
}) {
  const r = await chamar(confirmarInscricaoFn({ data: d }));
  if (r.inscricao.status === "confirmada") registrarConfirmacao(r.inscricao);
  return r;
}
export const retomarPagamento = (inscricaoId: string) => chamar(retomarPagamentoFn({ data: { inscricaoId } }));
export async function sincronizarPagamento(sessaoId: string) {
  const r = await chamar(sincronizarPagamentoFn({ data: { sessaoId } }));
  if (r.inscricao?.status === "confirmada") registrarConfirmacao(r.inscricao);
  return r;
}
export const cancelarInscricao = (inscricaoId: string, motivo: string) =>
  chamar(cancelarInscricaoFn({ data: { inscricaoId, motivo } }));
export const previsualizarCupom = (eventoId: string, codigo: string, tipoId: string) =>
  chamar(previsualizarCupomFn({ data: { eventoId, codigo, tipoId } }));
