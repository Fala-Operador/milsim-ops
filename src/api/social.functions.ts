// API da comunidade geral (estilo Twitter). As leituras devolvem DTOs paginados direto (sem
// visão nem `chamar`: o feed não faz parte da base); as escritas usam a sessão no servidor.
// Só a preferência de perfil (público/privado) é da conta e volta com a visão.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import * as social from "@/server/social.server";
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

// ---------- Escritas ----------
export const publicarPostFn = createServerFn({ method: "POST" })
  .validator(z.object({ texto: z.string().max(1000), fotos: z.array(foto).max(MAX_FOTOS), respondendoA: idPost.optional() }).parse)
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
export const publicarPost = (d: { texto: string; fotos: { dados: string; alt?: string | undefined }[]; respondendoA?: string | undefined }) =>
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
