// Regras puras da comunidade geral (estilo Twitter): limites do post, fotos, denúncias,
// ritmo de publicação e formato devolvido ao navegador. A visibilidade (perfil público ou
// privado, seguidores aprovados, bloqueios) é aplicada no banco por social_posts_page()
// e espelhada aqui em `podeVerAutor` para os testes e para as checagens do servidor.
import { moderarTexto } from "@/lib/moderacao";

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
  adulto: "Conteúdo sexual ou adulto",
  violencia: "Morte ou violência real",
  drogas: "Drogas ilícitas",
  ofensa: "Ofensa, ódio ou assédio",
  spam: "Spam ou golpe",
  dados_pessoais: "Expõe dados pessoais",
  outro: "Outro motivo",
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
  if (!t && fotos.length === 0) return "Escreva algo ou adicione uma foto.";
  if ([...t].length > LIMITE_POST) return `Use no máximo ${LIMITE_POST} caracteres.`;
  if (fotos.length > MAX_FOTOS) return `Adicione no máximo ${MAX_FOTOS} fotos.`;
  for (const f of fotos) {
    if (!DATA_URL.test(f.dados)) return "Formato de foto inválido. Use JPG, PNG ou WebP.";
    if (tamanhoDataUrl(f.dados) > TAMANHO_MAXIMO_FOTO) return "Cada foto pode ter no máximo 5 MB.";
    if ((f.alt ?? "").length > LIMITE_ALT) return `A descrição da foto pode ter até ${LIMITE_ALT} caracteres.`;
  }
  const m = moderarTexto(t);
  if (!m.aprovado) return m.motivo;
  return "";
}

/** Anti-spam: dado o horário dos posts recentes da conta, pode publicar agora? */
export function erroRitmo(recentes: string[], agora: Date = new Date()): string {
  const t = agora.getTime();
  const tempos = recentes.map((r) => new Date(r).getTime()).filter((x) => Number.isFinite(x));
  if (tempos.some((x) => t - x < INTERVALO_MINIMO_MS)) return "Espere alguns segundos antes de publicar de novo.";
  if (tempos.filter((x) => t - x < 3_600_000).length >= POSTS_POR_HORA) return "Você atingiu o limite de publicações por hora. Tente mais tarde.";
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

/** Seguir perfil público aprova na hora; privado vira pedido para o dono aprovar. */
export const statusAoSeguir = (perfilPrivado: boolean): "pendente" | "aprovado" => (perfilPrivado ? "pendente" : "aprovado");
