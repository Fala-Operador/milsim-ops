// API da comunidade geral (estilo Twitter). As leituras devolvem DTOs paginados direto (sem
// visão nem `chamar`: o feed não faz parte da base); as escritas usam a sessão no servidor.
// Só a preferência de perfil (público/privado) é da conta e volta com a visão.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import * as social from "@/server/social.server";
import type { FiltroAuditoria } from "@/server/social.server";
import { mutar, exigirUsuario } from "@/server/unidade.server";
import { chamar } from "@/api/cliente";
import { LIMITE_ALT, MAX_FOTOS, MOTIVOS_DENUNCIA, type MotivoDenunciaSocial } from "@/lib/comunidadeGeral";

const idPost = z.string().min(1).max(100);
const idUsuario = z.string().uuid();
const cursor = z.object({ antes: z.string().max(40).optional(), antesId: z.string().max(100).optional() });
// ~5 MB de imagem em base64 (o limite exato em bytes é conferido em erroPost).
const foto = z.object({ dados: z.string().max(7_200_000), alt: z.string().max(LIMITE_ALT).optional() });
const motivos = Object.keys(MOTIVOS_DENUNCIA) as [MotivoDenunciaSocial, ...MotivoDenunciaSocial[]];

// ---------- Leituras ----------
export const feedFn = createServerFn({ method: "POST" }).validator(cursor.parse).handler(({ data }) => social.lerFeed(data));

export const postsDoAutorFn = createServerFn({ method: "POST" })
  .validator(cursor.extend({ autorId: idUsuario }).parse)
  .handler(({ data }) => social.lerPostsDoAutor(data.autorId, data));

export const postFn = createServerFn({ method: "POST" })
  .validator(z.object({ postId: idPost }).parse)
  .handler(({ data }) => social.lerPost(data.postId));

export const respostasFn = createServerFn({ method: "POST" })
  .validator(cursor.extend({ postId: idPost }).parse)
  .handler(({ data }) => social.lerRespostas(data.postId, data));

export const perfilSocialFn = createServerFn({ method: "POST" })
  .validator(z.object({ usuarioId: idUsuario }).parse)
  .handler(({ data }) => social.lerPerfilSocial(data.usuarioId));

export const pedidosParaSeguirFn = createServerFn({ method: "POST" }).handler(() => social.lerPedidosParaSeguir());

export const denunciasPendentesFn = createServerFn({ method: "POST" }).handler(() => social.lerDenunciasPendentes());

export const postsAuditoriaFn = createServerFn({ method: "POST" })
  .validator(cursor.extend({ filtro: z.enum(["todos", "publicado", "oculto", "removido"]) }).parse)
  .handler(({ data }) => social.lerPostsAuditoria(data.filtro, data));

// ---------- Escritas ----------
export const publicarPostFn = createServerFn({ method: "POST" })
  .validator(z.object({ texto: z.string().max(1000), fotos: z.array(foto).max(MAX_FOTOS), respondendoA: idPost.optional(), forumId: idPost.optional() }).parse)
  .handler(({ data }) => social.publicarPost(data));

export const excluirPostFn = createServerFn({ method: "POST" })
  .validator(z.object({ postId: idPost }).parse)
  .handler(({ data }) => social.excluirPost(data.postId));

export const curtirPostFn = createServerFn({ method: "POST" })
  .validator(z.object({ postId: idPost, curtir: z.boolean() }).parse)
  .handler(({ data }) => social.curtirPost(data.postId, data.curtir));

export const seguirFn = createServerFn({ method: "POST" })
  .validator(z.object({ usuarioId: idUsuario }).parse)
  .handler(({ data }) => social.seguir(data.usuarioId));

export const deixarDeSeguirFn = createServerFn({ method: "POST" })
  .validator(z.object({ usuarioId: idUsuario }).parse)
  .handler(({ data }) => social.deixarDeSeguir(data.usuarioId));

export const responderPedidoFn = createServerFn({ method: "POST" })
  .validator(z.object({ seguidorId: idUsuario, aprovar: z.boolean() }).parse)
  .handler(({ data }) => social.responderPedido(data.seguidorId, data.aprovar));

export const bloquearFn = createServerFn({ method: "POST" })
  .validator(z.object({ usuarioId: idUsuario, bloquear: z.boolean() }).parse)
  .handler(({ data }) => social.bloquear(data.usuarioId, data.bloquear));

export const denunciarPostFn = createServerFn({ method: "POST" })
  .validator(z.object({ postId: idPost, motivo: z.enum(motivos), detalhes: z.string().max(500).optional() }).parse)
  .handler(({ data }) => social.denunciarPost(data.postId, data.motivo, data.detalhes));

export const resolverDenunciaFn = createServerFn({ method: "POST" })
  .validator(z.object({ denunciaId: idPost, acao: z.enum(["ocultar", "descartar"]), motivo: z.string().max(300).optional() }).parse)
  .handler(({ data }) => social.resolverDenuncia(data.denunciaId, data.acao, data.motivo));

export const moderarPostFn = createServerFn({ method: "POST" })
  .validator(z.object({ postId: idPost, acao: z.enum(["ocultar", "restaurar"]), motivo: z.string().max(300).optional() }).parse)
  .handler(({ data }) => social.moderarPost(data.postId, data.acao, data.motivo));

/** Perfil público ou privado na comunidade (dado da conta: volta com a visão). */
export const definirPerfilComunidadeFn = createServerFn({ method: "POST" })
  .validator(z.object({ privado: z.boolean() }).parse)
  .handler(async ({ data }) => {
    const r = await mutar(({ usuario }) => {
      const eu = exigirUsuario(usuario);
      eu.comunidadePrivada = data.privado || undefined;
      return eu.id;
    });
    if (!data.privado) await social.aceitarPedidosPendentes(r.resultado);
    return { ...r, resultado: null };
  });

// ---------- Fóruns ----------
// foto: data URL nova (~5 MB em base64), null remove, ausente mantém.
const dadosForum = z.object({
  nome: z.string().max(200), descricao: z.string().max(1000).optional(), visibilidade: z.enum(["publico", "privado"]),
  foto: z.string().max(7_200_000).nullable().optional(),
});

export const forunsFn = createServerFn({ method: "POST" })
  .validator(z.object({ busca: z.string().max(60).optional(), meus: z.boolean().optional(), offset: z.number().int().min(0).max(10000).optional() }).parse)
  .handler(({ data }) => social.lerForuns(data));

export const forumFn = createServerFn({ method: "POST" })
  .validator(z.object({ forumId: idPost }).parse)
  .handler(({ data }) => social.lerForum(data.forumId));

export const postsDoForumFn = createServerFn({ method: "POST" })
  .validator(cursor.extend({ forumId: idPost }).parse)
  .handler(({ data }) => social.lerPostsDoForum(data.forumId, data));

export const membrosDoForumFn = createServerFn({ method: "POST" })
  .validator(z.object({ forumId: idPost, situacao: z.enum(["pendente", "aprovado"]) }).parse)
  .handler(({ data }) => social.lerMembrosDoForum(data.forumId, data.situacao));

export const criarForumFn = createServerFn({ method: "POST" }).validator(dadosForum.parse).handler(({ data }) => social.criarForum(data));

export const editarForumFn = createServerFn({ method: "POST" })
  .validator(dadosForum.extend({ forumId: idPost }).parse)
  .handler(({ data }) => social.editarForum(data.forumId, data));

export const arquivarForumFn = createServerFn({ method: "POST" })
  .validator(z.object({ forumId: idPost }).parse)
  .handler(({ data }) => social.arquivarForum(data.forumId));

export const entrarNoForumFn = createServerFn({ method: "POST" })
  .validator(z.object({ forumId: idPost }).parse)
  .handler(({ data }) => social.entrarNoForum(data.forumId));

export const sairDoForumFn = createServerFn({ method: "POST" })
  .validator(z.object({ forumId: idPost }).parse)
  .handler(({ data }) => social.sairDoForum(data.forumId));

export const responderEntradaFn = createServerFn({ method: "POST" })
  .validator(z.object({ forumId: idPost, usuarioId: idUsuario, aprovar: z.boolean() }).parse)
  .handler(({ data }) => social.responderEntrada(data.forumId, data.usuarioId, data.aprovar));

export const removerMembroFn = createServerFn({ method: "POST" })
  .validator(z.object({ forumId: idPost, usuarioId: idUsuario }).parse)
  .handler(({ data }) => social.removerMembro(data.forumId, data.usuarioId));

export const definirModeradorFn = createServerFn({ method: "POST" })
  .validator(z.object({ forumId: idPost, usuarioId: idUsuario, moderador: z.boolean() }).parse)
  .handler(({ data }) => social.definirModerador(data.forumId, data.usuarioId, data.moderador));

export const ocultarPostDoForumFn = createServerFn({ method: "POST" })
  .validator(z.object({ postId: idPost, motivo: z.string().max(300) }).parse)
  .handler(({ data }) => social.ocultarPostDoForum(data.postId, data.motivo));

// ---------- Uso no navegador ----------
export const lerFeed = (c: { antes?: string | undefined; antesId?: string | undefined } = {}) => feedFn({ data: c });
export const lerPostsDoAutor = (autorId: string, c: { antes?: string | undefined; antesId?: string | undefined } = {}) =>
  postsDoAutorFn({ data: { autorId, ...c } });
export const lerPost = (postId: string) => postFn({ data: { postId } });
export const lerRespostas = (postId: string, c: { antes?: string | undefined; antesId?: string | undefined } = {}) =>
  respostasFn({ data: { postId, ...c } });
export const lerPerfilSocial = (usuarioId: string) => perfilSocialFn({ data: { usuarioId } });
export const lerPedidosParaSeguir = () => pedidosParaSeguirFn();
export const lerDenunciasPendentes = () => denunciasPendentesFn();
export const lerPostsAuditoria = (filtro: FiltroAuditoria, c: { antes?: string | undefined; antesId?: string | undefined } = {}) =>
  postsAuditoriaFn({ data: { filtro, ...c } });
export const moderarPost = (postId: string, acao: "ocultar" | "restaurar", motivo?: string) =>
  moderarPostFn({ data: { postId, acao, motivo } });
export const publicarPost = (d: { texto: string; fotos: { dados: string; alt?: string | undefined }[]; respondendoA?: string | undefined; forumId?: string | undefined }) =>
  publicarPostFn({ data: d });
export const excluirPost = (postId: string) => excluirPostFn({ data: { postId } });
export const curtirPost = (postId: string, curtir: boolean) => curtirPostFn({ data: { postId, curtir } });
export const seguir = (usuarioId: string) => seguirFn({ data: { usuarioId } });
export const deixarDeSeguir = (usuarioId: string) => deixarDeSeguirFn({ data: { usuarioId } });
export const responderPedido = (seguidorId: string, aprovar: boolean) => responderPedidoFn({ data: { seguidorId, aprovar } });
export const bloquear = (usuarioId: string, bloquearConta: boolean) => bloquearFn({ data: { usuarioId, bloquear: bloquearConta } });
export const denunciarPost = (postId: string, motivo: MotivoDenunciaSocial, detalhes?: string) =>
  denunciarPostFn({ data: { postId, motivo, detalhes } });
export const resolverDenuncia = (denunciaId: string, acao: "ocultar" | "descartar", motivo?: string) =>
  resolverDenunciaFn({ data: { denunciaId, acao, motivo } });
export const definirPerfilComunidade = (privado: boolean) => chamar(definirPerfilComunidadeFn({ data: { privado } }));

type DadosForum = { nome: string; descricao?: string | undefined; visibilidade: "publico" | "privado"; foto?: string | null | undefined };
export const lerForuns = (f: { busca?: string | undefined; meus?: boolean | undefined; offset?: number | undefined } = {}) => forunsFn({ data: f });
export const lerForum = (forumId: string) => forumFn({ data: { forumId } });
export const lerPostsDoForum = (forumId: string, c: { antes?: string | undefined; antesId?: string | undefined } = {}) =>
  postsDoForumFn({ data: { forumId, ...c } });
export const lerMembrosDoForum = (forumId: string, situacao: "pendente" | "aprovado") => membrosDoForumFn({ data: { forumId, situacao } });
export const criarForum = (d: DadosForum) => criarForumFn({ data: d });
export const editarForum = (forumId: string, d: DadosForum) => editarForumFn({ data: { forumId, ...d } });
export const arquivarForum = (forumId: string) => arquivarForumFn({ data: { forumId } });
export const entrarNoForum = (forumId: string) => entrarNoForumFn({ data: { forumId } });
export const sairDoForum = (forumId: string) => sairDoForumFn({ data: { forumId } });
export const responderEntrada = (forumId: string, usuarioId: string, aprovar: boolean) => responderEntradaFn({ data: { forumId, usuarioId, aprovar } });
export const removerMembro = (forumId: string, usuarioId: string) => removerMembroFn({ data: { forumId, usuarioId } });
export const definirModerador = (forumId: string, usuarioId: string, moderador: boolean) => definirModeradorFn({ data: { forumId, usuarioId, moderador } });
export const ocultarPostDoForum = (postId: string, motivo: string) => ocultarPostDoForumFn({ data: { postId, motivo } });
