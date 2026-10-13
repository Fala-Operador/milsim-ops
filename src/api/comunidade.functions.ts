// API da comunidade (fóruns com feed social). Todas as regras de acesso ficam em
// src/services/comunidade.ts; aqui a pessoa vem sempre da sessão do servidor.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { ErroDominio } from "@/services/db";
import * as c from "@/services/comunidade";
import { exigirUsuario, mutar } from "@/server/unidade.server";
import { chamar } from "@/api/cliente";
import type { DadosForum } from "@/services/comunidade";
import type { ImagemPost, MotivoDenuncia, Usuario } from "@/lib/domain/types";

const id = z.string().min(1).max(100);
const imagem = z.object({ url: z.string().max(15_000_000), alt: z.string().max(300).optional() });
const textoPost = z.string().max(c.LIMITE_TEXTO + 100);
const permissao = z.enum(["membros", "gestao"]);
const dadosForum = z.object({
  nome: z.string().max(80), descricao: z.string().max(500), icone: z.string().max(16).optional(), regras: z.string().max(4000).optional(),
  publico: z.string().max(100), publicacao: permissao, respostas: permissao,
});

/** Cria um handler que executa a operação com a pessoa autenticada. */
const op = <E, R>(fn: (u: Usuario, d: E) => R) =>
  ({ data }: { data: E }) => mutar(({ usuario }) => fn(exigirUsuario(usuario), data));

export const garantirForunsFn = createServerFn({ method: "POST" })
  .validator(z.object({ eventoId: id }).parse)
  .handler(({ data }) =>
    mutar(({ base, usuario }) => {
      if (!c.papelNoEvento(base, usuario, data.eventoId)) throw new ErroDominio("sem_acesso", c.MSG_SEM_ACESSO);
      c.garantirForuns(data.eventoId);
    }),
  );

export const registrarVisitaFn = createServerFn({ method: "POST" })
  .validator(z.object({ eventoId: id }).parse)
  .handler(op((u, d: { eventoId: string }) => c.registrarVisita(u.id, d.eventoId)));

export const criarPublicacaoFn = createServerFn({ method: "POST" })
  .validator(z.object({ forumId: id, texto: textoPost, imagens: z.array(imagem).max(c.LIMITE_IMAGENS), importante: z.boolean().optional() }).parse)
  .handler(op((u, d: { forumId: string; texto: string; imagens: ImagemPost[]; importante?: boolean | undefined }) => c.criarPublicacao(u, d)));

export const editarPublicacaoFn = createServerFn({ method: "POST" })
  .validator(z.object({ pubId: id, texto: textoPost, imagens: z.array(imagem).max(c.LIMITE_IMAGENS) }).parse)
  .handler(op((u, d: { pubId: string; texto: string; imagens: ImagemPost[] }) => c.editarPublicacao(u, d.pubId, d.texto, d.imagens)));

export const excluirPublicacaoFn = createServerFn({ method: "POST" })
  .validator(z.object({ pubId: id }).parse)
  .handler(op((u, d: { pubId: string }) => c.excluirPublicacao(u, d.pubId)));

export const alternarCurtidaFn = createServerFn({ method: "POST" })
  .validator(z.object({ pubId: id }).parse)
  .handler(op((u, d: { pubId: string }) => c.alternarCurtida(u, d.pubId)));

export const responderFn = createServerFn({ method: "POST" })
  .validator(z.object({ pubId: id, texto: textoPost, imagem: imagem.optional() }).parse)
  .handler(op((u, d: { pubId: string; texto: string; imagem?: ImagemPost | undefined }) => c.responder(u, d.pubId, d.texto, d.imagem)));

export const editarRespostaFn = createServerFn({ method: "POST" })
  .validator(z.object({ respostaId: id, texto: textoPost, imagem: imagem.optional() }).parse)
  .handler(op((u, d: { respostaId: string; texto: string; imagem?: ImagemPost | undefined }) => c.editarResposta(u, d.respostaId, d.texto, d.imagem)));

export const excluirRespostaFn = createServerFn({ method: "POST" })
  .validator(z.object({ respostaId: id }).parse)
  .handler(op((u, d: { respostaId: string }) => c.excluirResposta(u, d.respostaId)));

export const denunciarFn = createServerFn({ method: "POST" })
  .validator(
    z.object({
      alvo: z.enum(["publicacao", "resposta"]), alvoId: id,
      motivo: z.enum(["ofensa", "spam", "dados_pessoais", "inadequado", "outro"]), descricao: z.string().max(1000).optional(),
    }).parse,
  )
  .handler(op((u, d: { alvo: "publicacao" | "resposta"; alvoId: string; motivo: MotivoDenuncia; descricao?: string | undefined }) =>
    c.denunciar(u, d as Parameters<typeof c.denunciar>[1])));

export const analisarDenunciaFn = createServerFn({ method: "POST" })
  .validator(z.object({ denunciaId: id, decisao: z.enum(["procedente", "descartada"]) }).parse)
  .handler(op((u, d: { denunciaId: string; decisao: "procedente" | "descartada" }) => c.analisarDenuncia(u, d.denunciaId, d.decisao)));

export const fixarPublicacaoFn = createServerFn({ method: "POST" })
  .validator(z.object({ pubId: id }).parse)
  .handler(op((u, d: { pubId: string }) => c.fixarPublicacao(u, d.pubId)));

export const alternarRespostasFn = createServerFn({ method: "POST" })
  .validator(z.object({ pubId: id }).parse)
  .handler(op((u, d: { pubId: string }) => c.alternarRespostas(u, d.pubId)));

export const ocultarConteudoFn = createServerFn({ method: "POST" })
  .validator(z.object({ alvo: z.enum(["publicacao", "resposta"]), alvoId: id, justificativa: z.string().max(1000), ocultar: z.boolean() }).parse)
  .handler(op((u, d: { alvo: "publicacao" | "resposta"; alvoId: string; justificativa: string; ocultar: boolean }) =>
    c.ocultarConteudo(u, d.alvo, d.alvoId, d.justificativa, d.ocultar)));

export const moverPublicacaoFn = createServerFn({ method: "POST" })
  .validator(z.object({ pubId: id, forumDestinoId: id }).parse)
  .handler(op((u, d: { pubId: string; forumDestinoId: string }) => c.moverPublicacao(u, d.pubId, d.forumDestinoId)));

export const suspenderUsuarioFn = createServerFn({ method: "POST" })
  .validator(z.object({ eventoId: id, usuarioId: id, justificativa: z.string().max(1000) }).parse)
  .handler(op((u, d: { eventoId: string; usuarioId: string; justificativa: string }) => c.suspenderUsuario(u, d.eventoId, d.usuarioId, d.justificativa)));

export const reativarUsuarioFn = createServerFn({ method: "POST" })
  .validator(z.object({ eventoId: id, usuarioId: id }).parse)
  .handler(op((u, d: { eventoId: string; usuarioId: string }) => c.reativarUsuario(u, d.eventoId, d.usuarioId)));

export const criarForumFn = createServerFn({ method: "POST" })
  .validator(z.object({ eventoId: id, dados: dadosForum }).parse)
  .handler(op((u, d: { eventoId: string; dados: DadosForum }) => c.criarForum(u, d.eventoId, d.dados)));

export const editarForumFn = createServerFn({ method: "POST" })
  .validator(z.object({ forumId: id, dados: dadosForum }).parse)
  .handler(op((u, d: { forumId: string; dados: DadosForum }) => c.editarForum(u, d.forumId, d.dados)));

export const moverOrdemForumFn = createServerFn({ method: "POST" })
  .validator(z.object({ forumId: id, direcao: z.union([z.literal(-1), z.literal(1)]) }).parse)
  .handler(op((u, d: { forumId: string; direcao: -1 | 1 }) => c.moverOrdemForum(u, d.forumId, d.direcao)));

export const alternarArquivoForumFn = createServerFn({ method: "POST" })
  .validator(z.object({ forumId: id }).parse)
  .handler(op((u, d: { forumId: string }) => c.alternarArquivoForum(u, d.forumId)));

export const excluirForumFn = createServerFn({ method: "POST" })
  .validator(z.object({ forumId: id }).parse)
  .handler(op((u, d: { forumId: string }) => c.excluirForum(u, d.forumId)));

export const definirPreferenciaForumFn = createServerFn({ method: "POST" })
  .validator(z.object({ forumId: id, modo: z.enum(["seguir", "silenciar", "padrao"]) }).parse)
  .handler(op((u, d: { forumId: string; modo: "seguir" | "silenciar" | "padrao" }) => c.definirPreferenciaForum(u, d.forumId, d.modo)));

export const atualizarNomeExibicaoFn = createServerFn({ method: "POST" })
  .validator(z.object({ nome: z.string().max(60) }).parse)
  .handler(op((u, d: { nome: string }) => c.atualizarNomeExibicao(u, d.nome)));

// ---------- Uso no navegador ----------
export const garantirForuns = (eventoId: string) => chamar(garantirForunsFn({ data: { eventoId } }));
export const registrarVisita = (eventoId: string) => chamar(registrarVisitaFn({ data: { eventoId } }));
export const criarPublicacao = (dados: { forumId: string; texto: string; imagens: ImagemPost[]; importante?: boolean }) =>
  chamar(criarPublicacaoFn({ data: dados }));
export const editarPublicacao = (pubId: string, texto: string, imagens: ImagemPost[]) =>
  chamar(editarPublicacaoFn({ data: { pubId, texto, imagens } }));
export const excluirPublicacao = (pubId: string) => chamar(excluirPublicacaoFn({ data: { pubId } }));
export const alternarCurtida = (pubId: string) => chamar(alternarCurtidaFn({ data: { pubId } }));
export const responder = (pubId: string, texto: string, imagem?: ImagemPost) => chamar(responderFn({ data: { pubId, texto, imagem } }));
export const editarResposta = (respostaId: string, texto: string, imagem?: ImagemPost) =>
  chamar(editarRespostaFn({ data: { respostaId, texto, imagem } }));
export const excluirResposta = (respostaId: string) => chamar(excluirRespostaFn({ data: { respostaId } }));
export const denunciar = (dados: { alvo: "publicacao" | "resposta"; alvoId: string; motivo: MotivoDenuncia; descricao?: string }) =>
  chamar(denunciarFn({ data: dados }));
export const analisarDenuncia = (denunciaId: string, decisao: "procedente" | "descartada") =>
  chamar(analisarDenunciaFn({ data: { denunciaId, decisao } }));
export const fixarPublicacao = (pubId: string) => chamar(fixarPublicacaoFn({ data: { pubId } }));
export const alternarRespostas = (pubId: string) => chamar(alternarRespostasFn({ data: { pubId } }));
export const ocultarConteudo = (alvo: "publicacao" | "resposta", alvoId: string, justificativa: string, ocultar = true) =>
  chamar(ocultarConteudoFn({ data: { alvo, alvoId, justificativa, ocultar } }));
export const moverPublicacao = (pubId: string, forumDestinoId: string) => chamar(moverPublicacaoFn({ data: { pubId, forumDestinoId } }));
export const suspenderUsuario = (eventoId: string, usuarioId: string, justificativa: string) =>
  chamar(suspenderUsuarioFn({ data: { eventoId, usuarioId, justificativa } }));
export const reativarUsuario = (eventoId: string, usuarioId: string) => chamar(reativarUsuarioFn({ data: { eventoId, usuarioId } }));
export const criarForum = (eventoId: string, dados: DadosForum) => chamar(criarForumFn({ data: { eventoId, dados } }));
export const editarForum = (forumId: string, dados: DadosForum) => chamar(editarForumFn({ data: { forumId, dados } }));
export const moverOrdemForum = (forumId: string, direcao: -1 | 1) => chamar(moverOrdemForumFn({ data: { forumId, direcao } }));
export const alternarArquivoForum = (forumId: string) => chamar(alternarArquivoForumFn({ data: { forumId } }));
export const excluirForum = (forumId: string) => chamar(excluirForumFn({ data: { forumId } }));
export const definirPreferenciaForum = (forumId: string, modo: "seguir" | "silenciar" | "padrao") =>
  chamar(definirPreferenciaForumFn({ data: { forumId, modo } }));
export const atualizarNomeExibicao = (nome: string) => chamar(atualizarNomeExibicaoFn({ data: { nome } }));
