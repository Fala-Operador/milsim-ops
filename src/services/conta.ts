// Operações da conta do participante (missões, privacidade, suporte, notificações,
// aparência e preferências). Antes ficavam espalhadas nas páginas; agora rodam no
// servidor, sempre com a pessoa autenticada recebida da unidade de trabalho.
import { mutarBase, gerarId, ErroDominio } from "@/services/db";
import { normalizarPreferencia, type PreferenciaModalidades } from "@/lib/modalidades";
import type { Chamado, SolicitacaoPrivacidade, Usuario } from "@/lib/domain/types";
import type { Tema } from "@/lib/localizacao";

const agoraIso = () => new Date().toISOString();

// ---------- Missões ----------
export function enviarEntregaMissao(usuario: Usuario, missaoId: string, texto?: string): void {
  mutarBase((b) => {
    const missao = b.missoes.find((m) => m.id === missaoId);
    if (!missao) throw new ErroDominio("missao", "Missão não encontrada.");
    // Só quem tem inscrição confirmada no evento (e no exército da missão, se segmentada).
    const destinatario = b.inscricoes.some(
      (i) =>
        i.usuarioId === usuario.id &&
        i.eventoId === missao.eventoId &&
        i.status === "confirmada" &&
        (missao.publico === "todos" || missao.publico === i.exercitoId),
    );
    if (!destinatario) throw new ErroDominio("sem_permissao", "Esta missão não é destinada a você.");
    if (new Date(missao.prazo).getTime() < Date.now()) throw new ErroDominio("prazo", "O prazo desta missão terminou.");
    const conteudo = missao.tipoEntrega === "texto" ? texto?.trim() : undefined;
    if (missao.tipoEntrega === "texto" && !conteudo) throw new ErroDominio("conteudo", "Escreva a sua entrega.");
    const status = missao.exigeAprovacao ? "enviada" : "concluida";
    const existente = b.entregas.find((e) => e.missaoId === missaoId && e.usuarioId === usuario.id);
    if (existente) {
      existente.status = status;
      existente.conteudo = conteudo;
      existente.enviadoEm = agoraIso();
    } else {
      b.entregas.push({ id: gerarId("ent"), missaoId, usuarioId: usuario.id, status, conteudo, enviadoEm: agoraIso() });
    }
  });
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

// ---------- Aparência e preferências ----------
export function definirTema(usuario: Usuario, tema: Tema): void {
  if (tema !== "dark" && tema !== "light") throw new ErroDominio("tema", "Tema inválido.");
  usuario.tema = tema;
}

export function salvarPreferenciaModalidades(usuario: Usuario, p: PreferenciaModalidades): void {
  usuario.preferenciasModalidade = normalizarPreferencia(p);
}
