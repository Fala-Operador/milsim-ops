// Comunidade geral (estilo Twitter): leituras paginadas e escritas FORA da base exportada.
// O feed não cabe no modelo "base inteira + visão" (todos veem todos, cresce sem limite):
//  * leitura: social_posts_page() aplica a visibilidade no banco (perfil público, seguidor
//    aprovado, bloqueio) e devolve só uma página; aqui só se acrescenta nome e foto do autor;
//  * escrita: direto nas tabelas social_* com o cliente do servidor, sempre com a identidade
//    da sessão (contextoSomenteLeitura) — nunca um id vindo do navegador.
// Notificações e a preferência de perfil continuam na base (mutar), como o resto da conta.
import "@tanstack/react-start/server-only";
import { supabaseAdmin } from "@/server/supabase.server";
import { enviarArquivo } from "@/server/midia";
import { contextoSomenteLeitura, exigirAdmin, exigirUsuario, mutar, tratarErro } from "@/server/unidade.server";
import { ErroDominio, gerarId } from "@/services/db";
import { nomeExibicao } from "@/services/comunidade";
import { silenciado } from "@/services/notificacoes";
import {
  ehMotivoDenuncia,
  erroPost,
  erroRitmo,
  POSTS_POR_PAGINA,
  statusAoSeguir,
  type AutorDTO,
  type FotoEnviada,
  type MotivoDenunciaSocial,
  type PaginaPosts,
  type PerfilSocialDTO,
  type PostDTO,
  type RelacaoSeguir,
} from "@/lib/comunidadeGeral";
import type { BaseDados, Usuario } from "@/lib/domain/types";

interface LinhaPost {
  id: string;
  author_id: string;
  parent_id: string | null;
  body: string;
  created_at: string;
  edited_at: string | null;
  image_urls: string[];
  image_alts: string[];
  like_count: number | string;
  reply_count: number | string;
  liked: boolean;
}

export interface Cursor {
  antes?: string | undefined;
  antesId?: string | undefined;
}

const LINK_POST = (id: string) => `/comunidades/p/${id}`;

function autorDTO(base: BaseDados, id: string): AutorDTO {
  const u = base.usuarios.find((x) => x.id === id);
  return { id, nome: nomeExibicao(u), fotoUrl: u?.fotoUrl };
}

function paraDTO(base: BaseDados, quemVe: string | null, l: LinhaPost): PostDTO {
  return {
    id: l.id,
    autor: autorDTO(base, l.author_id),
    parentId: l.parent_id ?? undefined,
    texto: l.body,
    imagens: l.image_urls.map((url, i) => ({ url, alt: l.image_alts[i] ?? "" })),
    criadoEm: l.created_at,
    editadoEm: l.edited_at ?? undefined,
    curtidas: Number(l.like_count),
    respostas: Number(l.reply_count),
    curtiu: !!l.liked,
    proprio: !!quemVe && l.author_id === quemVe,
  };
}

/** Erro do banco vira erro genérico (com código no log); regras viram mensagem. */
function falha(contexto: string, error: { message?: string; code?: string } | null): never {
  throw new Error(`${contexto}: ${error?.message || error?.code || "sem detalhe"}`);
}

async function paginaDe(
  base: BaseDados,
  quemVe: string | null,
  filtro: { autor?: string; parent?: string; post?: string },
  cursor: Cursor = {},
  limite = POSTS_POR_PAGINA,
): Promise<PaginaPosts> {
  const { data, error } = await supabaseAdmin().rpc("social_posts_page", {
    p_viewer: quemVe,
    p_author: filtro.autor ?? null,
    p_parent: filtro.parent ?? null,
    p_post: filtro.post ?? null,
    p_before: cursor.antes ?? null,
    p_before_id: cursor.antesId ?? null,
    p_limit: limite,
  });
  if (error) falha("Falha ao ler publicações", error);
  const linhas = (data ?? []) as LinhaPost[];
  const ultimo = linhas.at(-1);
  return {
    posts: linhas.map((l) => paraDTO(base, quemVe, l)),
    proximo: linhas.length === limite && ultimo ? { antes: ultimo.created_at, antesId: ultimo.id } : undefined,
  };
}

/** Executa uma operação da comunidade com a pessoa da sessão (ou visitante) e trata os erros. */
async function comSessao<T>(fn: (base: BaseDados, usuario: Usuario | null) => Promise<T>): Promise<T> {
  try {
    const { base, usuario } = await contextoSomenteLeitura();
    return await fn(base, usuario);
  } catch (e) {
    tratarErro(e);
  }
}

/** Notificação na base (respeita o silêncio da categoria comunidade). Falha não desfaz a ação. */
async function notificar(destinoId: string, titulo: string, corpo: string, link: string): Promise<void> {
  try {
    await mutar(({ base }) => {
      if (silenciado(base, destinoId, "comunidade")) return;
      base.notificacoes.push({ id: gerarId("not"), usuarioId: destinoId, titulo, corpo, link, lida: false, criadoEm: new Date().toISOString() });
    });
  } catch (e) {
    console.error("[comunidade] notificação não registrada", e);
  }
}

async function bloqueioEntre(a: string, b: string): Promise<boolean> {
  const { count, error } = await supabaseAdmin()
    .from("social_blocks")
    .select("blocker_id", { count: "exact", head: true })
    .or(`and(blocker_id.eq.${a},blocked_id.eq.${b}),and(blocker_id.eq.${b},blocked_id.eq.${a})`);
  if (error) falha("Falha ao verificar bloqueio", error);
  return (count ?? 0) > 0;
}

/** Post visível para quem vê (ou erro de "indisponível"). */
async function postVisivel(base: BaseDados, quemVe: string | null, postId: string): Promise<PostDTO> {
  const { posts } = await paginaDe(base, quemVe, { post: postId }, {}, 1);
  const post = posts[0];
  if (!post) throw new ErroDominio("post_indisponivel", "Publicação indisponível.");
  return post;
}

// ---------------- Leituras ----------------

export const lerFeed = (cursor: Cursor) =>
  comSessao((base, u) => paginaDe(base, u?.id ?? null, {}, cursor));

export const lerPostsDoAutor = (autorId: string, cursor: Cursor) =>
  comSessao((base, u) => paginaDe(base, u?.id ?? null, { autor: autorId }, cursor));

export const lerPost = (postId: string) =>
  comSessao(async (base, u) => {
    const quemVe = u?.id ?? null;
    const post = await postVisivel(base, quemVe, postId);
    const respostas = await paginaDe(base, quemVe, { parent: postId });
    // A resposta mostra a quem respondeu, se ainda for visível.
    const pai = post.parentId ? (await paginaDe(base, quemVe, { post: post.parentId }, {}, 1)).posts[0] : undefined;
    return { post, pai, respostas };
  });

export const lerRespostas = (postId: string, cursor: Cursor) =>
  comSessao((base, u) => paginaDe(base, u?.id ?? null, { parent: postId }, cursor));

export const lerPerfilSocial = (usuarioId: string) =>
  comSessao(async (base, u): Promise<PerfilSocialDTO> => {
    const alvo = base.usuarios.find((x) => x.id === usuarioId && x.ativo);
    if (!alvo) throw new ErroDominio("perfil", "Perfil indisponível.");
    const db = supabaseAdmin();
    const contar = async (coluna: "followed_id" | "follower_id") => {
      const { count, error } = await db.from("social_follows").select("status", { count: "exact", head: true }).eq(coluna, usuarioId).eq("status", "aprovado");
      if (error) falha("Falha ao contar seguidores", error);
      return count ?? 0;
    };
    let relacao: RelacaoSeguir = "nenhuma";
    if (u?.id === usuarioId) relacao = "eu";
    else if (u) {
      if (await bloqueioEntre(u.id, usuarioId)) relacao = "bloqueado";
      else {
        const { data, error } = await db.from("social_follows").select("status").eq("follower_id", u.id).eq("followed_id", usuarioId).maybeSingle();
        if (error) falha("Falha ao ler seguidor", error);
        relacao = data?.status === "aprovado" ? "seguindo" : data?.status === "pendente" ? "pendente" : "nenhuma";
      }
    }
    const privado = !!alvo.comunidadePrivada;
    return {
      autor: autorDTO(base, usuarioId),
      privado,
      seguidores: await contar("followed_id"),
      seguindo: await contar("follower_id"),
      relacao,
      postsVisiveis: relacao === "eu" || (relacao !== "bloqueado" && (!privado || relacao === "seguindo")),
    };
  });

/** Pedidos para seguir aguardando a aprovação da pessoa logada. */
export const lerPedidosParaSeguir = () =>
  comSessao(async (base, u) => {
    const eu = exigirUsuario(u);
    const { data, error } = await supabaseAdmin()
      .from("social_follows").select("follower_id, created_at").eq("followed_id", eu.id).eq("status", "pendente")
      .order("created_at", { ascending: false }).limit(100);
    if (error) falha("Falha ao ler pedidos", error);
    return (data ?? []).map((r) => ({ ...autorDTO(base, r.follower_id as string), pedidoEm: r.created_at as string }));
  });

// ---------------- Escritas ----------------

export const publicarPost = (d: { texto: string; fotos: FotoEnviada[]; respondendoA?: string | undefined }) =>
  comSessao(async (base, u) => {
    const eu = exigirUsuario(u);
    const texto = d.texto.trim();
    const erro = erroPost(texto, d.fotos);
    if (erro) throw new ErroDominio("post", erro);
    const db = supabaseAdmin();
    const { data: recentes, error: eRec } = await db
      .from("social_posts").select("created_at").eq("author_id", eu.id)
      .gte("created_at", new Date(Date.now() - 3_600_000).toISOString());
    if (eRec) falha("Falha ao verificar ritmo", eRec);
    const ritmo = erroRitmo((recentes ?? []).map((r) => r.created_at as string));
    if (ritmo) throw new ErroDominio("ritmo", ritmo);
    // Só responde o que consegue ver (e o autor do post respondido fica sabendo).
    const pai = d.respondendoA ? await postVisivel(base, eu.id, d.respondendoA) : undefined;

    const urls: string[] = [];
    for (const f of d.fotos) urls.push(await enviarArquivo(db, f.dados));
    const id = gerarId("sp");
    const { error } = await db.rpc("social_create_post", {
      p_id: id, p_author: eu.id, p_parent: pai?.id ?? null, p_body: texto,
      p_urls: urls, p_alts: d.fotos.map((f) => (f.alt ?? "").trim()),
    });
    if (error) falha("Falha ao publicar", error);
    if (pai && pai.autor.id !== eu.id) {
      await notificar(pai.autor.id, "Nova resposta", `${nomeExibicao(eu)} respondeu à sua publicação.`, LINK_POST(pai.id));
    }
    return postVisivel(base, eu.id, id);
  });

export const excluirPost = (postId: string) =>
  comSessao(async (_base, u) => {
    const eu = exigirUsuario(u);
    const { data, error } = await supabaseAdmin()
      .from("social_posts").update({ status: "removido" }).eq("id", postId).eq("author_id", eu.id).neq("status", "removido").select("id");
    if (error) falha("Falha ao excluir", error);
    if (!data?.length) throw new ErroDominio("post_indisponivel", "Publicação indisponível.");
    return null;
  });

export const curtirPost = (postId: string, curtir: boolean) =>
  comSessao(async (base, u) => {
    const eu = exigirUsuario(u);
    await postVisivel(base, eu.id, postId);
    const db = supabaseAdmin();
    const { error } = curtir
      ? await db.from("social_likes").upsert({ post_id: postId, user_id: eu.id }, { onConflict: "post_id,user_id", ignoreDuplicates: true })
      : await db.from("social_likes").delete().eq("post_id", postId).eq("user_id", eu.id);
    if (error) falha("Falha ao curtir", error);
    return null;
  });

export const seguir = (usuarioId: string) =>
  comSessao(async (base, u): Promise<RelacaoSeguir> => {
    const eu = exigirUsuario(u);
    if (eu.id === usuarioId) throw new ErroDominio("seguir", "Você não pode seguir a si mesmo.");
    const alvo = base.usuarios.find((x) => x.id === usuarioId && x.ativo);
    if (!alvo) throw new ErroDominio("perfil", "Perfil indisponível.");
    if (await bloqueioEntre(eu.id, usuarioId)) throw new ErroDominio("seguir", "Não é possível seguir esta conta.");
    const status = statusAoSeguir(!!alvo.comunidadePrivada);
    const { error } = await supabaseAdmin().from("social_follows").upsert(
      { follower_id: eu.id, followed_id: usuarioId, status, approved_at: status === "aprovado" ? new Date().toISOString() : null },
      { onConflict: "follower_id,followed_id", ignoreDuplicates: true },
    );
    if (error) falha("Falha ao seguir", error);
    await notificar(
      usuarioId,
      status === "pendente" ? "Pedido para seguir" : "Novo seguidor",
      status === "pendente" ? `${nomeExibicao(eu)} pediu para seguir você.` : `${nomeExibicao(eu)} começou a seguir você.`,
      status === "pendente" ? "/comunidades?aba=pedidos" : `/operador/${eu.id}`,
    );
    return status === "pendente" ? "pendente" : "seguindo";
  });

export const deixarDeSeguir = (usuarioId: string) =>
  comSessao(async (_base, u) => {
    const eu = exigirUsuario(u);
    const { error } = await supabaseAdmin().from("social_follows").delete().eq("follower_id", eu.id).eq("followed_id", usuarioId);
    if (error) falha("Falha ao deixar de seguir", error);
    return null;
  });

/** O dono do perfil aprova ou recusa (ou remove) um seguidor. */
export const responderPedido = (seguidorId: string, aprovar: boolean) =>
  comSessao(async (_base, u) => {
    const eu = exigirUsuario(u);
    const db = supabaseAdmin();
    const { data, error } = aprovar
      ? await db.from("social_follows").update({ status: "aprovado", approved_at: new Date().toISOString() })
          .eq("follower_id", seguidorId).eq("followed_id", eu.id).eq("status", "pendente").select("follower_id")
      : await db.from("social_follows").delete().eq("follower_id", seguidorId).eq("followed_id", eu.id).select("follower_id");
    if (error) falha("Falha ao responder pedido", error);
    if (!data?.length) throw new ErroDominio("pedido", "Pedido não encontrado.");
    if (aprovar) await notificar(seguidorId, "Pedido aceito", `${nomeExibicao(eu)} aceitou seu pedido para seguir.`, `/operador/${eu.id}`);
    return null;
  });

export const bloquear = (usuarioId: string, bloquearConta: boolean) =>
  comSessao(async (_base, u) => {
    const eu = exigirUsuario(u);
    if (eu.id === usuarioId) throw new ErroDominio("bloquear", "Você não pode bloquear a si mesmo.");
    const db = supabaseAdmin();
    if (bloquearConta) {
      const { error } = await db.from("social_blocks").upsert({ blocker_id: eu.id, blocked_id: usuarioId }, { onConflict: "blocker_id,blocked_id", ignoreDuplicates: true });
      if (error) falha("Falha ao bloquear", error);
      // Bloqueio desfaz o seguir nos dois sentidos.
      const { error: e2 } = await db.from("social_follows").delete()
        .or(`and(follower_id.eq.${eu.id},followed_id.eq.${usuarioId}),and(follower_id.eq.${usuarioId},followed_id.eq.${eu.id})`);
      if (e2) falha("Falha ao bloquear", e2);
    } else {
      const { error } = await db.from("social_blocks").delete().eq("blocker_id", eu.id).eq("blocked_id", usuarioId);
      if (error) falha("Falha ao desbloquear", error);
    }
    return null;
  });

export const denunciarPost = (postId: string, motivo: MotivoDenunciaSocial, detalhes?: string) =>
  comSessao(async (base, u) => {
    const eu = exigirUsuario(u);
    if (!ehMotivoDenuncia(motivo)) throw new ErroDominio("denuncia", "Escolha o motivo da denúncia.");
    const post = await postVisivel(base, eu.id, postId);
    if (post.proprio) throw new ErroDominio("denuncia", "Você não pode denunciar a própria publicação.");
    const { error } = await supabaseAdmin().from("social_reports").insert({
      id: gerarId("sdn"), post_id: postId, reporter_id: eu.id, reason: motivo, details: detalhes?.trim() || null,
    });
    // Já denunciado por esta pessoa e ainda em análise: trata como sucesso.
    if (error && error.code !== "23505") falha("Falha ao denunciar", error);
    return null;
  });

/** Preferência de perfil (fica na conta). Ao tornar público, os pedidos pendentes são aceitos. */
export async function aceitarPedidosPendentes(usuarioId: string): Promise<void> {
  const { error } = await supabaseAdmin().from("social_follows")
    .update({ status: "aprovado", approved_at: new Date().toISOString() }).eq("followed_id", usuarioId).eq("status", "pendente");
  if (error) falha("Falha ao aceitar pedidos", error);
}

// ---------------- Moderação (admin) ----------------

export interface DenunciaDTO {
  id: string;
  motivo: MotivoDenunciaSocial;
  detalhes?: string | undefined;
  criadoEm: string;
  denunciante: AutorDTO;
  post: { id: string; autor: AutorDTO; texto: string; imagens: { url: string; alt: string }[]; status: string; criadoEm: string };
}

export const lerDenunciasPendentes = () =>
  comSessao(async (base, u) => {
    exigirAdmin(u);
    const db = supabaseAdmin();
    const { data, error } = await db
      .from("social_reports")
      .select("id, reason, details, created_at, reporter_id, social_posts(id, author_id, body, status, created_at, social_post_images(url, alt, position))")
      .eq("status", "pendente").order("created_at", { ascending: true }).limit(100);
    if (error) falha("Falha ao ler denúncias", error);
    type Img = { url: string; alt: string | null; position: number };
    type P = { id: string; author_id: string; body: string; status: string; created_at: string; social_post_images: Img[] };
    return (data ?? []).map((r): DenunciaDTO => {
      const p = r.social_posts as unknown as P;
      return {
        id: r.id as string,
        motivo: r.reason as MotivoDenunciaSocial,
        detalhes: (r.details as string | null) ?? undefined,
        criadoEm: r.created_at as string,
        denunciante: autorDTO(base, r.reporter_id as string),
        post: {
          id: p.id, autor: autorDTO(base, p.author_id), texto: p.body, status: p.status, criadoEm: p.created_at,
          imagens: [...(p.social_post_images ?? [])].sort((a, b) => a.position - b.position).map((i) => ({ url: i.url, alt: i.alt ?? "" })),
        },
      };
    });
  });

/** Ocultar a publicação encerra todas as denúncias dela como procedentes; descartar só esta. */
export const resolverDenuncia = (denunciaId: string, acao: "ocultar" | "descartar", motivo?: string) =>
  comSessao(async (_base, u) => {
    const admin = exigirAdmin(u);
    const db = supabaseAdmin();
    const { data: den, error } = await db.from("social_reports").select("post_id, status").eq("id", denunciaId).maybeSingle();
    if (error) falha("Falha ao ler denúncia", error);
    if (!den || den.status !== "pendente") throw new ErroDominio("denuncia", "Denúncia não encontrada ou já resolvida.");
    const agora = new Date().toISOString();
    if (acao === "ocultar") {
      const razao = motivo?.trim();
      if (!razao) throw new ErroDominio("denuncia", "Informe o motivo para ocultar a publicação.");
      const { data: post, error: e1 } = await db.from("social_posts").update({ status: "oculto", hidden_reason: razao.slice(0, 300) })
        .eq("id", den.post_id).select("author_id").maybeSingle();
      if (e1) falha("Falha ao ocultar", e1);
      const { error: e2 } = await db.from("social_reports").update({ status: "procedente", resolved_by: admin.id, resolved_at: agora })
        .eq("post_id", den.post_id).eq("status", "pendente");
      if (e2) falha("Falha ao resolver denúncias", e2);
      if (post?.author_id) {
        await notificar(post.author_id as string, "Publicação ocultada", `Sua publicação na comunidade foi ocultada pela moderação: ${razao}`, "/comunidades");
      }
    } else {
      const { error: e3 } = await db.from("social_reports").update({ status: "descartada", resolved_by: admin.id, resolved_at: agora }).eq("id", denunciaId);
      if (e3) falha("Falha ao descartar", e3);
    }
    return null;
  });
