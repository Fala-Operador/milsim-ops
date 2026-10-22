// API do check-in: aceite da fila de operações da portaria na base de referência.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { aplicarSincronizacao } from "@/services/checkin";
import { recalcularProgressao } from "@/services/progressao";
import { exigirUsuario, mutar, tratarErro } from "@/server/unidade.server";
import { situacaoEntrada } from "@/server/entrada.server";
import { chamar } from "@/api/cliente";
import type { RegistroCheckin } from "@/lib/checkin";

const curto = z.string().min(1).max(120);
const operacao = z.object({
  id: curto,
  eventoId: curto,
  inscricaoId: curto,
  tipo: z.enum(["entrada", "reversao"]),
  revertidoId: curto.optional(),
  origem: z.enum(["qr", "codigo", "manual"]),
  motivo: z.string().max(1000).optional(),
  operadorId: curto,
  operadorNome: z.string().max(200),
  dispositivoId: curto,
  em: z.string().max(40),
  sync: z.enum(["pendente", "sincronizado", "conflito", "falhou"]),
  conflito: z.string().max(500).optional(),
});

export const sincronizarCheckinsFn = createServerFn({ method: "POST" })
  .validator(z.object({ ops: z.array(operacao).max(500) }).parse)
  .handler(({ data }) =>
    mutar(({ base, usuario }) => {
      const r = aplicarSincronizacao(exigirUsuario(usuario), data.ops as RegistroCheckin[]);
      recalcularProgressao(base); // presença confirmada ou revertida muda a elegibilidade
      return r;
    }),
  );

/** Participante: a portaria já confirmou a entrada deste ingresso? (consulta leve, sem visão) */
export const situacaoEntradaFn = createServerFn({ method: "POST" })
  .validator(z.object({ inscricaoId: curto }).parse)
  .handler(async ({ data }) => {
    try {
      return await situacaoEntrada(data.inscricaoId);
    } catch (e) {
      return tratarErro(e);
    }
  });

// ---------- Uso no navegador ----------
export const enviarFilaCheckin = (ops: RegistroCheckin[]) => chamar(sincronizarCheckinsFn({ data: { ops } }));
export const consultarEntrada = (inscricaoId: string) => situacaoEntradaFn({ data: { inscricaoId } });
