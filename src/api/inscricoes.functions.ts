// API de inscrições: confirmação, cancelamento e prévia de cupom.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { ErroDominio } from "@/services/db";
import { cancelarInscricao as cancelar, confirmarInscricao as confirmar, validarCupom } from "@/services/inscricoes";
import { registrarConfirmacao } from "@/services/analytics";
import { gereEvento } from "@/lib/visao";
import { exigirUsuario, ler, mutar } from "@/server/unidade.server";
import { chamar } from "@/api/cliente";

const id = z.string().min(1).max(100);

export const confirmarInscricaoFn = createServerFn({ method: "POST" })
  .validator(
    z.object({ eventoId: id, tipoId: id, exercitoId: id, codigoCupom: z.string().max(40).optional(), cortesiaId: id.optional(), voucherId: z.string().max(200).optional() }).parse,
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

// ---------- Uso no navegador ----------
export async function confirmarInscricao(d: {
  eventoId: string; tipoId: string; exercitoId: string; codigoCupom?: string | undefined; cortesiaId?: string | undefined;
}) {
  const inscricao = await chamar(confirmarInscricaoFn({ data: d }));
  registrarConfirmacao(inscricao);
  return inscricao;
}
export const cancelarInscricao = (inscricaoId: string, motivo: string) =>
  chamar(cancelarInscricaoFn({ data: { inscricaoId, motivo } }));
export const previsualizarCupom = (eventoId: string, codigo: string, tipoId: string) =>
  chamar(previsualizarCupomFn({ data: { eventoId, codigo, tipoId } }));
