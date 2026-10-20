// Monta o perfil social que o servidor devolve a quem visualiza. Fronteira de leitura do
// perfil: só entra no DTO o que a privacidade permite. Nunca inclui CPF, nascimento,
// endereço, telefone, e-mail, notas fiscais ou exército das inscrições.
import { nomeExibicao } from "@/services/comunidade";
import {
  concessaoAtiva, confirmadas, participacoesDoUsuario, progressoInsignias, resumir, statusVoucher, atende,
  type EstadoParticipacao, type ProgressoInsignia, type ResumoProgressao,
} from "@/lib/participacao";
import type {
  BaseDados, BeneficioVoucher, PerfilOperador, PrivacidadePerfil, TipoEquipamento, Usuario, VisibilidadeBloco,
} from "@/lib/domain/types";

export const PRIVACIDADE_PADRAO: PrivacidadePerfil = {
  historico: "eu", mapa: "eu", insignias: "eu", equipamentos: "eu", fotos: "eu",
};

export function perfilPadrao(usuarioId: string): PerfilOperador {
  return { usuarioId, privacidade: { ...PRIVACIDADE_PADRAO }, operacoesOcultas: [], introVista: false, atualizadoEm: new Date(0).toISOString() };
}

export interface OperacaoDTO {
  eventoId: string;
  nome: string;
  imagemUrl?: string | undefined;
  inicioEm: string;
  cidade: string;
  uf?: string | undefined;
  modalidade?: string | undefined;
  organizacao: string;
  estado: EstadoParticipacao;
  oculta: boolean;
}
/** Operação fora da plataforma, registrada pelo operador (não conta para insígnias). */
export interface OperacaoExternaDTO {
  id: string;
  nome: string;
  data: string;
  cidade: string;
  uf: string;
  organizacao?: string | undefined;
  modalidade?: string | undefined;
  fotoUrl: string;
  fotoAlt?: string | undefined;
  descricao?: string | undefined;
  visivel: boolean;
}
export interface EquipamentoDTO {
  id: string;
  marca: string;
  tipo: TipoEquipamento;
  modelo: string;
  apelido?: string | undefined;
  observacoes?: string | undefined;
  fotos: string[];
}
export interface FotoDTO {
  id: string;
  url: string;
  legenda?: string | undefined;
  alt?: string | undefined;
}
export interface InsigniaDTO {
  id: string;
  nome: string;
  descricao: string;
  icone: string;
  criterio: string;
  estado: ProgressoInsignia["estado"];
  atual: number;
  meta: number;
  conquistadaEm?: string | undefined;
}
export interface RecompensaDTO {
  id: string;
  codigo: string;
  status: "disponivel" | "utilizada" | "expirada" | "revogada";
  beneficio: BeneficioVoucher;
  origem: string; // insígnia que gerou
  eventos: { id: string; nome: string }[];
  motivo?: string | undefined;
  ocorrencia?: string | undefined;
}

export interface PerfilDTO {
  usuarioId: string;
  nome: string;
  fotoUrl?: string | undefined;
  proprio: boolean;
  /** Visitante deslogado: só nome e foto. */
  restrito: boolean;
  social?: Pick<PerfilOperador, "callsign" | "bio" | "squad" | "instagram" | "capaUrl"> | undefined;
  destaque?: { icone: string; nome: string } | undefined;
  /**
   * `estados`: só participações confirmadas na plataforma (base das insígnias).
   * `estadosTotal`: somando as operações registradas pelo operador.
   */
  resumo: { operacoes?: number | undefined; estados?: number | undefined; estadosTotal?: number | undefined; insignias?: number | undefined };
  operacoes?: OperacaoDTO[] | undefined;
  mapa?: OperacaoDTO[] | undefined;
  /** Operações fora da plataforma (mesma privacidade do mapa; terceiros veem só as visíveis). */
  externas?: OperacaoExternaDTO[] | undefined;
  insignias?: InsigniaDTO[] | undefined;
  equipamentos?: EquipamentoDTO[] | undefined;
  fotos?: FotoDTO[] | undefined;
  // Somente o proprietário:
  privacidade?: PrivacidadePerfil | undefined;
  introVista?: boolean | undefined;
  futuras?: OperacaoDTO[] | undefined;
  completude?: { percentual: number; sugestoes: string[] } | undefined;
  recompensas?: RecompensaDTO[] | undefined;
}

const pode = (v: VisibilidadeBloco, proprio: boolean, autenticado: boolean) => proprio || (v === "autenticados" && autenticado);

function paraInsigniaDTO(p: ProgressoInsignia, criterio: string): InsigniaDTO {
  return {
    id: p.insignia.id, nome: p.insignia.nome, descricao: p.insignia.descricao, icone: p.insignia.icone, criterio,
    estado: p.estado, atual: p.atual, meta: p.meta, conquistadaEm: p.conquistadaEm,
  };
}

export function completudePerfil(u: Usuario, p: PerfilOperador): { percentual: number; sugestoes: string[] } {
  const itens: [boolean, string][] = [
    [!!u.fotoUrl, "Adicione uma foto de perfil"],
    [!!p.callsign, "Escolha um callsign"],
    [!!p.bio, "Escreva uma biografia curta"],
    [!!p.capaUrl, "Personalize a capa"],
    [!!p.insigniaDestaque, "Destaque uma insígnia conquistada"],
  ];
  const feitos = itens.filter(([ok]) => ok).length;
  return { percentual: Math.round((feitos / itens.length) * 100), sugestoes: itens.filter(([ok]) => !ok).map(([, s]) => s) };
}

export function montarPerfil(base: BaseDados, alvoId: string, quem: Usuario | null, agora = new Date()): PerfilDTO | null {
  const alvo = base.usuarios.find((u) => u.id === alvoId && u.ativo);
  if (!alvo) return null;
  const proprio = quem?.id === alvo.id;
  const autenticado = !!quem;
  const dto: PerfilDTO = { usuarioId: alvo.id, nome: nomeExibicao(alvo), fotoUrl: alvo.fotoUrl, proprio, restrito: !autenticado, resumo: {} };
  if (!autenticado) return dto;

  const perfil = base.perfisOperador.find((p) => p.usuarioId === alvo.id) ?? perfilPadrao(alvo.id);
  const priv = perfil.privacidade;
  if (perfil.callsign) dto.nome = perfil.callsign;
  dto.social = { callsign: perfil.callsign, bio: perfil.bio, squad: perfil.squad, instagram: perfil.instagram, capaUrl: perfil.capaUrl };

  const todas = participacoesDoUsuario(base, alvo.id, agora);
  const ocultas = new Set(perfil.operacoesOcultas);
  // O que terceiros podem usar: só participações confirmadas e não ocultadas.
  const visiveis = proprio ? todas : confirmadas(todas).filter((p) => !ocultas.has(p.eventoId));
  const paraDTO = (p: (typeof todas)[number]): OperacaoDTO => {
    const e = base.eventos.find((x) => x.id === p.eventoId)!;
    return {
      eventoId: e.id, nome: e.nome, imagemUrl: e.imagemUrl, inicioEm: e.inicioEm, cidade: e.cidade, uf: p.uf,
      modalidade: e.modalidade, organizacao: base.organizacoes.find((o) => o.id === e.organizacaoId)?.nome ?? "",
      estado: p.estado, oculta: ocultas.has(e.id),
    };
  };
  const historico = visiveis.filter((p) => p.estado === "participou");
  const resumoPublico: ResumoProgressao = resumir(historico.filter((p) => proprio || !ocultas.has(p.eventoId)));
  const resumoReal = resumir(todas);

  // Insígnias: para terceiros, só as que as participações visíveis sustentam
  // (uma insígnia não pode revelar uma operação ocultada).
  const concessoes = base.concessoesInsignia.filter((c) => c.usuarioId === alvo.id && concessaoAtiva(c));
  const concVisiveis = proprio ? concessoes : concessoes.filter((c) => atende(c.criterio, resumoPublico));
  const catalogo = proprio ? base.insignias : base.insignias.filter((i) => concVisiveis.some((c) => c.insigniaId === i.id));
  const progresso = progressoInsignias(catalogo, concVisiveis, proprio ? resumoReal : resumoPublico)
    .filter((p) => proprio || p.estado === "conquistada");
  const descr = (id: string) => {
    const i = base.insignias.find((x) => x.id === id)!;
    const meta = i.criterio.meta;
    return `${meta} ${i.criterio.tipo === "operacoes" ? "operações concluídas" : i.criterio.tipo === "estados" ? "estados diferentes" : "modalidades diferentes"}`;
  };

  const verHist = pode(priv.historico, proprio, autenticado);
  const verMapa = pode(priv.mapa, proprio, autenticado);
  const verIns = pode(priv.insignias, proprio, autenticado);
  if (verHist) { dto.operacoes = historico.map(paraDTO); dto.resumo.operacoes = proprio ? resumoReal.operacoes : resumoPublico.operacoes; }
  if (verMapa) {
    // Dono vê "Participando" e "Participou"; terceiros só "Participou".
    dto.mapa = (proprio ? visiveis : historico).filter((p) => p.uf).map(paraDTO);
    dto.resumo.estados = proprio ? resumoReal.estados.length : resumoPublico.estados.length;
    // Fora da plataforma: aparecem no mapa e no total de estados, nunca nas insígnias.
    const externas = base.operacoesExternas
      .filter((o) => o.usuarioId === alvo.id && (proprio || o.visivel))
      .sort((a, b) => b.data.localeCompare(a.data));
    dto.externas = externas.map((o) => ({
      id: o.id, nome: o.nome, data: o.data, cidade: o.cidade, uf: o.uf, organizacao: o.organizacao, modalidade: o.modalidade,
      fotoUrl: o.fotoUrl, fotoAlt: o.fotoAlt, descricao: o.descricao, visivel: o.visivel,
    }));
    const estadosPlataforma = proprio ? resumoReal.estados : resumoPublico.estados;
    dto.resumo.estadosTotal = new Set([...estadosPlataforma, ...externas.map((o) => o.uf)]).size;
  }
  if (verIns) {
    dto.insignias = progresso.map((p) => paraInsigniaDTO(p, descr(p.insignia.id)));
    dto.resumo.insignias = progresso.filter((p) => p.estado === "conquistada").length;
    const d = perfil.insigniaDestaque && progresso.find((p) => p.insignia.id === perfil.insigniaDestaque && p.estado === "conquistada");
    if (d) dto.destaque = { icone: d.insignia.icone, nome: d.insignia.nome };
  }
  if (pode(priv.equipamentos, proprio, autenticado)) {
    dto.equipamentos = base.equipamentos
      .filter((e) => e.usuarioId === alvo.id && (proprio || e.visivel))
      .map((e) => ({ id: e.id, marca: e.marca, tipo: e.tipo, modelo: e.modelo, apelido: e.apelido, observacoes: e.observacoes, fotos: e.fotos }));
  }
  if (pode(priv.fotos, proprio, autenticado)) {
    dto.fotos = base.fotosPerfil
      .filter((f) => f.usuarioId === alvo.id && (proprio || f.visivel))
      .sort((a, b) => b.criadoEm.localeCompare(a.criadoEm))
      .map((f) => ({ id: f.id, url: f.url, legenda: f.legenda, alt: f.alt }));
  }

  if (proprio) {
    dto.privacidade = priv;
    dto.introVista = perfil.introVista;
    dto.futuras = todas.filter((p) => p.estado === "participando").map(paraDTO);
    dto.completude = completudePerfil(alvo, perfil);
    dto.recompensas = base.vouchers
      .filter((v) => v.usuarioId === alvo.id)
      .sort((a, b) => b.concedidoEm.localeCompare(a.concedidoEm))
      .map((v) => {
        const conc = base.concessoesInsignia.find((c) => c.id === v.concessaoId);
        const ins = conc && base.insignias.find((i) => i.id === conc.insigniaId);
        return {
          id: v.id, codigo: v.codigo, status: statusVoucher(v, agora), beneficio: v.beneficio,
          origem: ins ? `${ins.icone} ${ins.nome}` : "Conquista",
          eventos: v.beneficio.eventosElegiveis.flatMap((id) => {
            const e = base.eventos.find((x) => x.id === id);
            return e ? [{ id: e.id, nome: e.nome }] : [];
          }),
          motivo: v.motivo, ocorrencia: v.ocorrencia,
        };
      });
  }
  return dto;
}
