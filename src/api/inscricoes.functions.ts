// API de inscrições: confirmação/reserva, cancelamento, prévia de cupom e pagamento por PIX
// manual (comprovante no bucket privado, aprovação ou recusa pela organização).
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { ErroDominio } from "@/services/db";
import {
  aprovarPagamento, cancelarInscricao as cancelar, confirmarInscricao as confirmar, recusarPagamento, registrarComprovante, validarCupom,
} from "@/services/inscricoes";
import { podeEnviarComprovante } from "@/lib/reservas";
import { gravarComprovante, lerArquivoNota, removerDocumentos, urlDoComprovante } from "@/server/documentos.server";
import type { BaseDados, Usuario } from "@/lib/domain/types";
import { registrarConfirmacao } from "@/services/analytics";
import { gereEvento } from "@/lib/visao";
import { contextoSomenteLeitura, exigirUsuario, ler, mutar } from "@/server/unidade.server";
import { chamar } from "@/api/cliente";

const id = z.string().min(1).max(100);

export const confirmarInscricaoFn = createServerFn({ method: "POST" })
  .validator(
    z.object({ eventoId: id, tipoId: id, exercitoId: id, codigoCupom: z.string().max(40).optional(), cortesiaId: id.optional(), voucherId: z.string().max(200).optional(), clienteId: z.string().max(64).optional() }).parse,
  )
  .handler(({ data }) =>
    // A pessoa só se inscreve a si mesma; a origem é decidida pelo servidor.
    mutar(({ usuario }) => confirmar({ ...data, usuarioId: exigirUsuario(usuario).id })),
  );

export const cancelarInscricaoFn = createServerFn({ method: "POST" })
  .validator(z.object({ inscricaoId: id, motivo: z.string().max(1000) }).parse)
  .handler(({ data }) =>
    mutar(({ base, usuario }) => {
      const u = exigirUsuario(usuario);
      const ins = base.inscricoes.find((i) => i.id === data.inscricaoId);
      const evento = ins && base.eventos.find((e) => e.id === ins.eventoId);
      // Titular da inscrição, organização do evento ou admin.
      if (!ins || !evento || (ins.usuarioId !== u.id && !gereEvento(u, evento))) {
        throw new ErroDominio("inscricao", "Inscrição não encontrada.");
      }
      return cancelar(data.inscricaoId, data.motivo, u.id);
    }),
  );

export const previsualizarCupomFn = createServerFn({ method: "POST" })
  .validator(z.object({ eventoId: id, codigo: z.string().max(40), tipoId: id }).parse)
  .handler(({ data }) =>
    ler(({ base }) => {
      const c = validarCupom(base, data.eventoId, data.codigo, data.tipoId);
      return { codigo: c.codigo, descontoPercentual: c.descontoPercentual };
    }),
  );

/** Inscrição que a pessoa gere (organização do evento ou admin). */
function inscricaoGerida(base: BaseDados, usuario: Usuario | null, inscricaoId: string) {
  const u = exigirUsuario(usuario);
  const ins = base.inscricoes.find((i) => i.id === inscricaoId);
  const evento = ins && base.eventos.find((e) => e.id === ins.eventoId);
  if (!ins || !evento || !gereEvento(u, evento)) throw new ErroDominio("inscricao", "Inscrição não encontrada.");
  return u;
}

const tratar = (e: unknown): never => {
  if (e instanceof ErroDominio) throw new Error(e.message);
  throw e instanceof Error ? e : new Error("Não foi possível concluir.");
};

export const enviarComprovanteFn = createServerFn({ method: "POST" })
  .validator(z.object({ inscricaoId: id, nome: z.string().min(1).max(160), dataUrl: z.string().max(7_200_000) }).parse)
  .handler(async ({ data }) => {
    try {
      // Confere antes de subir o arquivo (a regra é conferida de novo na transação).
      const { base, usuario } = await contextoSomenteLeitura();
      const u = exigirUsuario(usuario);
      const ins = base.inscricoes.find((i) => i.id === data.inscricaoId && i.usuarioId === u.id);
      if (!ins) throw new ErroDominio("inscricao", "Inscrição não encontrada.");
      if (!podeEnviarComprovante(ins)) throw new ErroDominio("comprovante_prazo", "Esta inscrição não aceita mais comprovante.");
      const arq = lerArquivoNota(data.dataUrl);
      const nome = data.nome.replace(/[^\p{L}\p{N}._ -]/gu, "_").slice(0, 120);
      const caminho = await gravarComprovante(u.id, ins.id, arq);
      let anterior: string | undefined;
      try {
        const r = await mutar(({ base, usuario }) => {
          const res = registrarComprovante(base, data.inscricaoId, exigirUsuario(usuario).id, {
            caminho, nome, tipo: arq.tipo, tamanho: arq.bytes.byteLength, enviadoEm: new Date().toISOString(),
          });
          anterior = res.anterior;
        });
        if (anterior && anterior !== caminho) await removerDocumentos([anterior]).catch(() => undefined);
        return r;
      } catch (e) {
        await removerDocumentos([caminho]).catch(() => undefined); // não deixa arquivo órfão
        throw e;
      }
    } catch (e) { return tratar(e); }
  });

/** Link assinado (60 s) do comprovante: titular, organização do evento ou admin. */
export const linkComprovanteFn = createServerFn({ method: "POST" })
  .validator(z.object({ inscricaoId: id, baixar: z.boolean() }).parse)
  .handler(async ({ data }) => {
    try {
      const { base, usuario } = await contextoSomenteLeitura();
      const u = exigirUsuario(usuario);
      const ins = base.inscricoes.find((i) => i.id === data.inscricaoId);
      const evento = ins && base.eventos.find((e) => e.id === ins.eventoId);
      if (!ins?.comprovante || !evento || (ins.usuarioId !== u.id && !gereEvento(u, evento))) {
        throw new ErroDominio("comprovante", "Comprovante não encontrado.");
      }
      return await urlDoComprovante(ins.comprovante.caminho, ins.comprovante.nome, data.baixar);
    } catch (e) { return tratar(e); }
  });

export const aprovarPagamentoFn = createServerFn({ method: "POST" })
  .validator(z.object({ inscricaoId: id }).parse)
  .handler(({ data }) =>
    mutar(({ base, usuario }) => aprovarPagamento(base, data.inscricaoId, inscricaoGerida(base, usuario, data.inscricaoId).id)),
  );

export const recusarPagamentoFn = createServerFn({ method: "POST" })
  .validator(z.object({ inscricaoId: id, motivo: z.string().max(500) }).parse)
  .handler(({ data }) =>
    mutar(({ base, usuario }) =>
      recusarPagamento(base, data.inscricaoId, data.motivo, inscricaoGerida(base, usuario, data.inscricaoId).id)),
  );

// ---------- Uso no navegador ----------
export async function confirmarInscricao(d: {
  eventoId: string; tipoId: string; exercitoId: string; codigoCupom?: string | undefined; cortesiaId?: string | undefined; voucherId?: string | undefined;
  /** Mesma chave em todas as tentativas do mesmo envio (idempotência). */
  clienteId?: string | undefined;
}) {
  const inscricao = await chamar(confirmarInscricaoFn({ data: d }));
  registrarConfirmacao(inscricao);
  return inscricao;
}
export const cancelarInscricao = (inscricaoId: string, motivo: string) =>
  chamar(cancelarInscricaoFn({ data: { inscricaoId, motivo } }));
export const previsualizarCupom = (eventoId: string, codigo: string, tipoId: string) =>
  chamar(previsualizarCupomFn({ data: { eventoId, codigo, tipoId } }));
export const enviarComprovante = (inscricaoId: string, nome: string, dataUrl: string) =>
  chamar(enviarComprovanteFn({ data: { inscricaoId, nome, dataUrl } }));
export const linkComprovante = (inscricaoId: string, baixar = false) =>
  linkComprovanteFn({ data: { inscricaoId, baixar } });
export const aprovarPagamentoInscricao = (inscricaoId: string) =>
  chamar(aprovarPagamentoFn({ data: { inscricaoId } }));
export const recusarPagamentoInscricao = (inscricaoId: string, motivo: string) =>
  chamar(recusarPagamentoFn({ data: { inscricaoId, motivo } }));
