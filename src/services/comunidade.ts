// Serviço da comunidade (fóruns com feed social). Todas as regras de acesso
// ficam aqui e são reaplicadas em leituras E escritas — esconder botões não basta.
import { carregarBase, mutarBase, gerarId, ErroDominio } from "@/services/db";
import { silenciado } from "@/services/notificacoes";
import type {
  BaseDados,
  Evento,
  Forum,
  ImagemPost,
  MotivoDenuncia,
  PermissaoForum,
  Publicacao,
  Resposta,
  Usuario,
} from "@/lib/domain/types";
import { tr } from "@/i18n/services/comunidade";

export const LIMITE_TEXTO = 2000;
export const LIMITE_IMAGENS = 4;
export const TAMANHO_PAGINA = 8;
export const MSG_SEM_ACESSO = () => tr("conteudo_indisponivel_ou_voce_nao_tem");

export const MOTIVOS_DENUNCIA: Record<MotivoDenuncia, string> = {
  get ofensa() { return tr("ofensa_ou_assedio"); },
  get spam() { return tr("spam"); },
  get dados_pessoais() { return tr("exposicao_de_dados_pessoais"); },
  get inadequado() { return tr("conteudo_inadequado"); },
  get outro() { return tr("outro_motivo"); },
};

// ---------- Fóruns iniciais ----------
export function forunsIniciais(eventoId: string, criadoEm: string): Forum[] {
  const base = (
    sufixo: string,
    nome: string,
    descricao: string,
    icone: string,
    ordem: number,
    publicacao: PermissaoForum,
  ): Forum => ({
    id: `for-${eventoId}-${sufixo}`,
    eventoId,
    nome,
    descricao,
    icone,
    ordem,
    publico: "todos",
    publicacao,
    respostas: "membros",
    status: "ativo",
    criadoEm,
  });
  return [
    base("avisos", "Avisos oficiais", "Comunicados da organização. Participantes podem responder.", "📢", 1, "gestao"),
    base("geral", "Conversa geral", "Papo livre entre os participantes do evento.", "💬", 2, "membros"),
    base("duvidas", "Dúvidas e preparação", "Troca de informações sobre equipamento, regras e preparação.", "❓", 3, "membros"),
    base("caronas", "Caronas e logística", "Organização voluntária de caronas e hospedagem.", "🚗", 4, "membros"),
    base("fotos", "Fotos e experiências", "Compartilhe imagens e relatos do evento.", "📷", 5, "membros"),
  ];
}

/** Cria os fóruns iniciais quando a comunidade do evento ainda não existe. */
export function garantirForuns(eventoId: string): void {
  const base = carregarBase();
  if (base.foruns.some((f) => f.eventoId === eventoId)) return;
  mutarBase((b) => {
    b.foruns.push(...forunsIniciais(eventoId, new Date().toISOString()));
  });
}

// ---------- Regras de acesso centralizadas ----------
export type Papel = "gestao" | "membro" | null;

function eventoDe(base: BaseDados, eventoId: string): Evento | undefined {
  return base.eventos.find((e) => e.id === eventoId);
}

export function papelNoEvento(base: BaseDados, usuario: Usuario | null, eventoId: string): Papel {
  if (!usuario || !usuario.ativo) return null;
  const evento = eventoDe(base, eventoId);
  if (!evento) return null;
  if (usuario.perfil === "admin") return "gestao";
  if (usuario.perfil === "organizador" && usuario.organizacaoId === evento.organizacaoId) return "gestao";
  const ins = inscricaoAtiva(base, usuario.id, eventoId);
  return ins ? "membro" : null;
}

function inscricaoAtiva(base: BaseDados, usuarioId: string, eventoId: string) {
  return base.inscricoes.find(
    (i) => i.eventoId === eventoId && i.usuarioId === usuarioId && i.status === "confirmada",
  );
}

export function estaSuspenso(base: BaseDados, usuarioId: string, eventoId: string): boolean {
  return base.restricoesComunidade.some((r) => r.ativa && r.usuarioId === usuarioId && r.eventoId === eventoId);
}

export function podeVerForum(base: BaseDados, usuario: Usuario | null, forum: Forum): boolean {
  const papel = papelNoEvento(base, usuario, forum.eventoId);
  if (!papel) return false;
  if (papel === "gestao") return true;
  if (forum.publico === "todos") return true;
  return inscricaoAtiva(base, usuario!.id, forum.eventoId)?.exercitoId === forum.publico;
}

function podeInteragir(base: BaseDados, usuario: Usuario | null, forum: Forum): boolean {
  if (!usuario || !podeVerForum(base, usuario, forum)) return false;
  if (forum.status !== "ativo") return false;
  const papel = papelNoEvento(base, usuario, forum.eventoId);
  if (papel !== "gestao" && estaSuspenso(base, usuario.id, forum.eventoId)) return false;
  return true;
}

export function podePublicar(base: BaseDados, usuario: Usuario | null, forum: Forum): boolean {
  if (!podeInteragir(base, usuario, forum)) return false;
  return forum.publicacao === "membros" || papelNoEvento(base, usuario, forum.eventoId) === "gestao";
}

export function podeResponder(base: BaseDados, usuario: Usuario | null, pub: Publicacao): boolean {
  const forum = base.foruns.find((f) => f.id === pub.forumId);
  if (!forum || !podeInteragir(base, usuario, forum)) return false;
  if (pub.removidaPeloAutor || pub.oculta) return false;
  const gestao = papelNoEvento(base, usuario, forum.eventoId) === "gestao";
  if (pub.respostasFechadas && !gestao) return false;
  return forum.respostas === "membros" || gestao;
}

export function podeCurtir(base: BaseDados, usuario: Usuario | null, pub: Publicacao): boolean {
  const forum = base.foruns.find((f) => f.id === pub.forumId);
  return !!forum && podeInteragir(base, usuario, forum) && !pub.removidaPeloAutor;
}

export function publicacaoVisivel(base: BaseDados, usuario: Usuario | null, pub: Publicacao): boolean {
  const forum = base.foruns.find((f) => f.id === pub.forumId);
  if (!forum || !podeVerForum(base, usuario, forum)) return false;
  if (pub.oculta) return papelNoEvento(base, usuario, pub.eventoId) === "gestao";
  return true;
}

export function forunsVisiveis(base: BaseDados, usuario: Usuario | null, eventoId: string): Forum[] {
  return base.foruns
    .filter((f) => f.eventoId === eventoId && podeVerForum(base, usuario, f))
    .sort((a, b) => a.ordem - b.ordem);
}

// ---------- Leitura ----------
export function nomeExibicao(u: Usuario | undefined): string {
  if (!u) return tr("participante");
  if (u.nomeExibicao?.trim()) return u.nomeExibicao.trim();
  const partes = u.nomeCompleto.split(" ");
  return partes.length > 1 ? `${partes[0]} ${partes[partes.length - 1]}` : partes[0]!;
}

/** Selo público do autor (nunca expõe exército ou dados pessoais). */
export function seloAutor(base: BaseDados, autorId: string, eventoId: string): "Admin" | "Organização" | null {
  const u = base.usuarios.find((x) => x.id === autorId);
  if (!u) return null;
  if (u.perfil === "admin") return "Admin";
  const ev = eventoDe(base, eventoId);
  if (u.perfil === "organizador" && ev && u.organizacaoId === ev.organizacaoId) return "Organização";
  return null;
}

export interface FiltroFeed {
  eventoId: string;
  forumId?: string | undefined; // undefined = "Todos"
  busca?: string | undefined;
}

export function listarFeed(usuario: Usuario | null, filtro: FiltroFeed) {
  const base = carregarBase();
  const termo = filtro.busca?.trim().toLowerCase();
  const visiveis = base.publicacoes
    .filter((p) => p.eventoId === filtro.eventoId)
    .filter((p) => !filtro.forumId || p.forumId === filtro.forumId)
    .filter((p) => publicacaoVisivel(base, usuario, p))
    .filter((p) => !termo || (!p.removidaPeloAutor && p.texto.toLowerCase().includes(termo)))
    .sort((a, b) => b.criadoEm.localeCompare(a.criadoEm));
  return {
    fixadas: visiveis.filter((p) => p.fixada),
    feed: visiveis.filter((p) => !p.fixada),
  };
}

export function buscarForuns(usuario: Usuario | null, eventoId: string, busca: string): Forum[] {
  const termo = busca.trim().toLowerCase();
  const base = carregarBase();
  return forunsVisiveis(base, usuario, eventoId).filter(
    (f) => !termo || f.nome.toLowerCase().includes(termo) || f.descricao.toLowerCase().includes(termo),
  );
}

/** Detalhe com revalidação: retorna null (mensagem genérica) quando sem acesso. */
export function detalhePublicacao(usuario: Usuario | null, publicacaoId: string) {
  const base = carregarBase();
  const pub = base.publicacoes.find((p) => p.id === publicacaoId);
  if (!pub || !publicacaoVisivel(base, usuario, pub)) return null;
  const gestao = papelNoEvento(base, usuario, pub.eventoId) === "gestao";
  const respostas = base.respostas
    .filter((r) => r.publicacaoId === pub.id && (!r.oculta || gestao))
    .sort((a, b) => a.criadoEm.localeCompare(b.criadoEm));
  return { pub, forum: base.foruns.find((f) => f.id === pub.forumId)!, respostas };
}

export function contarRespostas(base: BaseDados, pubId: string, gestao: boolean): number {
  return base.respostas.filter((r) => r.publicacaoId === pubId && (!r.oculta || gestao)).length;
}

export function contarCurtidas(base: BaseDados, pubId: string): number {
  return base.curtidas.filter((c) => c.publicacaoId === pubId).length;
}

export function curtiu(base: BaseDados, pubId: string, usuarioId: string): boolean {
  return base.curtidas.some((c) => c.publicacaoId === pubId && c.usuarioId === usuarioId);
}

/** Número de publicações acessíveis criadas após a última visita, por fórum. */
export function novidadesPorForum(usuario: Usuario, eventoId: string): Record<string, number> {
  const base = carregarBase();
  const ultima = base.visitasComunidade[`${usuario.id}:${eventoId}`];
  const res: Record<string, number> = {};
  if (!ultima) return res;
  for (const p of base.publicacoes) {
    if (p.eventoId !== eventoId || p.autorId === usuario.id || p.criadoEm <= ultima) continue;
    if (!publicacaoVisivel(base, usuario, p)) continue;
    res[p.forumId] = (res[p.forumId] ?? 0) + 1;
  }
  return res;
}

export function registrarVisita(usuarioId: string, eventoId: string): void {
  mutarBase((b) => {
    b.visitasComunidade[`${usuarioId}:${eventoId}`] = new Date().toISOString();
  });
}

/** Revalida se uma notificação com link para a comunidade ainda pode ser exibida. */
export function notificacaoAcessivel(usuario: Usuario, link: string | undefined): boolean {
  if (!link?.startsWith("/comunidade/")) return true;
  const [, , eventoId, tipo, id] = link.split("/");
  const base = carregarBase();
  if (!eventoId || !papelNoEvento(base, usuario, eventoId)) return false;
  if (tipo === "p" && id) {
    const pub = base.publicacoes.find((p) => p.id === id);
    return !!pub && publicacaoVisivel(base, usuario, pub);
  }
  return true;
}

// ---------- Helpers internos ----------
function exigirUsuario(usuario: Usuario | null): Usuario {
  if (!usuario) throw new ErroDominio("sem_sessao", tr("entre_na_sua_conta_para_continuar"));
  return usuario;
}

function exigirGestao(base: BaseDados, usuario: Usuario | null, eventoId: string): Usuario {
  const u = exigirUsuario(usuario);
  if (papelNoEvento(base, u, eventoId) !== "gestao") {
    throw new ErroDominio("sem_permissao", tr("apenas_a_organizacao_do_evento_e"));
  }
  return u;
}

function registrarModeracao(b: BaseDados, eventoId: string, autorId: string, acao: string, alvoId: string, justificativa?: string) {
  const criadoEm = new Date().toISOString();
  b.moderacao.push({ id: gerarId("mod"), eventoId, autorId, acao, alvoId, justificativa, criadoEm });
  b.auditoria.push({ id: gerarId("aud"), autorId, acao: `comunidade_${acao}`, entidade: "comunidade", entidadeId: alvoId, justificativa, criadoEm });
}

function notificar(b: BaseDados, usuarioId: string, titulo: string, corpo: string, link: string) {
  if (silenciado(b, usuarioId, "comunidade")) return;
  b.notificacoes.push({ id: gerarId("not"), usuarioId, titulo, corpo, link, lida: false, criadoEm: new Date().toISOString() });
}

/** Notifica todos os organizadores do evento (exceto o autor da ação). */
function notificarOrganizacao(b: BaseDados, eventoId: string, autorId: string, titulo: string, corpo: string, link: string) {
  const ev = b.eventos.find((e) => e.id === eventoId);
  if (!ev) return;
  for (const org of b.usuarios) {
    if (org.id === autorId || org.perfil !== "organizador" || org.organizacaoId !== ev.organizacaoId) continue;
    notificar(b, org.id, titulo, corpo, link);
  }
}

function validarConteudo(texto: string, imagens: ImagemPost[], maxImagens: number) {
  const t = texto.trim();
  if (t.length > LIMITE_TEXTO) throw new ErroDominio("texto_longo", tr("o_texto_pode_ter_no_maximo", { LIMITE_TEXTO }));
  if (imagens.length > maxImagens) throw new ErroDominio("imagens", tr("envie_no_maximo_maximagens_imagem_ns", { maxImagens }));
  if (!t && imagens.length === 0) throw new ErroDominio("vazio", tr("escreva_um_texto_ou_adicione_uma"));
  return t;
}

function obterPub(b: BaseDados, id: string): Publicacao {
  const p = b.publicacoes.find((x) => x.id === id);
  if (!p) throw new ErroDominio("nao_encontrado", MSG_SEM_ACESSO());
  return p;
}

function obterResposta(b: BaseDados, id: string): Resposta {
  const r = b.respostas.find((x) => x.id === id);
  if (!r) throw new ErroDominio("nao_encontrado", MSG_SEM_ACESSO());
  return r;
}

// ---------- Publicações ----------
export function criarPublicacao(
  usuario: Usuario | null,
  dados: { forumId: string; texto: string; imagens: ImagemPost[]; importante?: boolean | undefined },
): Publicacao {
  const u = exigirUsuario(usuario);
  return mutarBase((b) => {
    const forum = b.foruns.find((f) => f.id === dados.forumId);
    if (!forum || !podeVerForum(b, u, forum)) throw new ErroDominio("sem_acesso", MSG_SEM_ACESSO());
    if (!podePublicar(b, u, forum)) {
      throw new ErroDominio("sem_permissao", forum.status !== "ativo" ? tr("este_forum_esta_arquivado") : tr("voce_nao_pode_publicar_neste_forum"));
    }
    const texto = validarConteudo(dados.texto, dados.imagens, LIMITE_IMAGENS);
    const gestao = papelNoEvento(b, u, forum.eventoId) === "gestao";
    const pub: Publicacao = {
      id: gerarId("pub"),
      forumId: forum.id,
      eventoId: forum.eventoId,
      autorId: u.id,
      texto,
      imagens: dados.imagens,
      fixada: false,
      importante: gestao && !!dados.importante,
      respostasFechadas: false,
      oculta: false,
      removidaPeloAutor: false,
      criadoEm: new Date().toISOString(),
    };
    b.publicacoes.push(pub);
    // Notificações: importante → todos com acesso; comum → só quem segue o fórum.
    const link = `/comunidade/${forum.eventoId}/p/${pub.id}`;
    const candidatos = new Set<string>();
    b.inscricoes.filter((i) => i.eventoId === forum.eventoId && i.status === "confirmada").forEach((i) => candidatos.add(i.usuarioId));
    for (const uid of candidatos) {
      if (uid === u.id) continue;
      const destino = b.usuarios.find((x) => x.id === uid);
      if (!destino || !podeVerForum(b, destino, forum)) continue;
      const pref = b.preferenciasForum.find((p) => p.usuarioId === uid && p.forumId === forum.id)?.modo;
      if (pub.importante) notificar(b, uid, "Comunicado importante", `Nova publicação importante em ${forum.nome}.`, link);
      else if (pref === "seguir") notificar(b, uid, "Nova publicação", `Nova atividade em ${forum.nome}.`, link);
    }
    notificarOrganizacao(b, forum.eventoId, u.id, "Nova publicação na comunidade", `${nomeExibicao(u)} publicou em ${forum.nome}.`, link);
    return pub;
  });
}

export function editarPublicacao(usuario: Usuario | null, pubId: string, texto: string, imagens: ImagemPost[]): void {
  const u = exigirUsuario(usuario);
  mutarBase((b) => {
    const p = obterPub(b, pubId);
    if (p.autorId !== u.id) throw new ErroDominio("sem_permissao", tr("voce_so_pode_editar_suas_proprias"));
    if (!publicacaoVisivel(b, u, p) || p.removidaPeloAutor) throw new ErroDominio("sem_acesso", MSG_SEM_ACESSO());
    const forum = b.foruns.find((f) => f.id === p.forumId)!;
    if (forum.status !== "ativo") throw new ErroDominio("arquivado", tr("este_forum_esta_arquivado"));
    p.texto = validarConteudo(texto, imagens, LIMITE_IMAGENS);
    p.imagens = imagens;
    p.editadoEm = new Date().toISOString();
  });
}

export function excluirPublicacao(usuario: Usuario | null, pubId: string): void {
  const u = exigirUsuario(usuario);
  mutarBase((b) => {
    const p = obterPub(b, pubId);
    if (p.autorId !== u.id) throw new ErroDominio("sem_permissao", tr("voce_so_pode_excluir_suas_proprias"));
    const temRespostas = b.respostas.some((r) => r.publicacaoId === p.id);
    if (temRespostas) {
      p.removidaPeloAutor = true;
      p.texto = "";
      p.imagens = [];
      p.fixada = false;
    } else {
      b.publicacoes = b.publicacoes.filter((x) => x.id !== p.id);
      b.curtidas = b.curtidas.filter((c) => c.publicacaoId !== p.id);
    }
  });
}

export function alternarCurtida(usuario: Usuario | null, pubId: string): boolean {
  const u = exigirUsuario(usuario);
  return mutarBase((b) => {
    const p = obterPub(b, pubId);
    if (!publicacaoVisivel(b, u, p)) throw new ErroDominio("sem_acesso", MSG_SEM_ACESSO());
    if (!podeCurtir(b, u, p)) throw new ErroDominio("sem_permissao", tr("voce_nao_pode_curtir_esta_publicacao"));
    const existente = b.curtidas.find((c) => c.publicacaoId === pubId && c.usuarioId === u.id);
    if (existente) {
      b.curtidas = b.curtidas.filter((c) => c !== existente);
      return false;
    }
    b.curtidas.push({ id: gerarId("cur"), publicacaoId: pubId, usuarioId: u.id });
    if (p.autorId !== u.id) {
      const autor = b.usuarios.find((x) => x.id === p.autorId);
      if (autor && publicacaoVisivel(b, autor, p)) {
        notificar(b, autor.id, "Nova curtida", `${nomeExibicao(u)} curtiu sua publicação.`, `/comunidade/${p.eventoId}/p/${p.id}`);
      }
    }
    return true;
  });
}

// ---------- Respostas ----------
export function responder(usuario: Usuario | null, pubId: string, texto: string, imagem?: ImagemPost): Resposta {
  const u = exigirUsuario(usuario);
  return mutarBase((b) => {
    const p = obterPub(b, pubId);
    if (!publicacaoVisivel(b, u, p)) throw new ErroDominio("sem_acesso", MSG_SEM_ACESSO());
    if (!podeResponder(b, u, p)) throw new ErroDominio("sem_permissao", tr("respostas_indisponiveis_para_esta_public"));
    const t = validarConteudo(texto, imagem ? [imagem] : [], 1);
    const r: Resposta = { id: gerarId("res"), publicacaoId: p.id, autorId: u.id, texto: t, imagem, oculta: false, criadoEm: new Date().toISOString() };
    b.respostas.push(r);
    if (p.autorId !== u.id) {
      const autor = b.usuarios.find((x) => x.id === p.autorId);
      if (autor && publicacaoVisivel(b, autor, p)) {
        // Agrupa: se já há notificação não lida para esta publicação, não duplica.
        const link = `/comunidade/${p.eventoId}/p/${p.id}`;
        const jaTem = b.notificacoes.find((n) => n.usuarioId === autor.id && n.link === link && !n.lida && n.titulo === "Novas respostas");
        if (!jaTem) notificar(b, autor.id, "Novas respostas", `${nomeExibicao(u)} respondeu à sua publicação na comunidade.`, link);
      }
    }
    notificarOrganizacao(b, p.eventoId, u.id, "Nova resposta na comunidade", `${nomeExibicao(u)} respondeu a uma publicação.`, `/comunidade/${p.eventoId}/p/${p.id}`);
    return r;
  });
}

export function editarResposta(usuario: Usuario | null, respostaId: string, texto: string, imagem?: ImagemPost): void {
  const u = exigirUsuario(usuario);
  mutarBase((b) => {
    const r = obterResposta(b, respostaId);
    if (r.autorId !== u.id) throw new ErroDominio("sem_permissao", tr("voce_so_pode_editar_suas_proprias_2"));
    const p = obterPub(b, r.publicacaoId);
    const forum = b.foruns.find((f) => f.id === p.forumId)!;
    if (!podeVerForum(b, u, forum) || forum.status !== "ativo") throw new ErroDominio("sem_permissao", tr("nao_e_possivel_editar_agora"));
    r.texto = validarConteudo(texto, imagem ? [imagem] : [], 1);
    r.imagem = imagem;
    r.editadoEm = new Date().toISOString();
  });
}

export function excluirResposta(usuario: Usuario | null, respostaId: string): void {
  const u = exigirUsuario(usuario);
  mutarBase((b) => {
    const r = obterResposta(b, respostaId);
    if (r.autorId !== u.id) throw new ErroDominio("sem_permissao", tr("voce_so_pode_excluir_suas_proprias_2"));
    b.respostas = b.respostas.filter((x) => x.id !== r.id);
  });
}

// ---------- Denúncias ----------
export function denunciar(
  usuario: Usuario | null,
  dados: { alvo: "publicacao" | "resposta"; alvoId: string; motivo: MotivoDenuncia; descricao?: string },
): void {
  const u = exigirUsuario(usuario);
  mutarBase((b) => {
    const pub = dados.alvo === "publicacao" ? obterPub(b, dados.alvoId) : obterPub(b, obterResposta(b, dados.alvoId).publicacaoId);
    if (!publicacaoVisivel(b, u, pub)) throw new ErroDominio("sem_acesso", MSG_SEM_ACESSO());
    b.denuncias.push({
      id: gerarId("den"),
      eventoId: pub.eventoId,
      alvo: dados.alvo,
      alvoId: dados.alvoId,
      denuncianteId: u.id,
      motivo: dados.motivo,
      descricao: dados.descricao?.trim() || undefined,
      status: "pendente",
      criadoEm: new Date().toISOString(),
    });
    notificarOrganizacao(b, pub.eventoId, u.id, "Nova denúncia na comunidade", `Uma ${dados.alvo === "publicacao" ? "publicação" : "resposta"} foi denunciada e aguarda análise.`, `/comunidade/${pub.eventoId}/gerenciar`);
  });
}

export function listarDenuncias(usuario: Usuario | null, eventoId: string) {
  const base = carregarBase();
  exigirGestao(base, usuario, eventoId);
  return base.denuncias.filter((d) => d.eventoId === eventoId).sort((a, b) => b.criadoEm.localeCompare(a.criadoEm));
}

export function analisarDenuncia(usuario: Usuario | null, denunciaId: string, decisao: "procedente" | "descartada"): void {
  mutarBase((b) => {
    const d = b.denuncias.find((x) => x.id === denunciaId);
    if (!d) throw new ErroDominio("nao_encontrado", tr("denuncia_nao_encontrada"));
    const u = exigirGestao(b, usuario, d.eventoId);
    d.status = decisao;
    registrarModeracao(b, d.eventoId, u.id, `denuncia_${decisao}`, d.id);
  });
}

// ---------- Moderação ----------
export function fixarPublicacao(usuario: Usuario | null, pubId: string): void {
  mutarBase((b) => {
    const p = obterPub(b, pubId);
    const u = exigirGestao(b, usuario, p.eventoId);
    p.fixada = !p.fixada;
    registrarModeracao(b, p.eventoId, u.id, p.fixada ? "fixar" : "desafixar", p.id);
  });
}

export function alternarRespostas(usuario: Usuario | null, pubId: string): void {
  mutarBase((b) => {
    const p = obterPub(b, pubId);
    const u = exigirGestao(b, usuario, p.eventoId);
    p.respostasFechadas = !p.respostasFechadas;
    registrarModeracao(b, p.eventoId, u.id, p.respostasFechadas ? "fechar_respostas" : "reabrir_respostas", p.id);
  });
}

export function ocultarConteudo(usuario: Usuario | null, alvo: "publicacao" | "resposta", alvoId: string, justificativa: string, ocultar = true): void {
  mutarBase((b) => {
    const item = alvo === "publicacao" ? obterPub(b, alvoId) : obterResposta(b, alvoId);
    const eventoId = alvo === "publicacao" ? (item as Publicacao).eventoId : obterPub(b, (item as Resposta).publicacaoId).eventoId;
    const u = exigirGestao(b, usuario, eventoId);
    if (ocultar && !justificativa.trim()) throw new ErroDominio("justificativa", tr("informe_a_justificativa"));
    item.oculta = ocultar;
    item.motivoOcultacao = ocultar ? justificativa.trim() : undefined;
    registrarModeracao(b, eventoId, u.id, ocultar ? `ocultar_${alvo}` : `restaurar_${alvo}`, alvoId, justificativa.trim() || undefined);
    if (item.autorId !== u.id) {
      notificar(
        b,
        item.autorId,
        ocultar ? "Conteúdo ocultado pela moderação" : "Conteúdo restaurado",
        ocultar ? `Um conteúdo seu foi ocultado. Motivo: ${justificativa.trim()}` : "Um conteúdo seu voltou a ficar visível.",
        `/comunidade/${eventoId}`,
      );
    }
  });
}

export function moverPublicacao(usuario: Usuario | null, pubId: string, forumDestinoId: string): void {
  mutarBase((b) => {
    const p = obterPub(b, pubId);
    const u = exigirGestao(b, usuario, p.eventoId);
    const origem = b.foruns.find((f) => f.id === p.forumId)!;
    const destino = b.foruns.find((f) => f.id === forumDestinoId);
    if (!destino || destino.eventoId !== p.eventoId) throw new ErroDominio("destino", tr("forum_de_destino_invalido"));
    if (destino.publico !== origem.publico) {
      throw new ErroDominio("publico_diferente", tr("so_e_possivel_mover_entre_foruns"));
    }
    if (destino.status !== "ativo") throw new ErroDominio("arquivado", tr("o_forum_de_destino_esta_arquivado"));
    p.forumId = destino.id;
    registrarModeracao(b, p.eventoId, u.id, "mover_publicacao", p.id, `${origem.nome} → ${destino.nome}`);
  });
}

export function suspenderUsuario(usuario: Usuario | null, eventoId: string, usuarioId: string, justificativa: string): void {
  mutarBase((b) => {
    const u = exigirGestao(b, usuario, eventoId);
    if (!justificativa.trim()) throw new ErroDominio("justificativa", tr("informe_a_justificativa"));
    if (estaSuspenso(b, usuarioId, eventoId)) return;
    b.restricoesComunidade.push({ id: gerarId("rst"), eventoId, usuarioId, justificativa: justificativa.trim(), ativa: true, criadoEm: new Date().toISOString() });
    registrarModeracao(b, eventoId, u.id, "suspender_usuario", usuarioId, justificativa.trim());
    notificar(b, usuarioId, "Participação na comunidade suspensa", `Você pode ler, mas não publicar, responder ou curtir. Motivo: ${justificativa.trim()}`, `/comunidade/${eventoId}`);
  });
}

export function reativarUsuario(usuario: Usuario | null, eventoId: string, usuarioId: string): void {
  mutarBase((b) => {
    const u = exigirGestao(b, usuario, eventoId);
    b.restricoesComunidade.forEach((r) => {
      if (r.eventoId === eventoId && r.usuarioId === usuarioId) r.ativa = false;
    });
    registrarModeracao(b, eventoId, u.id, "reativar_usuario", usuarioId);
    notificar(b, usuarioId, "Participação na comunidade reativada", "Você já pode voltar a interagir.", `/comunidade/${eventoId}`);
  });
}

// ---------- Gestão de fóruns ----------
export interface DadosForum {
  nome: string;
  descricao: string;
  icone?: string | undefined;
  regras?: string | undefined;
  publico: "todos" | string;
  publicacao: PermissaoForum;
  respostas: PermissaoForum;
}

function validarForum(b: BaseDados, eventoId: string, d: DadosForum) {
  if (!d.nome.trim()) throw new ErroDominio("nome", tr("informe_o_nome_do_forum"));
  if (!d.descricao.trim()) throw new ErroDominio("descricao", tr("informe_uma_descricao"));
  if (d.publico !== "todos" && !eventoDe(b, eventoId)?.exercitos.some((e) => e.id === d.publico)) {
    throw new ErroDominio("publico", tr("publico_invalido"));
  }
}

export function criarForum(usuario: Usuario | null, eventoId: string, d: DadosForum): Forum {
  return mutarBase((b) => {
    const u = exigirGestao(b, usuario, eventoId);
    validarForum(b, eventoId, d);
    const ordem = Math.max(0, ...b.foruns.filter((f) => f.eventoId === eventoId).map((f) => f.ordem)) + 1;
    const forum: Forum = {
      id: gerarId("for"),
      eventoId,
      nome: d.nome.trim(),
      descricao: d.descricao.trim(),
      icone: d.icone?.trim() || undefined,
      regras: d.regras?.trim() || undefined,
      ordem,
      publico: d.publico,
      publicacao: d.publicacao,
      respostas: d.respostas,
      status: "ativo",
      criadoEm: new Date().toISOString(),
    };
    b.foruns.push(forum);
    registrarModeracao(b, eventoId, u.id, "criar_forum", forum.id);
    return forum;
  });
}

export function editarForum(usuario: Usuario | null, forumId: string, d: DadosForum): void {
  mutarBase((b) => {
    const f = b.foruns.find((x) => x.id === forumId);
    if (!f) throw new ErroDominio("nao_encontrado", tr("forum_nao_encontrado"));
    const u = exigirGestao(b, usuario, f.eventoId);
    validarForum(b, f.eventoId, d);
    const temConteudo = b.publicacoes.some((p) => p.forumId === f.id);
    if (temConteudo && d.publico !== f.publico) {
      throw new ErroDominio("publico", tr("nao_e_possivel_mudar_o_publico"));
    }
    Object.assign(f, {
      nome: d.nome.trim(),
      descricao: d.descricao.trim(),
      icone: d.icone?.trim() || undefined,
      regras: d.regras?.trim() || undefined,
      publico: d.publico,
      publicacao: d.publicacao,
      respostas: d.respostas,
    });
    registrarModeracao(b, f.eventoId, u.id, "editar_forum", f.id);
  });
}

export function moverOrdemForum(usuario: Usuario | null, forumId: string, direcao: -1 | 1): void {
  mutarBase((b) => {
    const f = b.foruns.find((x) => x.id === forumId);
    if (!f) return;
    exigirGestao(b, usuario, f.eventoId);
    const lista = b.foruns.filter((x) => x.eventoId === f.eventoId).sort((a, c) => a.ordem - c.ordem);
    const i = lista.indexOf(f);
    const outro = lista[i + direcao];
    if (!outro) return;
    [f.ordem, outro.ordem] = [outro.ordem, f.ordem];
  });
}

export function alternarArquivoForum(usuario: Usuario | null, forumId: string): void {
  mutarBase((b) => {
    const f = b.foruns.find((x) => x.id === forumId);
    if (!f) throw new ErroDominio("nao_encontrado", tr("forum_nao_encontrado"));
    const u = exigirGestao(b, usuario, f.eventoId);
    f.status = f.status === "ativo" ? "arquivado" : "ativo";
    registrarModeracao(b, f.eventoId, u.id, f.status === "arquivado" ? "arquivar_forum" : "reativar_forum", f.id);
  });
}

export function excluirForum(usuario: Usuario | null, forumId: string): void {
  mutarBase((b) => {
    const f = b.foruns.find((x) => x.id === forumId);
    if (!f) throw new ErroDominio("nao_encontrado", tr("forum_nao_encontrado"));
    const u = exigirGestao(b, usuario, f.eventoId);
    if (b.publicacoes.some((p) => p.forumId === f.id)) {
      throw new ErroDominio("com_conteudo", tr("foruns_com_conteudo_devem_ser_arquivados"));
    }
    b.foruns = b.foruns.filter((x) => x.id !== f.id);
    registrarModeracao(b, f.eventoId, u.id, "excluir_forum", f.id);
  });
}

// ---------- Preferências ----------
export function preferenciaForum(usuarioId: string, forumId: string): "seguir" | "silenciar" | "padrao" {
  return carregarBase().preferenciasForum.find((p) => p.usuarioId === usuarioId && p.forumId === forumId)?.modo ?? "padrao";
}

export function definirPreferenciaForum(usuario: Usuario | null, forumId: string, modo: "seguir" | "silenciar" | "padrao"): void {
  const u = exigirUsuario(usuario);
  mutarBase((b) => {
    const f = b.foruns.find((x) => x.id === forumId);
    if (!f || !podeVerForum(b, u, f)) throw new ErroDominio("sem_acesso", MSG_SEM_ACESSO());
    b.preferenciasForum = b.preferenciasForum.filter((p) => !(p.usuarioId === u.id && p.forumId === forumId));
    if (modo !== "padrao") b.preferenciasForum.push({ usuarioId: u.id, forumId, modo });
  });
}

/** Participantes do evento (para suspensão) — sem expor exército. */
export function membrosParaModeracao(usuario: Usuario | null, eventoId: string) {
  const base = carregarBase();
  exigirGestao(base, usuario, eventoId);
  const ids = new Set(base.inscricoes.filter((i) => i.eventoId === eventoId && i.status === "confirmada").map((i) => i.usuarioId));
  return base.usuarios
    .filter((u) => ids.has(u.id))
    .map((u) => ({ id: u.id, nome: u.nomeCompleto, exibicao: nomeExibicao(u), suspenso: estaSuspenso(base, u.id, eventoId) }));
}

export function atualizarNomeExibicao(usuario: Usuario | null, nome: string): void {
  const u = exigirUsuario(usuario);
  const n = nome.trim();
  if (n.length > 40) throw new ErroDominio("nome", tr("use_no_maximo_40_caracteres"));
  mutarBase((b) => {
    const alvo = b.usuarios.find((x) => x.id === u.id);
    if (alvo) alvo.nomeExibicao = n || undefined;
  });
}
