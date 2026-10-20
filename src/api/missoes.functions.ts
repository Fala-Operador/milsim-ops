// API das missões pré-evento: o organizador cria, publica, avalia, destaca e encerra; o
// participante envia; placar e temporada são leituras calculadas no servidor (o navegador
// não recebe as entregas dos outros). Regras em src/lib/missoes.ts e src/services/missoes.ts.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { ErroDominio } from "@/services/db";
import * as s from "@/services/missoes";
import { nomeExibicao, papelNoEvento } from "@/services/comunidade";
import { gereEvento } from "@/lib/visao";
import { entregasDoEvento, nomeExercito, placarExercitos, rankingIndividual, temporada, type LinhaPlacar } from "@/lib/missoes";
import { exigirUsuario, ler, mutar } from "@/server/unidade.server";
import { chamar } from "@/api/cliente";
import type { BaseDados, CampanhaMissoes } from "@/lib/domain/types";

const id = z.string().min(1).max(120);
const imagem = z.string().max(3 * 1024 * 1024);

const dadosMissao = z.object({
  id: id.optional(), eventoId: id, titulo: z.string().max(120), descricao: z.string().max(2000), imagem: imagem.optional(),
  publico: z.string().max(120), tipoEntrega: z.enum(["confirmacao", "texto", "imagem", "codigo"]),
  pontos: z.number().int().min(0).max(10000), abreEm: z.string().max(40).optional(), prazo: z.string().max(40),
  exigeAprovacao: z.boolean(), codigoResposta: z.string().max(80).optional(),
  metaPercentual: z.number().int().min(0).max(100).optional(), metaBonus: z.number().int().min(0).max(10000).optional(),
});

export const salvarMissaoFn = createServerFn({ method: "POST" })
  .validator(dadosMissao.parse)
  .handler(({ data }) => mutar(({ base, usuario }) => s.salvarMissao(base, exigirUsuario(usuario), data).id));

export const publicarMissaoFn = createServerFn({ method: "POST" })
  .validator(z.object({ missaoId: id }).parse)
  .handler(({ data }) => mutar(({ base, usuario }) => { s.publicarMissao(base, exigirUsuario(usuario), data.missaoId); }));

export const excluirMissaoFn = createServerFn({ method: "POST" })
  .validator(z.object({ missaoId: id }).parse)
  .handler(({ data }) => mutar(({ base, usuario }) => s.excluirMissao(base, exigirUsuario(usuario), data.missaoId)));

export const enviarEntregaFn = createServerFn({ method: "POST" })
  .validator(z.object({
    missaoId: id, texto: z.string().max(2000).optional(), foto: imagem.optional(), codigo: z.string().max(80).optional(),
    permiteDestaque: z.boolean().optional(),
  }).parse)
  .handler(({ data }) => mutar(({ base, usuario }) => s.enviarEntrega(base, exigirUsuario(usuario), data).status));

export const avaliarEntregaFn = createServerFn({ method: "POST" })
  .validator(z.object({ entregaId: id, decisao: z.enum(["aprovar", "ajustes", "recusar"]), comentario: z.string().max(500).optional() }).parse)
  .handler(({ data }) => mutar(({ base, usuario }) => { s.avaliarEntrega(base, exigirUsuario(usuario), data.entregaId, data.decisao, data.comentario); }));

export const destacarEntregaFn = createServerFn({ method: "POST" })
  .validator(z.object({ entregaId: id }).parse)
  .handler(({ data }) => mutar(({ base, usuario }) => { s.destacarEntrega(base, exigirUsuario(usuario), data.entregaId); }));

export const salvarPremiosFn = createServerFn({ method: "POST" })
  .validator(z.object({ eventoId: id, premios: z.array(z.object({ colocacao: z.number().int(), descricao: z.string().max(300) })).max(30) }).parse)
  .handler(({ data }) => mutar(({ base, usuario }) => { s.salvarPremios(base, exigirUsuario(usuario), data.eventoId, data.premios); }));

export const encerrarCampanhaFn = createServerFn({ method: "POST" })
  .validator(z.object({ eventoId: id }).parse)
  .handler(({ data }) => mutar(({ base, usuario }) => { s.encerrarCampanha(base, exigirUsuario(usuario), data.eventoId); }));

// ---------- Leituras calculadas ----------

export interface PlacarMissoes {
  encerrada: boolean;
  premios: CampanhaMissoes["premios"];
  exercitos: (LinhaPlacar & { colocacao: number; premio?: string | undefined })[];
  /** Top 10 individual (nome de exibição; sem contato nem dados pessoais). */
  ranking: { posicao: number; nome: string; exercito: string; pontos: number; missoes: number; eu: boolean }[];
  minhaPosicao?: number | undefined;
}

function montarPlacar(base: BaseDados, eventoId: string, usuarioId: string): PlacarMissoes {
  const ev = base.eventos.find((e) => e.id === eventoId)!;
  const campanha = base.campanhasMissoes.find((c) => c.eventoId === eventoId);
  const vivo = placarExercitos(base, ev);
  const exercitos = campanha?.encerradaEm
    ? campanha.resultado.map((r) => ({ ...r, nome: nomeExercito(ev, r.exercitoId), metas: vivo.find((v) => v.exercitoId === r.exercitoId)?.metas ?? [] }))
    : vivo.map((l, i) => ({ ...l, colocacao: i + 1, premio: campanha?.premios.find((p) => p.colocacao === i + 1)?.descricao }));
  const todos = rankingIndividual(entregasDoEvento(base, eventoId));
  const ranking = todos.slice(0, 10).map((l, i) => ({
    posicao: i + 1,
    nome: nomeExibicao(base.usuarios.find((u) => u.id === l.usuarioId)),
    exercito: nomeExercito(ev, l.exercitoId ?? ""),
    pontos: l.pontos, missoes: l.missoes, eu: l.usuarioId === usuarioId,
  }));
  const minha = todos.findIndex((l) => l.usuarioId === usuarioId);
  return { encerrada: !!campanha?.encerradaEm, premios: campanha?.premios ?? [], exercitos, ranking, minhaPosicao: minha >= 0 ? minha + 1 : undefined };
}

/** Placar dos exércitos e ranking individual: inscritos confirmados e a gestão do evento. */
export const placarMissoesFn = createServerFn({ method: "POST" })
  .validator(z.object({ eventoId: id }).parse)
  .handler(({ data }) =>
    ler(({ base, usuario }) => {
      const u = exigirUsuario(usuario);
      if (!papelNoEvento(base, u, data.eventoId)) throw new ErroDominio("sem_acesso", "O placar é só para inscritos confirmados e a organização.");
      return montarPlacar(base, data.eventoId, u.id);
    }),
  );

/** Temporada: ranking do ano nos eventos da organização (gestão ou quem já se inscreveu nela). */
export const temporadaMissoesFn = createServerFn({ method: "POST" })
  .validator(z.object({ organizacaoId: id, ano: z.number().int().min(2020).max(2100) }).parse)
  .handler(({ data }) =>
    ler(({ base, usuario }) => {
      const u = exigirUsuario(usuario);
      const eventosOrg = base.eventos.filter((e) => e.organizacaoId === data.organizacaoId);
      const gere = eventosOrg.some((e) => gereEvento(u, e)) || (u.perfil === "organizador" && u.organizacaoId === data.organizacaoId);
      const participa = base.inscricoes.some((i) => i.usuarioId === u.id && i.status === "confirmada" && eventosOrg.some((e) => e.id === i.eventoId));
      if (!gere && !participa && u.perfil !== "admin") throw new ErroDominio("sem_acesso", "Temporada disponível para quem participa dos eventos desta organização.");
      const linhas = temporada(base, data.organizacaoId, data.ano);
      return {
        organizacao: base.organizacoes.find((o) => o.id === data.organizacaoId)?.nome ?? "",
        ranking: linhas.slice(0, 20).map((l, i) => ({
          posicao: i + 1, nome: nomeExibicao(base.usuarios.find((x) => x.id === l.usuarioId)), pontos: l.pontos, missoes: l.missoes, eu: l.usuarioId === u.id,
        })),
        minhaPosicao: ((p) => (p >= 0 ? p + 1 : undefined))(linhas.findIndex((l) => l.usuarioId === u.id)),
      };
    }),
  );

// ---------- Uso no navegador ----------
export const salvarMissao = (d: s.DadosMissao) => chamar(salvarMissaoFn({ data: d }));
export const publicarMissao = (missaoId: string) => chamar(publicarMissaoFn({ data: { missaoId } }));
export const excluirMissao = (missaoId: string) => chamar(excluirMissaoFn({ data: { missaoId } }));
export const enviarEntrega = (d: s.DadosEntrega) => chamar(enviarEntregaFn({ data: d }));
export const avaliarEntrega = (entregaId: string, decisao: s.DecisaoEntrega, comentario?: string) =>
  chamar(avaliarEntregaFn({ data: { entregaId, decisao, comentario } }));
export const destacarEntrega = (entregaId: string) => chamar(destacarEntregaFn({ data: { entregaId } }));
export const salvarPremios = (eventoId: string, premios: { colocacao: number; descricao: string }[]) =>
  chamar(salvarPremiosFn({ data: { eventoId, premios } }));
export const encerrarCampanha = (eventoId: string) => chamar(encerrarCampanhaFn({ data: { eventoId } }));
// Leituras calculadas: devolvem só o resultado, sem reaplicar a visão. Com chamar(), a visão nova
// mudaria a versão da base, que é chave da consulta do placar, e a consulta se repetiria sem fim.
export const placarMissoes = async (eventoId: string) => (await placarMissoesFn({ data: { eventoId } })).resultado;
export const temporadaMissoes = async (organizacaoId: string, ano: number) => (await temporadaMissoesFn({ data: { organizacaoId, ano } })).resultado;
