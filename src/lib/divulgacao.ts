// Regras puras da página inicial: localização, agendamento, elegibilidade e links.
// Não há tarefas agendadas no servidor: a elegibilidade dos agendamentos é
// calculada a cada carregamento/atualização da página.
import type {
  Abrangencia,
  Agendamento,
  BaseDados,
  Evento,
  LinkParceiro,
  Parceiro,
  RegiaoBR,
  SecaoInicial,
} from "@/lib/domain/types";
import { campanhasNaPosicao } from "@/lib/impulsionamento";
import { POSICAO_COMUNIDADE } from "@/lib/domain/types";
import { ocupaVaga } from "@/lib/pagamentos";
import { tr } from "@/i18n/lib/divulgacao";

export const REGIOES: RegiaoBR[] = ["Norte", "Nordeste", "Centro-Oeste", "Sudeste", "Sul"];

export const UF_REGIAO: Record<string, RegiaoBR> = {
  AC: "Norte",
  AP: "Norte",
  AM: "Norte",
  PA: "Norte",
  RO: "Norte",
  RR: "Norte",
  TO: "Norte",
  AL: "Nordeste",
  BA: "Nordeste",
  CE: "Nordeste",
  MA: "Nordeste",
  PB: "Nordeste",
  PE: "Nordeste",
  PI: "Nordeste",
  RN: "Nordeste",
  SE: "Nordeste",
  DF: "Centro-Oeste",
  GO: "Centro-Oeste",
  MT: "Centro-Oeste",
  MS: "Centro-Oeste",
  ES: "Sudeste",
  MG: "Sudeste",
  RJ: "Sudeste",
  SP: "Sudeste",
  PR: "Sul",
  RS: "Sul",
  SC: "Sul",
};

export const NACIONAL: Abrangencia = { escopo: "nacional" };

export function regiaoDaUf(uf: string): RegiaoBR | undefined {
  return UF_REGIAO[uf.toUpperCase()];
}

/** Completa região/UF a partir dos níveis mais finos. */
function niveis(a: Abrangencia) {
  if (a.escopo === "nacional") return {};
  const uf = a.escopo === "estado" || a.escopo === "cidade" ? a.uf : undefined;
  const regiao = a.regiao ?? (uf ? regiaoDaUf(uf) : undefined);
  const cidade = a.escopo === "cidade" ? a.cidade?.trim().toLowerCase() : undefined;
  return { regiao, uf, cidade };
}

/** Duas áreas se sobrepõem quando todos os níveis que ambas definem coincidem. */
export function areasSobrepostas(a: Abrangencia, b: Abrangencia): boolean {
  const x = niveis(a);
  const y = niveis(b);
  if (x.regiao && y.regiao && x.regiao !== y.regiao) return false;
  if (x.uf && y.uf && x.uf !== y.uf) return false;
  if (x.cidade && y.cidade && x.cidade !== y.cidade) return false;
  return true;
}

export function abrangenciaDoEvento(e: Evento): Abrangencia {
  return { escopo: "cidade", uf: e.uf, cidade: e.cidade, regiao: regiaoDaUf(e.uf) };
}

export function rotuloAbrangencia(a: Abrangencia): string {
  if (a.escopo === "nacional") return tr("todo_o_brasil");
  if (a.escopo === "regiao") return a.regiao ?? tr("regiao");
  if (a.escopo === "estado") return a.uf ?? tr("estado");
  return `${a.cidade ?? tr("cidade")}/${a.uf ?? ""}`;
}

export function vigente(ag: Agendamento | undefined, agora: Date): boolean {
  if (!ag) return true;
  const t = agora.getTime();
  if (ag.inicioEm && new Date(ag.inicioEm).getTime() > t) return false;
  if (ag.fimEm && new Date(ag.fimEm).getTime() <= t) return false;
  return true;
}

function vagas(base: BaseDados, e: Evento): number {
  const ativas = base.inscricoes.filter((i) => i.eventoId === e.id && ocupaVaga(i)).length;
  return e.capacidadeTotal - ativas;
}

export function esgotado(base: BaseDados, e: Evento): boolean {
  return vagas(base, e) <= 0;
}

/** Só publicados, não cancelados e ainda não encerrados podem ser divulgados. */
export function eventoElegivel(e: Evento, agora: Date): boolean {
  return e.status === "publicado" && new Date(e.fimEm).getTime() > agora.getTime();
}

export interface CartaoEventoResolvido {
  evento: Evento;
  esgotado: boolean;
  selo?: string | undefined;
  chamada?: string | undefined;
  imagem?: string | undefined;
  /** Campanha responsável pela exibição (cards "Em destaque"). */
  campanhaId?: string | undefined;
}

export interface SecaoResolvida {
  secao: SecaoInicial;
  eventos: CartaoEventoResolvido[];
  parceiros: Parceiro[];
}

/**
 * Cards de uma seção de eventos: primeiro as campanhas de impulsionamento ativas
 * (prioridade, ordem administrativa, desempate estável), depois a curadoria
 * editorial ou a seleção automática. Cada evento aparece uma vez só.
 */
export function eventosDaSecao(
  base: BaseDados,
  secao: SecaoInicial,
  local: Abrangencia,
  agora: Date,
  semente?: string,
): CartaoEventoResolvido[] {
  const vistos = new Set<string>();
  const impulsionados = campanhasNaPosicao(base, secao.id, local, agora, { semente }).flatMap(
    (c): CartaoEventoResolvido[] => {
      const e = base.eventos.find((x) => x.id === c.eventoId)!;
      vistos.add(e.id);
      return [
        {
          evento: e,
          esgotado: esgotado(base, e),
          chamada: c.chamada,
          imagem: c.imagemPromocional || e.imagemUrl,
          campanhaId: c.id,
        },
      ];
    },
  );
  const organicos = curadoriaDaSecao(base, secao, local, agora).filter(
    (c) => !vistos.has(c.evento.id),
  );
  return [...impulsionados, ...organicos];
}

function curadoriaDaSecao(
  base: BaseDados,
  secao: SecaoInicial,
  local: Abrangencia,
  agora: Date,
): CartaoEventoResolvido[] {
  if (secao.modo === "manual") {
    return secao.destaques
      .filter((d) => vigente(d.agendamento, agora))
      .sort((a, b) => a.posicao - b.posicao)
      .flatMap((d) => {
        const e = base.eventos.find((x) => x.id === d.eventoId);
        if (!e || !eventoElegivel(e, agora)) return [];
        if (!areasSobrepostas(abrangenciaDoEvento(e), local)) return [];
        const esg = esgotado(base, e);
        if (esg && !secao.mostrarEsgotados) return [];
        return [
          {
            evento: e,
            esgotado: esg,
            selo: d.selo,
            chamada: d.chamada,
            imagem: d.imagemPromocional || e.imagemUrl,
          },
        ];
      });
  }
  const cfg = secao.automatica;
  if (!cfg) return [];
  const limite = cfg.periodoDias ? agora.getTime() + cfg.periodoDias * 86400000 : Infinity;
  return base.eventos
    .filter((e) => eventoElegivel(e, agora))
    .filter((e) => areasSobrepostas(abrangenciaDoEvento(e), cfg.abrangencia))
    .filter((e) => areasSobrepostas(abrangenciaDoEvento(e), secao.abrangencia))
    .filter((e) => areasSobrepostas(abrangenciaDoEvento(e), local))
    .filter((e) => new Date(e.inicioEm).getTime() <= limite)
    .filter((e) => cfg.incluirEsgotados || !esgotado(base, e))
    .sort((a, b) =>
      cfg.ordenacao === "data"
        ? a.inicioEm.localeCompare(b.inicioEm)
        : b.criadoEm.localeCompare(a.criadoEm),
    )
    .slice(0, Math.max(1, cfg.maximo))
    .map((e) => ({ evento: e, esgotado: esgotado(base, e), imagem: e.imagemUrl }));
}

export function parceirosDaSecao(base: BaseDados, secao: SecaoInicial): Parceiro[] {
  const aceita = secao.tipo === "patrocinadores" ? "patrocinador" : "apoiador";
  return secao.parceiros
    .slice()
    .sort((a, b) => a.posicao - b.posicao)
    .flatMap((i) => {
      const p = base.parceiros.find((x) => x.id === i.parceiroId);
      if (!p || !p.ativo) return [];
      if (p.tipo !== "ambos" && p.tipo !== aceita) return [];
      return [p];
    });
}

/** Seção aparece para o local escolhido? "Todo o Brasil" mostra também os blocos regionais. */
export function secaoCompativel(secao: SecaoInicial, local: Abrangencia): boolean {
  if (local.escopo === "nacional" || secao.abrangencia.escopo === "nacional") return true;
  return areasSobrepostas(secao.abrangencia, local);
}

export function montarPaginaInicial(
  base: BaseDados,
  local: Abrangencia,
  agora: Date,
  opcoes: { incluirRascunhos?: boolean; semente?: string } = {},
): SecaoResolvida[] {
  return base.secoesInicio
    .filter((s) => s.status === "publicada" || (opcoes.incluirRascunhos && s.status === "rascunho"))
    .filter((s) => vigente(s.agendamento, agora))
    .filter((s) => secaoCompativel(s, local))
    .sort((a, b) => a.ordem - b.ordem)
    .flatMap((secao): SecaoResolvida[] => {
      if (secao.tipo === "destaques" || secao.tipo === "regional") {
        const eventos = eventosDaSecao(base, secao, local, agora, opcoes.semente);
        return eventos.length ? [{ secao, eventos, parceiros: [] }] : [];
      }
      if (secao.tipo === "patrocinadores" || secao.tipo === "apoiadores") {
        const parceiros = parceirosDaSecao(base, secao);
        return parceiros.length ? [{ secao, eventos: [], parceiros }] : [];
      }
      const b = secao.banner;
      if (!b || (!b.imagemDesktop && !b.chamada)) return [];
      return [{ secao, eventos: [], parceiros: [] }];
    });
}

// ===== Lateral da comunidade geral =====

export const LIMITE_LATERAL_OPERACOES = 3;
export const LIMITE_LATERAL_PATROCINADORES = 6;

export interface LateralComunidade {
  banners: SecaoInicial[];
  operacoes: CartaoEventoResolvido[];
  patrocinadores: Parceiro[];
}

/**
 * O que aparece na lateral da comunidade (feed e fóruns): banners publicados e marcados
 * "na comunidade" (mesmo agendamento e região da página inicial), operações impulsionadas
 * na posição "comunidade" (rodízio igual ao das outras posições) e patrocinadores ativos
 * destacados pela administração.
 */
export function lateralDaComunidade(base: BaseDados, local: Abrangencia, agora: Date, semente?: string): LateralComunidade {
  const banners = base.secoesInicio
    .filter((s) => s.tipo === "banner" && s.naComunidade && s.status === "publicada")
    .filter((s) => vigente(s.agendamento, agora) && secaoCompativel(s, local))
    .filter((s) => !!s.banner && !!(s.banner.imagemCelular || s.banner.imagemDesktop || s.banner.chamada))
    .sort((a, b) => a.ordem - b.ordem);
  const operacoes = campanhasNaPosicao(base, POSICAO_COMUNIDADE, local, agora, { semente })
    .slice(0, LIMITE_LATERAL_OPERACOES)
    .flatMap((c): CartaoEventoResolvido[] => {
      const e = base.eventos.find((x) => x.id === c.eventoId);
      return e ? [{ evento: e, esgotado: esgotado(base, e), chamada: c.chamada, imagem: c.imagemPromocional || e.imagemUrl, campanhaId: c.id }] : [];
    });
  const patrocinadores = base.parceiros
    .filter((p) => p.ativo && p.naComunidade)
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"))
    .slice(0, LIMITE_LATERAL_PATROCINADORES);
  return { banners, operacoes, patrocinadores };
}

// ===== Links =====

/** Aceita apenas http/https. Sem protocolo, assume https. Devolve null se inválido. */
export function validarUrlExterna(entrada: string | undefined): string | null {
  const v = (entrada ?? "").trim();
  if (!v) return null;
  const temEsquema = /^[a-z][a-z0-9+.-]*:/i.test(v);
  if (temEsquema && !/^https?:\/\//i.test(v)) return null;
  try {
    const u = new URL(temEsquema ? v : `https://${v}`);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    if (!u.hostname.includes(".")) return null;
    return u.toString();
  } catch {
    return null;
  }
}

// ----- Instagram -----
// Uma única regra para cadastro, edição e leitura de dados antigos. Aceita
// "@perfil", "perfil", "instagram.com/perfil" e "https://www.instagram.com/perfil/",
// e devolve sempre https://www.instagram.com/perfil/. Valida só o formato: não
// garante que a conta exista.

export type ResultadoInstagram =
  { ok: true; usuario: string; url: string } | { ok: false; erro: string };

const HOSTS_INSTAGRAM = new Set(["instagram.com", "www.instagram.com", "m.instagram.com"]);
/** Primeiros segmentos que não são perfis (publicações, reels, stories, páginas do sistema). */
const CAMINHOS_RESERVADOS = new Set([
  "p",
  "reel",
  "reels",
  "stories",
  "tv",
  "explore",
  "accounts",
  "direct",
  "about",
  "legal",
  "developer",
  "web",
]);
const TEM_ESQUEMA = /^[a-z][a-z0-9+.-]*:\/\//i;
const PARECE_SITE = /\.(com|net|org|io|app|gov|edu)(\.[a-z]{2})?$|\.br$/i;

function validarUsuarioInstagram(bruto: string): ResultadoInstagram {
  const usuario = bruto.toLowerCase();
  if (!usuario) return { ok: false, erro: tr("informe_o_nome_do_perfil_depois") };
  if (usuario.length > 30)
    return { ok: false, erro: tr("o_nome_do_perfil_tem_no") };
  if (!/^[a-z0-9._]+$/.test(usuario))
    return { ok: false, erro: tr("use_apenas_letras_numeros_ponto_e") };
  if (usuario.startsWith(".") || usuario.endsWith(".") || usuario.includes("..")) {
    return {
      ok: false,
      erro: tr("o_nome_do_perfil_nao_pode"),
    };
  }
  return { ok: true, usuario, url: `https://www.instagram.com/${usuario}/` };
}

export function analisarInstagram(entrada: string | undefined): ResultadoInstagram {
  const v = (entrada ?? "").trim();
  if (!v) return { ok: false, erro: tr("informe_o_do_perfil_ou_o") };
  if (/\s/.test(v)) return { ok: false, erro: tr("o_perfil_nao_pode_ter_espacos") };
  if (v.startsWith("@")) return validarUsuarioInstagram(v.slice(1));

  const pareceLink = TEM_ESQUEMA.test(v) || v.includes("/") || /instagram\.com/i.test(v);
  if (!pareceLink) {
    if (PARECE_SITE.test(v))
      return {
        ok: false,
        erro: tr("isso_parece_um_site_informe_o"),
      };
    return validarUsuarioInstagram(v);
  }
  let url: URL;
  try {
    url = new URL(TEM_ESQUEMA.test(v) ? v : `https://${v}`);
  } catch {
    return { ok: false, erro: tr("link_invalido") };
  }
  if (url.protocol !== "https:" && url.protocol !== "http:")
    return { ok: false, erro: tr("link_invalido") };
  if (!HOSTS_INSTAGRAM.has(url.hostname.toLowerCase()))
    return { ok: false, erro: tr("use_um_link_do_instagram_instagram") };
  // Parâmetros de compartilhamento (?igsh=…, ?hl=…) e âncoras são descartados.
  const partes = url.pathname.split("/").filter(Boolean);
  if (partes.length === 0) return { ok: false, erro: tr("falta_o_nome_do_perfil_no") };
  if (partes.length > 1 || CAMINHOS_RESERVADOS.has(partes[0]!.toLowerCase())) {
    return { ok: false, erro: tr("use_o_link_do_perfil_nao") };
  }
  return validarUsuarioInstagram(decodeURIComponent(partes[0]!));
}

export function normalizarInstagram(entrada: string | undefined): string | null {
  const r = analisarInstagram(entrada);
  return r.ok ? r.url : null;
}

/** Monta wa.me com telefone (código do país) e mensagem opcional; não envia nada. */
export function linkWhatsapp(telefone: string | undefined, mensagem?: string): string | null {
  const digitos = (telefone ?? "").replace(/\D/g, "");
  if (digitos.length < 10 || digitos.length > 15) return null;
  const texto = mensagem?.trim();
  return `https://wa.me/${digitos}${texto ? `?text=${encodeURIComponent(texto)}` : ""}`;
}

export function hrefDoLink(l: LinkParceiro): string | null {
  if (l.tipo === "whatsapp") return linkWhatsapp(l.telefone, l.mensagem);
  if (l.tipo === "instagram") return normalizarInstagram(l.url);
  return validarUrlExterna(l.url);
}

export const ROTULO_LINK: Record<LinkParceiro["tipo"], string> = {
  get site() { return tr("site"); },
  get instagram() { return tr("instagram"); },
  get whatsapp() { return tr("whatsapp"); },
  get externo() { return tr("pagina_externa"); },
  get outro() { return tr("link"); },
};

export function rotuloDoLink(l: LinkParceiro): string {
  return l.tipo === "outro" && l.rotulo?.trim() ? l.rotulo.trim() : ROTULO_LINK[l.tipo];
}

/** Mensagem de erro de um link (null = válido); usada no formulário, no serviço e nas pendências. */
export function erroDoLink(l: LinkParceiro): string | null {
  if (l.tipo === "outro" && !l.rotulo?.trim()) return tr("informe_o_rotulo_do_link_personalizado");
  if (l.tipo === "instagram") {
    const r = analisarInstagram(l.url);
    return r.ok ? null : r.erro;
  }
  if (hrefDoLink(l)) return null;
  return l.tipo === "whatsapp"
    ? tr("whatsapp_invalido_informe_o_telefone_com")
    : tr("endereco_invalido_use_um_link_http");
}

/** Links com o Instagram gravado na forma canônica (demais tipos inalterados). */
export function normalizarLinks(links: LinkParceiro[]): LinkParceiro[] {
  return links.map((l) => {
    if (l.tipo !== "instagram") return l;
    const url = normalizarInstagram(l.url);
    return url && url !== l.url ? { ...l, url } : l;
  });
}

/** Links que não puderam ser interpretados (pendências para o admin corrigir). */
export function linksPendentes(p: Pick<Parceiro, "links">): { link: LinkParceiro; erro: string }[] {
  return p.links.flatMap((link) => {
    const erro = erroDoLink(link);
    return erro ? [{ link, erro }] : [];
  });
}

export function linkPrincipal(p: Parceiro): string | null {
  const validos = p.links.filter((l) => hrefDoLink(l));
  const principal = validos.find((l) => l.principal) ?? validos[0];
  return principal ? hrefDoLink(principal) : null;
}
