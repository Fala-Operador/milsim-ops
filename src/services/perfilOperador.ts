// Escritas do perfil social, galeria e equipamentos. Sempre sobre a própria conta
// (a identidade vem da sessão no servidor). Notas fiscais ficam em src/server/documentos.server.ts.
import { ErroDominio, gerarId } from "@/services/db";
import { perfilPadrao } from "@/lib/perfilSocial";
import { concessaoAtiva, UFS_VALIDAS } from "@/lib/participacao";
import { ehModalidade } from "@/lib/modalidades";
import type {
  BaseDados, Equipamento, OperacaoExterna, PerfilOperador, PrivacidadePerfil, TipoEquipamento, Usuario,
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

// ---------- Operações fora da plataforma ----------
// Registradas pelo próprio operador, com foto obrigatória. Só alimentam o mapa e o perfil
// ("Registrada pelo operador"); insígnias e recompensas leem apenas inscrições confirmadas.
export const MAX_OPERACOES_EXTERNAS = 200;

export interface DadosOperacaoExterna {
  id?: string | undefined;
  nome: string;
  data: string; // AAAA-MM-DD
  cidade: string;
  uf: string;
  organizacao?: string | undefined;
  modalidade?: string | undefined;
  /** data URL nova ou a URL já salva desta operação. */
  foto: string;
  fotoAlt?: string | undefined;
  descricao?: string | undefined;
  visivel: boolean;
}

/** Valida e normaliza (sem gravar). `fotoAtual` é a URL já salva, que pode ser mantida. */
export function validarOperacaoExterna(d: DadosOperacaoExterna, fotoAtual?: string, hoje = new Date()): Omit<OperacaoExterna, "id" | "usuarioId" | "criadoEm" | "atualizadoEm"> {
  const nome = (d.nome ?? "").trim();
  if (nome.length < 2) throw new ErroDominio("nome", "Informe o nome da operação.");
  if (nome.length > 120) throw new ErroDominio("nome", "Nome da operação: no máximo 120 caracteres.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d.data) || Number.isNaN(Date.parse(`${d.data}T12:00:00Z`))) {
    throw new ErroDominio("data", "Informe a data da operação.");
  }
  const ano = Number(d.data.slice(0, 4));
  const amanha = new Date(hoje.getTime() + 86_400_000).toISOString().slice(0, 10);
  if (ano < 1990) throw new ErroDominio("data", "Data muito antiga.");
  if (d.data > amanha) throw new ErroDominio("data", "Registre só operações que já aconteceram.");
  const cidade = (d.cidade ?? "").trim();
  if (!cidade) throw new ErroDominio("cidade", "Informe a cidade.");
  if (cidade.length > 80) throw new ErroDominio("cidade", "Cidade: no máximo 80 caracteres.");
  const uf = (d.uf ?? "").trim().toUpperCase();
  if (!UFS_VALIDAS.has(uf)) throw new ErroDominio("uf", "Escolha o estado (UF).");
  if (d.modalidade && !ehModalidade(d.modalidade)) throw new ErroDominio("modalidade", "Modalidade inválida.");
  // Foto obrigatória: ou a já salva desta operação, ou uma nova (data URL válida).
  if (!d.foto) throw new ErroDominio("foto", "Adicione uma foto da operação.");
  if (d.foto !== fotoAtual) exigirImagem(d.foto);
  return {
    nome, data: d.data, cidade, uf,
    organizacao: limpar(d.organizacao, 120),
    modalidade: d.modalidade || undefined,
    fotoUrl: d.foto,
    fotoAlt: limpar(d.fotoAlt, 200),
    descricao: limpar(d.descricao, 400),
    visivel: d.visivel,
  };
}

export function salvarOperacaoExterna(base: BaseDados, u: Usuario, d: DadosOperacaoExterna): OperacaoExterna {
  const agora = new Date().toISOString();
  if (d.id) {
    const op = base.operacoesExternas.find((x) => x.id === d.id && x.usuarioId === u.id);
    if (!op) throw new ErroDominio("operacao", "Operação não encontrada.");
    Object.assign(op, validarOperacaoExterna(d, op.fotoUrl), { atualizadoEm: agora });
    return op;
  }
  if (base.operacoesExternas.filter((x) => x.usuarioId === u.id).length >= MAX_OPERACOES_EXTERNAS) {
    throw new ErroDominio("limite", `Limite de ${MAX_OPERACOES_EXTERNAS} operações registradas.`);
  }
  const op: OperacaoExterna = { id: gerarId("opx"), usuarioId: u.id, ...validarOperacaoExterna(d), criadoEm: agora, atualizadoEm: agora };
  base.operacoesExternas.push(op);
  return op;
}

export function excluirOperacaoExterna(base: BaseDados, u: Usuario, id: string): void {
  const i = base.operacoesExternas.findIndex((x) => x.id === id && x.usuarioId === u.id);
  if (i < 0) throw new ErroDominio("operacao", "Operação não encontrada.");
  base.operacoesExternas.splice(i, 1);
}
