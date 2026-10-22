// Visão da base enviada ao navegador: o servidor recorta a BaseDados completa
// conforme quem está logado. É a fronteira de autorização das LEITURAS — o
// navegador nunca recebe dados que a pessoa não poderia ver.
// Regras puras (sem rede): testadas em src/test/visao.test.ts.
import { vistaDoChamado } from "@/lib/suporte";
import { baseVazia } from "@/lib/persistencia";
import { pagamentoAnonimo, pagamentoSemIds } from "@/lib/pagamentos";
import { organizacaoVisivel } from "@/lib/repasses";
import { podeVerGrupo } from "@/lib/contatoEvento";
import { destinadaA, exercitoDaPessoa } from "@/lib/missoes";
import { gereImpulsos } from "@/lib/impulsos";
import {
  forunsVisiveis,
  nomeExibicao,
  papelNoEvento,
  publicacaoVisivel,
} from "@/services/comunidade";
import type { BaseDados, Evento, Inscricao, Usuario } from "@/lib/domain/types";

/** O que a API devolve ao navegador: a base recortada e quem está logado. */
export interface Visao {
  base: BaseDados;
  usuarioId: string | null;
}

/** Status de evento visíveis para qualquer visitante. */
const STATUS_PUBLICOS = new Set<Evento["status"]>([
  "publicado",
  "inscricoes_encerradas",
  "concluido",
  "cancelado",
]);

/** Perfil público: só o necessário para exibir autor e selo na comunidade. */
export function perfilPublico(u: Usuario): Usuario {
  return {
    id: u.id,
    perfil: u.perfil,
    nomeCompleto: nomeExibicao(u),
    nomeExibicao: u.nomeExibicao,
    fotoUrl: u.fotoUrl,
    organizacaoId: u.organizacaoId,
    ativo: u.ativo,
    cpf: "",
    dataNascimento: "",
    email: "",
    whatsapp: "",
    endereco: { cep: "", logradouro: "", numero: "", bairro: "", cidade: "", uf: "" },
    autorizacaoPromocional: false,
    aceiteTermosVersao: "",
    aceiteTermosEm: "",
    criadoEm: "",
  };
}

/** Inscrição de terceiros: mantém só o que as contagens de vagas e ocupação precisam. */
/** Titular e organização veem a situação do pagamento; os ids do Stripe só a administração. */
function comPagamentoVisivel(i: Inscricao, admin: boolean, gestor: boolean): Inscricao {
  return admin || !i.pagamento ? i : { ...i, pagamento: pagamentoSemIds(i.pagamento, gestor) };
}

function inscricaoAnonima(i: Inscricao): Inscricao {
  return {
    id: i.id,
    eventoId: i.eventoId,
    usuarioId: "",
    tipoId: i.tipoId,
    loteId: i.loteId,
    exercitoId: i.exercitoId,
    codigo: "",
    status: i.status,
    // Só o necessário para contar a vaga reservada (situação e prazo); nada do Stripe.
    pagamento: pagamentoAnonimo(i.pagamento),
    origem: i.origem,
    valorCentavos: 0,
    descontoCentavos: 0,
    criadoEm: i.criadoEm,
  };
}

export function gereEvento(usuario: Usuario | null, evento: Evento): boolean {
  if (!usuario?.ativo) return false;
  return (
    usuario.perfil === "admin" ||
    (usuario.perfil === "organizador" && usuario.organizacaoId === evento.organizacaoId)
  );
}

export function visaoParaUsuario(base: BaseDados, usuario: Usuario | null): BaseDados {
  const v = baseVazia();
  const eu = usuario?.ativo ? usuario : null;
  const admin = eu?.perfil === "admin";
  const meuId = eu?.id ?? "\u0000";

  const geridos = new Set(base.eventos.filter((e) => gereEvento(eu, e)).map((e) => e.id));
  const participo = new Set(
    base.inscricoes.filter((i) => i.usuarioId === meuId).map((i) => i.eventoId),
  );
  const comPapel = new Set(
    base.eventos.filter((e) => papelNoEvento(base, eu, e.id)).map((e) => e.id),
  );

  // ----- Eventos e vendas -----
  v.eventos = base.eventos
    .filter((e) => STATUS_PUBLICOS.has(e.status) || geridos.has(e.id) || participo.has(e.id))
    // Link do grupo do WhatsApp: só inscritos confirmados e quem gere o evento.
    .map((e) => (e.whatsappGrupoUrl && !podeVerGrupo(base, eu, e.id, geridos.has(e.id)) ? { ...e, whatsappGrupoUrl: undefined } : e));
  const visiveis = new Set(v.eventos.map((e) => e.id));
  // Conta de recebimento (Stripe Connect) só para quem gere a organização.
  v.organizacoes = base.organizacoes.map((o) => organizacaoVisivel(o, eu));
  v.inscricoes = base.inscricoes
    .filter((i) => visiveis.has(i.eventoId))
    .map((i) =>
      i.usuarioId === meuId || geridos.has(i.eventoId)
        ? comPagamentoVisivel(i, admin, geridos.has(i.eventoId))
        : inscricaoAnonima(i),
    );
  v.cupons = base.cupons.filter((c) => geridos.has(c.eventoId));
  v.cortesias = base.cortesias.filter(
    (c) => geridos.has(c.eventoId) || (!!eu && c.emailConvidado === eu.email),
  );
  v.movimentacoes = base.movimentacoes.filter((m) => geridos.has(m.eventoId));
  v.checkins = base.checkins.filter((c) => geridos.has(c.eventoId));

  // ----- Engajamento -----
  const doEvento = (eventoId: string) => geridos.has(eventoId) || participo.has(eventoId);
  // Missões: a gestão vê todas; o participante, só as publicadas para o exército dele — e nunca
  // a resposta do código secreto.
  v.missoes = base.missoes.flatMap((m) => {
    if (geridos.has(m.eventoId)) return [m];
    if (!participo.has(m.eventoId) || m.rascunho || !destinadaA(m, exercitoDaPessoa(base, meuId, m.eventoId))) return [];
    const { codigoResposta: _segredo, ...publica } = m;
    return [publica];
  });
  v.campanhasMissoes = base.campanhasMissoes.filter((c) => doEvento(c.eventoId));
  const missoesGeridas = new Set(
    base.missoes.filter((m) => geridos.has(m.eventoId)).map((m) => m.id),
  );
  v.entregas = base.entregas.filter((e) => e.usuarioId === meuId || missoesGeridas.has(e.missaoId));
  v.comunicados = base.comunicados.filter((c) => doEvento(c.eventoId));
  const comunicados = new Set(v.comunicados.map((c) => c.id));
  v.comentarios = base.comentarios.filter((c) => comunicados.has(c.comunicadoId));

  // ----- Contas, suporte e governança -----
  v.solicitacoes = base.solicitacoes.filter((s) => admin || s.usuarioId === meuId);
  // Participante só recebe a conversa pública; organização só os encaminhamentos dela.
  v.chamados = base.chamados.flatMap((c) => {
    const x = vistaDoChamado(base, eu, c);
    return x ? [x] : [];
  });
  v.notificacoes = base.notificacoes.filter((n) => admin || n.usuarioId === meuId);
  v.privacidade = base.privacidade.filter((p) => admin || p.usuarioId === meuId);
  v.auditoria = admin ? base.auditoria : [];

  // ----- Comunidade (mesmas regras usadas nas escritas) -----
  for (const eventoId of comPapel) v.foruns.push(...forunsVisiveis(base, eu, eventoId));
  v.publicacoes = base.publicacoes.filter(
    (p) => comPapel.has(p.eventoId) && publicacaoVisivel(base, eu, p),
  );
  const pubs = new Set(v.publicacoes.map((p) => p.id));
  const gestaoDe = (eventoId: string) => papelNoEvento(base, eu, eventoId) === "gestao";
  const eventoDaPub = new Map(v.publicacoes.map((p) => [p.id, p.eventoId]));
  v.respostas = base.respostas.filter(
    (r) => pubs.has(r.publicacaoId) && (!r.oculta || gestaoDe(eventoDaPub.get(r.publicacaoId)!)),
  );
  v.curtidas = base.curtidas.filter((c) => pubs.has(c.publicacaoId));
  v.denuncias = base.denuncias.filter((d) => gestaoDe(d.eventoId) || d.denuncianteId === meuId);
  v.preferenciasForum = base.preferenciasForum.filter((p) => p.usuarioId === meuId);
  v.restricoesComunidade = base.restricoesComunidade.filter(
    (r) => gestaoDe(r.eventoId) || r.usuarioId === meuId,
  );
  v.moderacao = base.moderacao.filter((m) => gestaoDe(m.eventoId));
  for (const [chave, em] of Object.entries(base.visitasComunidade)) {
    if (chave.startsWith(`${meuId}:`)) v.visitasComunidade[chave] = em;
  }

  // ----- Configurações da plataforma (taxa do repasse): administração e organizadores -----
  v.configuracoes = admin || eu?.perfil === "organizador" ? base.configuracoes : [];

  // ----- Divulgação -----
  v.parceiros = admin ? base.parceiros : base.parceiros.filter((p) => p.ativo);
  v.secoesInicio = admin
    ? base.secoesInicio
    : base.secoesInicio.filter((s) => s.status === "publicada");
  // Impulsionamentos: admin vê tudo; organizador vê as campanhas dos próprios eventos;
  // o público recebe só campanhas ativas, sem nome interno nem autor.
  v.impulsionamentos = base.impulsionamentos.flatMap((c) => {
    if (admin || geridos.has(c.eventoId)) return [c];
    if (c.status !== "ativo") return [];
    return [{ ...c, nome: "", criadoPor: "", impulsoId: undefined }];
  });
  // Impulsos: preços públicos; compras só para a organização (sem ids do Stripe) e a administração.
  v.planosImpulso = admin
    ? base.planosImpulso
    : base.planosImpulso.map((p) => ({ ...p, stripeProdutoId: undefined, stripePrecoId: undefined, sincronizadoEm: undefined }));
  v.impulsosComprados = base.impulsosComprados.flatMap((i) => {
    if (admin) return [i];
    if (!gereImpulsos(eu, i.organizacaoId)) return [];
    return [{ ...i, sessaoId: undefined, intencaoId: undefined }];
  });

  // ----- Perfil do operador e gamificação -----
  // Perfil social, equipamentos e galeria: só o dono (nem a administração recebe pela interface).
  // Terceiros veem o perfil apenas pelo DTO filtrado de src/lib/perfilSocial.ts.
  v.perfisOperador = base.perfisOperador.filter((p) => p.usuarioId === meuId);
  v.equipamentos = base.equipamentos.filter((e) => e.usuarioId === meuId);
  v.fotosPerfil = base.fotosPerfil.filter((f) => f.usuarioId === meuId);
  v.operacoesExternas = base.operacoesExternas.filter((o) => o.usuarioId === meuId);
  v.insignias = base.insignias;
  v.concessoesInsignia = base.concessoesInsignia.filter((c) => admin || c.usuarioId === meuId);
  const orgCampanha = (organizacaoId: string) =>
    eu?.perfil === "organizador" && eu.organizacaoId === organizacaoId;
  v.campanhasRecompensa = base.campanhasRecompensa.filter(
    (c) => admin || orgCampanha(c.organizacaoId) || c.ativa,
  );
  v.vouchers = base.vouchers.flatMap((x) => {
    if (admin || x.usuarioId === meuId) return [x];
    // Organização vê só o andamento das próprias campanhas, sem código nem pessoa.
    if (orgCampanha(x.beneficio.organizacaoId))
      return [{ ...x, codigo: "", usuarioId: "", concessaoId: "" }];
    return [];
  });
  v.correcoesParticipacao = admin ? base.correcoesParticipacao : [];

  // ----- Usuários: completo para si, admin e gestão dos inscritos; público para autores -----
  const completos = new Set<string>([meuId]);
  for (const i of base.inscricoes) if (geridos.has(i.eventoId)) completos.add(i.usuarioId);
  for (const s of v.solicitacoes) completos.add(s.usuarioId);
  const referenciados = new Set<string>();
  for (const p of v.publicacoes) referenciados.add(p.autorId);
  for (const r of v.respostas) referenciados.add(r.autorId);
  for (const c of v.comunicados) referenciados.add(c.autorId);
  for (const c of v.comentarios) referenciados.add(c.autorId);
  for (const r of v.restricoesComunidade) referenciados.add(r.usuarioId);
  for (const c of v.chamados) for (const m of c.mensagens) referenciados.add(m.autorId);
  v.usuarios = base.usuarios.flatMap((u) => {
    if (admin || completos.has(u.id)) return [u];
    if (referenciados.has(u.id)) return [perfilPublico(u)];
    return [];
  });

  return v;
}
