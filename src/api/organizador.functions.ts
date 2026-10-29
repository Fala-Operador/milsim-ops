// API do organizador: solicitação de organização, eventos, cupons e cortesias.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { ErroDominio } from "@/services/db";
import * as org from "@/services/organizador";
import { garantirForuns } from "@/services/comunidade";
import { gereEvento } from "@/lib/visao";
import { exigirUsuario, mutar, type Contexto } from "@/server/unidade.server";
import { expirarSessoes, processarEstornos } from "@/server/pagamentos.server";
import { chamar } from "@/api/cliente";
import type { Evento } from "@/lib/domain/types";
import { tr } from "@/i18n/api/organizador.functions";

const id = z.string().min(1).max(100);
const texto = (max = 200) => z.string().max(max);

/** Usuário que gere o evento (organização dona ou admin). */
function exigirGestor({ base, usuario }: Contexto, eventoId: string) {
  const u = exigirUsuario(usuario);
  const evento = base.eventos.find((e) => e.id === eventoId);
  if (!evento || !gereEvento(u, evento)) throw new ErroDominio("permissao", tr("voce_so_pode_gerenciar_eventos_da"));
  return u;
}

// ---------- Solicitação para ser organizador ----------
const dadosSolicitacao = z.object({
  possuiCnpj: z.boolean(), cnpj: texto(20).optional(), nomeOrganizacao: texto(), instagram: texto(100).optional(), telefone: texto(20),
});
export const solicitarOrganizadorFn = createServerFn({ method: "POST" })
  .validator(dadosSolicitacao.parse)
  .handler(({ data }) => mutar(({ usuario }) => org.solicitarOrganizador(exigirUsuario(usuario).id, data)));

export const reenviarSolicitacaoFn = createServerFn({ method: "POST" })
  .validator(z.object({ solicitacaoId: id, dados: z.object({ nomeOrganizacao: texto(), instagram: texto(100).optional(), telefone: texto(20) }) }).parse)
  .handler(({ data }) =>
    mutar(({ base, usuario }) => {
      const u = exigirUsuario(usuario);
      const sol = base.solicitacoes.find((s) => s.id === data.solicitacaoId);
      if (!sol || sol.usuarioId !== u.id) throw new ErroDominio("solicitacao", tr("solicitacao_nao_encontrada"));
      return org.reenviarSolicitacao(data.solicitacaoId, data.dados);
    }),
  );

// ---------- Eventos ----------
// O formulário envia o evento completo; os campos de controle são decididos aqui.
const eventoEntrada = z
  .object({ id, organizacaoId: id, nome: texto(), capacidadeTotal: z.number().int().min(0).max(100000) })
  .passthrough();

export const salvarEventoFn = createServerFn({ method: "POST" })
  .validator((d: unknown) => eventoEntrada.parse(d) as unknown as Evento)
  .handler(({ data }) =>
    mutar(({ base, usuario }) => {
      const u = exigirUsuario(usuario);
      const evento: Evento = { ...data };
      const existente = base.eventos.find((e) => e.id === evento.id);
      if (existente) {
        if (!gereEvento(u, existente)) throw new ErroDominio("permissao", tr("voce_so_pode_gerenciar_eventos_da"));
        // Status muda só por publicar/cancelar; dono e criação não mudam.
        evento.status = existente.status;
        evento.organizacaoId = existente.organizacaoId;
        evento.criadoEm = existente.criadoEm;
      } else {
        const permitido = u.perfil === "admin" || (u.perfil === "organizador" && u.organizacaoId === evento.organizacaoId);
        if (!permitido || !base.organizacoes.some((o) => o.id === evento.organizacaoId)) {
          throw new ErroDominio("permissao", tr("voce_so_pode_criar_eventos_da"));
        }
        evento.status = "rascunho";
        evento.criadoEm = new Date().toISOString();
      }
      return org.salvarEvento(evento, u.id, u.perfil);
    }),
  );

export const publicarEventoFn = createServerFn({ method: "POST" })
  .validator(z.object({ eventoId: id }).parse)
  .handler(({ data }) =>
    mutar(async (ctx) => {
      const u = exigirGestor(ctx, data.eventoId);
      await org.publicarEvento(data.eventoId, u.id, u.perfil);
      garantirForuns(data.eventoId); // a comunidade nasce com a publicação
    }),
  );

export const cancelarEventoFn = createServerFn({ method: "POST" })
  .validator(z.object({ eventoId: id, justificativa: texto(1000) }).parse)
  .handler(async ({ data }) => {
    const r = await mutar((ctx) => {
      const u = exigirGestor(ctx, data.eventoId);
      return org.cancelarEvento(data.eventoId, data.justificativa, u.id, u.perfil);
    });
    // Depois de gravar: fecha checkouts abertos e reembolsa no Stripe o que foi pago.
    await expirarSessoes(r.resultado.sessoesAExpirar);
    const estornos = await processarEstornos();
    return { resultado: { canceladas: r.resultado.canceladas }, visao: (estornos ?? r).visao };
  });

export const excluirEventoFn = createServerFn({ method: "POST" })
  .validator(z.object({ eventoId: id }).parse)
  .handler(({ data }) =>
    mutar((ctx) => {
      const u = exigirGestor(ctx, data.eventoId);
      return org.excluirEvento(data.eventoId, u.id, u.perfil);
    }),
  );

// ---------- Cupons e cortesias ----------
const dadosCupom = z.object({
  eventoId: id, codigo: texto(40), descontoPercentual: z.number(), validoDe: texto(40), validoAte: texto(40).nullable(),
  limiteUsos: z.number().int().nullable(), tiposElegiveis: z.array(id).max(50), ativo: z.boolean(),
});
export const criarCupomFn = createServerFn({ method: "POST" })
  .validator(dadosCupom.parse)
  .handler(({ data }) =>
    mutar((ctx) => {
      exigirGestor(ctx, data.eventoId);
      return org.criarCupom(data);
    }),
  );

export const atualizarCupomFn = createServerFn({ method: "POST" })
  .validator(z.object({ cupomId: id, dados: dadosCupom.omit({ eventoId: true, codigo: true }) }).parse)
  .handler(({ data }) =>
    mutar((ctx) => {
      const cupom = ctx.base.cupons.find((c) => c.id === data.cupomId);
      if (!cupom) throw new ErroDominio("cupom", tr("cupom_nao_encontrado"));
      exigirGestor(ctx, cupom.eventoId);
      return org.atualizarCupom(data.cupomId, data.dados);
    }),
  );

const dadosCortesia = z.object({
  eventoId: id, nomeConvidado: texto(), emailConvidado: texto(), tipoId: id, exercitoId: id.optional(), validade: texto(40),
});
export const criarCortesiaFn = createServerFn({ method: "POST" })
  .validator(dadosCortesia.parse)
  .handler(({ data }) =>
    mutar((ctx) => {
      exigirGestor(ctx, data.eventoId);
      return org.criarCortesia(data);
    }),
  );

// ---------- Uso no navegador ----------
export const solicitarOrganizador = (dados: z.infer<typeof dadosSolicitacao>) => chamar(solicitarOrganizadorFn({ data: dados }));
export const reenviarSolicitacao = (solicitacaoId: string, dados: { nomeOrganizacao: string; instagram?: string; telefone: string }) =>
  chamar(reenviarSolicitacaoFn({ data: { solicitacaoId, dados } }));
export const salvarEvento = (evento: Evento) => chamar(salvarEventoFn({ data: evento }));
export const publicarEvento = (eventoId: string) => chamar(publicarEventoFn({ data: { eventoId } }));
export const cancelarEvento = (eventoId: string, justificativa: string) => chamar(cancelarEventoFn({ data: { eventoId, justificativa } }));
export const excluirEvento = (eventoId: string) => chamar(excluirEventoFn({ data: { eventoId } }));
export const criarCupom = (dados: z.infer<typeof dadosCupom>) => chamar(criarCupomFn({ data: dados }));
export const atualizarCupom = (cupomId: string, dados: Omit<z.infer<typeof dadosCupom>, "eventoId" | "codigo">) =>
  chamar(atualizarCupomFn({ data: { cupomId, dados } }));
export const criarCortesia = (dados: z.infer<typeof dadosCortesia>) => chamar(criarCortesiaFn({ data: dados }));
