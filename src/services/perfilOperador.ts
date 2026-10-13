// Escritas do perfil social, galeria e equipamentos. Sempre sobre a própria conta
// (a identidade vem da sessão no servidor). Notas fiscais ficam em src/server/documentos.server.ts.
import { ErroDominio, gerarId } from "@/services/db";
import { perfilPadrao } from "@/lib/perfilSocial";
import { concessaoAtiva } from "@/lib/participacao";
import type {
  BaseDados, Equipamento, PerfilOperador, PrivacidadePerfil, TipoEquipamento, Usuario,
} from "@/lib/domain/types";

export const TIPOS_EQUIPAMENTO: Record<TipoEquipamento, string> = { spring: "Spring", hpa: "HPA", aeg: "AEG", gbbr: "GBBR" };
export const MAX_FOTOS_EQUIPAMENTO = 4;
export const MAX_FOTOS_GALERIA = 30;
export const TAMANHO_MAX_IMAGEM = 3 * 1024 * 1024; // caracteres do data URL
const IMAGEM_DATA_URL = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/;

const limpar = (s: string | undefined, max: number) => {
  const t = (s ?? "").trim();
  if (t.length > max) throw new ErroDominio("tamanho", `Texto acima de ${max} caracteres.`);
  return t || undefined;
};

function exigirImagem(dataUrl: string) {
  if (dataUrl.length > TAMANHO_MAX_IMAGEM) throw new ErroDominio("imagem", "Imagem grande demais. Use uma menor.");
  if (!IMAGEM_DATA_URL.test(dataUrl)) throw new ErroDominio("imagem", "Formato inválido. Use JPG, PNG ou WebP.");
}

export function obterPerfilProprio(base: BaseDados, usuarioId: string): PerfilOperador {
  let p = base.perfisOperador.find((x) => x.usuarioId === usuarioId);
  if (!p) { p = perfilPadrao(usuarioId); base.perfisOperador.push(p); }
  return p;
}

export interface DadosPerfil {
  callsign?: string | undefined;
  bio?: string | undefined;
  squad?: string | undefined;
  instagram?: string | undefined;
  /** data URL nova, null para remover, undefined para manter. */
  capa?: string | null | undefined;
  insigniaDestaque?: string | null | undefined;
}

export function salvarPerfil(base: BaseDados, u: Usuario, d: DadosPerfil): void {
  const p = obterPerfilProprio(base, u.id);
  p.callsign = limpar(d.callsign, 30);
  p.bio = limpar(d.bio, 280);
  p.squad = limpar(d.squad, 60);
  const insta = limpar(d.instagram, 40)?.replace(/^@/, "");
  if (insta && !/^[A-Za-z0-9._]{1,30}$/.test(insta)) throw new ErroDominio("instagram", "Instagram inválido: use apenas letras, números, ponto e sublinhado.");
  p.instagram = insta;
  if (d.capa === null) p.capaUrl = undefined;
  else if (d.capa) { exigirImagem(d.capa); p.capaUrl = d.capa; }
  if (d.insigniaDestaque === null) p.insigniaDestaque = undefined;
  else if (d.insigniaDestaque) {
    const ok = base.concessoesInsignia.some((c) => c.usuarioId === u.id && c.insigniaId === d.insigniaDestaque && concessaoAtiva(c));
    if (!ok) throw new ErroDominio("insignia", "Só é possível destacar uma insígnia conquistada.");
    p.insigniaDestaque = d.insigniaDestaque;
  }
  p.atualizadoEm = new Date().toISOString();
}

export function salvarPrivacidade(base: BaseDados, u: Usuario, priv: PrivacidadePerfil): void {
  const p = obterPerfilProprio(base, u.id);
  p.privacidade = { ...priv };
  p.introVista = true;
  p.atualizadoEm = new Date().toISOString();
}

export function marcarIntroVista(base: BaseDados, u: Usuario): void {
  obterPerfilProprio(base, u.id).introVista = true;
}

export function alternarOperacaoOculta(base: BaseDados, u: Usuario, eventoId: string, oculta: boolean): void {
  const p = obterPerfilProprio(base, u.id);
  const set = new Set(p.operacoesOcultas);
  if (oculta) set.add(eventoId); else set.delete(eventoId);
  p.operacoesOcultas = [...set];
  p.atualizadoEm = new Date().toISOString();
}

// ---------- Equipamentos ----------
export interface DadosEquipamento {
  id?: string | undefined;
  marca: string;
  tipo: TipoEquipamento;
  modelo: string;
  apelido?: string | undefined;
  observacoes?: string | undefined;
  /** URLs já salvas deste equipamento ou data URLs novas. */
  fotos: string[];
  visivel: boolean;
}

export function salvarEquipamento(base: BaseDados, u: Usuario, d: DadosEquipamento): Equipamento {
  const marca = limpar(d.marca, 60);
  const modelo = limpar(d.modelo, 80);
  if (!marca || !modelo) throw new ErroDominio("obrigatorio", "Informe marca, tipo e modelo.");
  if (!(d.tipo in TIPOS_EQUIPAMENTO)) throw new ErroDominio("tipo", "Tipo inválido.");
  if (d.fotos.length > MAX_FOTOS_EQUIPAMENTO) throw new ErroDominio("fotos", `Até ${MAX_FOTOS_EQUIPAMENTO} fotos por equipamento.`);
  const existente = d.id ? base.equipamentos.find((e) => e.id === d.id && e.usuarioId === u.id) : undefined;
  if (d.id && !existente) throw new ErroDominio("equipamento", "Equipamento não encontrado.");
  for (const f of d.fotos) {
    if (f.startsWith("data:")) exigirImagem(f);
    else if (!existente?.fotos.includes(f)) throw new ErroDominio("fotos", "Foto inválida.");
  }
  const agora = new Date().toISOString();
  const dados = { marca, modelo, tipo: d.tipo, apelido: limpar(d.apelido, 60), observacoes: limpar(d.observacoes, 500), fotos: [...d.fotos], visivel: d.visivel, atualizadoEm: agora };
  if (existente) { Object.assign(existente, dados); return existente; }
  const novo: Equipamento = { id: gerarId("eqp"), usuarioId: u.id, criadoEm: agora, ...dados };
  base.equipamentos.push(novo);
  return novo;
}

export function excluirEquipamento(base: BaseDados, u: Usuario, id: string): void {
  const i = base.equipamentos.findIndex((e) => e.id === id && e.usuarioId === u.id);
  if (i < 0) throw new ErroDominio("equipamento", "Equipamento não encontrado.");
  base.equipamentos.splice(i, 1);
}

// ---------- Galeria ----------
export function adicionarFoto(base: BaseDados, u: Usuario, d: { dataUrl: string; legenda?: string | undefined; alt?: string | undefined }): void {
  if (base.fotosPerfil.filter((f) => f.usuarioId === u.id).length >= MAX_FOTOS_GALERIA) {
    throw new ErroDominio("galeria", `Limite de ${MAX_FOTOS_GALERIA} fotos na galeria.`);
  }
  exigirImagem(d.dataUrl);
  // Fotos novas começam privadas até a pessoa decidir compartilhar.
  base.fotosPerfil.push({
    id: gerarId("fot"), usuarioId: u.id, url: d.dataUrl, legenda: limpar(d.legenda, 200), alt: limpar(d.alt, 200),
    visivel: false, criadoEm: new Date().toISOString(),
  });
}

export function editarFoto(base: BaseDados, u: Usuario, id: string, d: { legenda?: string | undefined; alt?: string | undefined; visivel: boolean }): void {
  const f = base.fotosPerfil.find((x) => x.id === id && x.usuarioId === u.id);
  if (!f) throw new ErroDominio("foto", "Foto não encontrada.");
  f.legenda = limpar(d.legenda, 200);
  f.alt = limpar(d.alt, 200);
  f.visivel = d.visivel;
}

export function excluirFoto(base: BaseDados, u: Usuario, id: string): void {
  const i = base.fotosPerfil.findIndex((x) => x.id === id && x.usuarioId === u.id);
  if (i < 0) throw new ErroDominio("foto", "Foto não encontrada.");
  base.fotosPerfil.splice(i, 1);
}
