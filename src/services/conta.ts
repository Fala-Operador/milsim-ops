// Operações da conta do participante (missões, privacidade, suporte, notificações,
// aparência e preferências). Antes ficavam espalhadas nas páginas; agora rodam no
// servidor, sempre com a pessoa autenticada recebida da unidade de trabalho.
import { mutarBase, gerarId, ErroDominio } from "@/services/db";
import { enviarEntrega } from "@/services/missoes";
import { normalizarPreferencia, type PreferenciaModalidades } from "@/lib/modalidades";
import type { Chamado, SolicitacaoPrivacidade, Usuario } from "@/lib/domain/types";
import type { Tema } from "@/lib/localizacao";
import { erroFicha, montarFicha, type DadosFicha } from "@/lib/fichaEmergencia";

const agoraIso = () => new Date().toISOString();

// ---------- Missões ----------
/** Entrega simples (texto/confirmação). A regra completa fica em services/missoes.ts. */
export function enviarEntregaMissao(usuario: Usuario, missaoId: string, texto?: string): void {
  mutarBase((b) => { enviarEntrega(b, usuario, { missaoId, texto }); });
}

// ---------- Privacidade ----------
const TIPOS_PRIVACIDADE: SolicitacaoPrivacidade["tipo"][] = ["acesso", "correcao", "exportacao", "exclusao"];

export function solicitarPrivacidade(usuario: Usuario, tipo: SolicitacaoPrivacidade["tipo"], detalhes: string): void {
  if (!TIPOS_PRIVACIDADE.includes(tipo)) throw new ErroDominio("tipo", "Tipo de solicitação inválido.");
  mutarBase((b) => {
    b.privacidade.push({ id: gerarId("priv"), usuarioId: usuario.id, tipo, detalhes: detalhes.trim(), status: "aberta", criadoEm: agoraIso() });
    for (const admin of b.usuarios.filter((u) => u.perfil === "admin" && u.ativo)) {
      b.notificacoes.push({
        id: gerarId("not"), usuarioId: admin.id, titulo: "Solicitação de privacidade",
        corpo: `Nova solicitação de ${tipo}.`, link: "/admin", lida: false, criadoEm: agoraIso(),
      });
    }
  });
}

// ---------- Suporte ----------
export interface DadosChamado {
  assunto: string;
  categoria: string;
  descricao: string;
  eventoId?: string | undefined;
}

export function abrirChamado(usuario: Usuario, d: DadosChamado): Chamado {
  if (!d.assunto.trim() || !d.descricao.trim()) throw new ErroDominio("campos", "Informe assunto e descrição.");
  return mutarBase((b) => {
    if (d.eventoId && !b.eventos.some((e) => e.id === d.eventoId)) throw new ErroDominio("evento", "Evento não encontrado.");
    const chamado: Chamado = {
      id: gerarId("cha"),
      eventoId: d.eventoId || undefined,
      solicitanteId: usuario.id,
      assunto: d.assunto.trim(),
      categoria: d.categoria,
      descricao: d.descricao.trim(),
      status: "aberto",
      mensagens: [{ id: gerarId("msg"), autorId: usuario.id, corpo: d.descricao.trim(), criadoEm: agoraIso() }],
      criadoEm: agoraIso(),
      atualizadoEm: agoraIso(),
    };
    b.chamados.push(chamado);
    return chamado;
  });
}

export function responderChamado(usuario: Usuario, chamadoId: string, corpo: string): void {
  if (!corpo.trim()) throw new ErroDominio("corpo", "Escreva a mensagem.");
  mutarBase((b) => {
    const c = b.chamados.find((x) => x.id === chamadoId);
    if (!c) throw new ErroDominio("chamado", "Chamado não encontrado.");
    const evento = c.eventoId ? b.eventos.find((e) => e.id === c.eventoId) : undefined;
    const atende =
      usuario.perfil === "admin" ||
      (usuario.perfil === "organizador" && !!evento && evento.organizacaoId === usuario.organizacaoId);
    if (c.solicitanteId !== usuario.id && !atende) throw new ErroDominio("sem_permissao", "Você não participa deste chamado.");
    c.mensagens.push({ id: gerarId("msg"), autorId: usuario.id, corpo: corpo.trim(), criadoEm: agoraIso() });
    c.status = c.solicitanteId === usuario.id ? "aberto" : "aguardando_participante";
    c.atualizadoEm = agoraIso();
  });
}

// ---------- Notificações ----------
/** Marca uma notificação como lida (a própria; admin pode marcar qualquer uma). */
export function marcarNotificacaoLida(usuario: Usuario, id: string): void {
  mutarBase((b) => {
    const n = b.notificacoes.find((x) => x.id === id);
    if (n && (n.usuarioId === usuario.id || usuario.perfil === "admin")) n.lida = true;
  });
}

/** `plataforma` (somente admin) marca todas as notificações; senão, só as próprias. */
export function marcarNotificacoesLidas(usuario: Usuario, plataforma = false): void {
  if (plataforma && usuario.perfil !== "admin") throw new ErroDominio("sem_permissao", "Apenas administradores.");
  mutarBase((b) => {
    for (const n of b.notificacoes) if (plataforma || n.usuarioId === usuario.id) n.lida = true;
  });
}

// ---------- Foto de perfil ----------
const FOTO_DATA_URL = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/;
export const TAMANHO_MAXIMO_FOTO = 3 * 1024 * 1024; // caracteres do data URL (~2,2 MB de imagem)

/**
 * Define (data URL da foto já recortada) ou remove (null) a foto da própria conta.
 * Só aceita imagem enviada agora: a unidade de trabalho a envia ao Storage e grava a URL.
 */
export function definirFoto(usuario: Usuario, foto: string | null): void {
  if (foto !== null) validarFoto(foto);
  usuario.fotoUrl = foto ?? undefined;
}

/** Foto nova enviada pelo navegador: data URL de imagem, dentro do limite. */
export function validarFoto(foto: string): void {
  if (foto.length > TAMANHO_MAXIMO_FOTO) throw new ErroDominio("foto", "A foto é grande demais. Tente uma imagem menor.");
  if (!FOTO_DATA_URL.test(foto)) throw new ErroDominio("foto", "Formato de foto inválido. Use JPG, PNG ou WebP.");
}

// ---------- Aparência e preferências ----------
export function definirTema(usuario: Usuario, tema: Tema): void {
  if (tema !== "dark" && tema !== "light") throw new ErroDominio("tema", "Tema inválido.");
  usuario.tema = tema;
}

export function salvarPreferenciaModalidades(usuario: Usuario, p: PreferenciaModalidades): void {
  usuario.preferenciasModalidade = normalizarPreferencia(p);
}

// ---------- Ficha de emergência ----------
/** Grava (ou remove, se tudo vazio) a ficha da própria conta. Regras em lib/fichaEmergencia.ts. */
export function salvarFichaEmergencia(usuario: Usuario, dados: DadosFicha): void {
  const erro = erroFicha(dados);
  if (erro) throw new ErroDominio("ficha_emergencia", erro);
  usuario.fichaEmergencia = montarFicha(dados, usuario.fichaEmergencia);
}
