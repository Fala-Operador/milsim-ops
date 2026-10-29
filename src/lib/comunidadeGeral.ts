// Regras puras da comunidade geral (estilo Twitter): limites do post, fotos, denúncias,
// ritmo de publicação e formato devolvido ao navegador. A visibilidade (perfil público ou
// privado, seguidores aprovados, bloqueios) é aplicada no banco por social_posts_page()
// e espelhada aqui em `podeVerAutor` para os testes e para as checagens do servidor.
import { moderarTexto } from "@/lib/moderacao";
import { tr } from "@/i18n/lib/comunidadeGeral";

export const LIMITE_POST = 220;
export const MAX_FOTOS = 4;
export const TAMANHO_MAXIMO_FOTO = 5 * 1024 * 1024; // bytes
export const LIMITE_ALT = 200;
export const POSTS_POR_PAGINA = 20;
/** Anti-spam: intervalo mínimo entre posts e máximo por hora, por conta. */
export const INTERVALO_MINIMO_MS = 10_000;
export const POSTS_POR_HORA = 30;

export const TIPOS_FOTO = ["image/jpeg", "image/png", "image/webp"] as const;

export const MOTIVOS_DENUNCIA = {
  get adulto() { return tr("conteudo_sexual_ou_adulto"); },
  get violencia() { return tr("morte_ou_violencia_real"); },
  get drogas() { return tr("drogas_ilicitas"); },
  get ofensa() { return tr("ofensa_odio_ou_assedio"); },
  get spam() { return tr("spam_ou_golpe"); },
  get dados_pessoais() { return tr("expoe_dados_pessoais"); },
  get outro() { return tr("outro_motivo"); },
} as const;
export type MotivoDenunciaSocial = keyof typeof MOTIVOS_DENUNCIA;
export const ehMotivoDenuncia = (v: unknown): v is MotivoDenunciaSocial => typeof v === "string" && v in MOTIVOS_DENUNCIA;

export interface FotoEnviada {
  /** data URL (base64) da imagem já recortada/redimensionada no navegador. */
  dados: string;
  alt?: string | undefined;
}

export interface AutorDTO {
  id: string;
  nome: string;
  fotoUrl?: string | undefined;
}

export interface PostDTO {
  id: string;
  autor: AutorDTO;
  parentId?: string | undefined;
  /** Fórum do post (vazio = feed geral). */
  forumId?: string | undefined;
  texto: string;
  imagens: { url: string; alt: string }[];
  criadoEm: string;
  editadoEm?: string | undefined;
  curtidas: number;
  respostas: number;
  curtiu: boolean;
  proprio: boolean;
}

export interface PaginaPosts {
  posts: PostDTO[];
  /** Cursor da próxima página (vazio = acabou). */
  proximo?: { antes: string; antesId: string } | undefined;
}

export type RelacaoSeguir = "eu" | "nenhuma" | "pendente" | "seguindo" | "bloqueado";

export interface PerfilSocialDTO {
  autor: AutorDTO;
  privado: boolean;
  seguidores: number;
  seguindo: number;
  relacao: RelacaoSeguir;
  /** Visitante ou não seguidor de perfil privado: os posts não aparecem. */
  postsVisiveis: boolean;
}

const DATA_URL = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/;

/** Bytes de um data URL base64 (sem decodificar). */
export function tamanhoDataUrl(dados: string): number {
  const b64 = dados.slice(dados.indexOf(",") + 1);
  const pad = b64.endsWith("==") ? 2 : b64.endsWith("=") ? 1 : 0;
  return Math.floor((b64.length * 3) / 4) - pad;
}

/** Primeiro problema do post (vazio = pode publicar). Inclui a moderação do texto. */
export function erroPost(texto: string, fotos: FotoEnviada[]): string {
  const t = texto.trim();
  if (!t && fotos.length === 0) return tr("escreva_algo_ou_adicione_uma_foto");
  if ([...t].length > LIMITE_POST) return tr("use_no_maximo_limite_post_caracteres", { LIMITE_POST });
  if (fotos.length > MAX_FOTOS) return tr("adicione_no_maximo_max_fotos_fotos", { MAX_FOTOS });
  for (const f of fotos) {
    if (!DATA_URL.test(f.dados)) return tr("formato_de_foto_invalido_use_jpg");
    if (tamanhoDataUrl(f.dados) > TAMANHO_MAXIMO_FOTO) return tr("cada_foto_pode_ter_no_maximo");
    if ((f.alt ?? "").length > LIMITE_ALT) return tr("a_descricao_da_foto_pode_ter", { LIMITE_ALT });
  }
  const m = moderarTexto(t);
  if (!m.aprovado) return m.motivo;
  return "";
}

/** Anti-spam: dado o horário dos posts recentes da conta, pode publicar agora? */
export function erroRitmo(recentes: string[], agora: Date = new Date()): string {
  const t = agora.getTime();
  const tempos = recentes.map((r) => new Date(r).getTime()).filter((x) => Number.isFinite(x));
  if (tempos.some((x) => t - x < INTERVALO_MINIMO_MS)) return tr("espere_alguns_segundos_antes_de_publicar");
  if (tempos.filter((x) => t - x < 3_600_000).length >= POSTS_POR_HORA) return tr("voce_atingiu_o_limite_de_publicacoes");
  return "";
}

/**
 * Mesma regra de social_visible_author() (o banco é quem aplica nas leituras):
 * o próprio autor; perfil público; ou seguidor aprovado de perfil privado — sem bloqueio.
 */
export function podeVerAutor(p: {
  quemVe: string | null;
  autor: { id: string; ativo: boolean; privado: boolean };
  seguidorAprovado: boolean;
  bloqueio: boolean;
}): boolean {
  if (!p.autor.ativo || p.bloqueio) return false;
  if (p.quemVe === p.autor.id) return true;
  return !p.autor.privado || (!!p.quemVe && p.seguidorAprovado);
}

/**
 * Quem vê o perfil (posts e ficha do operador): o próprio; perfil público; ou seguidor aprovado
 * de perfil privado. Bloqueio, em qualquer sentido, esconde.
 */
export const perfilVisivel = (relacao: RelacaoSeguir, privado: boolean): boolean =>
  relacao === "eu" || (relacao !== "bloqueado" && (!privado || relacao === "seguindo"));

/** Seguir perfil público aprova na hora; privado vira pedido para o dono aprovar. */
export const statusAoSeguir = (perfilPrivado: boolean): "pendente" | "aprovado" => (perfilPrivado ? "pendente" : "aprovado");

// ---------------- Fóruns (fase 2) ----------------
// Qualquer conta cria até 3 fóruns ativos. Público: qualquer pessoa lê e entra na hora.
// Privado: só membros aprovados leem; entrar vira pedido. Dono e moderadores aprovam pedidos,
// removem membros e ocultam posts do fórum; só o dono nomeia moderadores, edita e arquiva
// (o admin também arquiva). Posts de fórum não aparecem no feed geral nem no perfil do autor.

export const LIMITE_FORUNS_POR_CONTA = 3;
export const NOME_FORUM_MIN = 3;
export const NOME_FORUM_MAX = 60;
export const DESCRICAO_FORUM_MAX = 300;

export type VisibilidadeForum = "publico" | "privado";
export type PapelForum = "dono" | "moderador" | "membro";
export type SituacaoMembro = "pendente" | "aprovado";

export interface ForumDTO {
  id: string;
  nome: string;
  descricao?: string | undefined;
  visibilidade: VisibilidadeForum;
  /** Foto do fórum (quadrada, opcional). */
  fotoUrl?: string | undefined;
  dono: AutorDTO;
  criadoEm: string;
  membros: number;
  /** Só para quem modera; para os demais vem 0. */
  pedidosPendentes: number;
  meuPapel?: PapelForum | undefined;
  minhaSituacao?: SituacaoMembro | undefined;
}

export interface MembroForumDTO extends AutorDTO {
  papel: PapelForum;
  situacao: SituacaoMembro;
  desde: string;
}

export const ehVisibilidadeForum = (v: unknown): v is VisibilidadeForum => v === "publico" || v === "privado";

/** Primeiro problema do formulário do fórum (vazio = válido), com a moderação de texto. */
export function erroForum(nome: string, descricao: string | undefined, visibilidade: string): string {
  const n = nome.trim();
  if ([...n].length < NOME_FORUM_MIN) return tr("de_um_nome_com_pelo_menos", { NOME_FORUM_MIN });
  if ([...n].length > NOME_FORUM_MAX) return tr("o_nome_pode_ter_ate_nome", { NOME_FORUM_MAX });
  if ([...(descricao ?? "").trim()].length > DESCRICAO_FORUM_MAX) return tr("a_descricao_pode_ter_ate_descricao", { DESCRICAO_FORUM_MAX });
  if (!ehVisibilidadeForum(visibilidade)) return tr("escolha_se_o_forum_e_publico");
  const m = moderarTexto(`${n} ${descricao ?? ""}`);
  if (!m.aprovado) return m.motivo;
  return "";
}

/** Foto do fórum enviada pelo navegador (data URL JPG/PNG/WebP de até 5 MB); vazio = válida. */
export function erroFotoForum(dados: string): string {
  if (!DATA_URL.test(dados)) return tr("formato_de_foto_invalido_use_jpg");
  if (tamanhoDataUrl(dados) > TAMANHO_MAXIMO_FOTO) return tr("a_foto_pode_ter_no_maximo");
  return "";
}

/** Membro aprovado com poder de moderação no fórum. */
export const moderaForum = (papel: PapelForum | undefined, situacao: SituacaoMembro | undefined): boolean =>
  situacao === "aprovado" && (papel === "dono" || papel === "moderador");

/** Quem pode remover quem: o dono remove qualquer um (menos ele); moderador só membros. */
export function podeRemoverMembro(quem: PapelForum | undefined, alvo: PapelForum): boolean {
  if (alvo === "dono") return false;
  if (quem === "dono") return true;
  return quem === "moderador" && alvo === "membro";
}

/** Entrar: público aprova na hora; privado vira pedido. */
export const situacaoAoEntrar = (v: VisibilidadeForum): SituacaoMembro => (v === "privado" ? "pendente" : "aprovado");
