import { normalizarCodigoCupom, validarDadosCupom, type DadosCupom } from "@/lib/vendas";
// Serviços do organizador: solicitação, eventos, cupons, cortesias.
import { ehModalidade, erroModalidadeParaPublicar, nomeModalidade } from "@/lib/modalidades";
import { estornarEventoNaBase } from "@/services/inscricoes";
import { ocupaVaga } from "@/lib/pagamentos";
import { contatoParaGravar, errosContatoEvento } from "@/lib/contatoEvento";
import { atividadeNoPeriodo } from "@/lib/fusoHorario";
import { carregarBase, mutarBase, latencia, ErroDominio, gerarId, gerarCodigo } from "./db";
import { silenciado } from "./notificacoes";
import { cnpjValido, normalizarEmail, somenteDigitos, telefoneValido } from "@/lib/domain/validators";
import type { Evento, SolicitacaoOrganizador } from "@/lib/domain/types";
import { tr } from "@/i18n/services/organizador";

export async function solicitarOrganizador(
  usuarioId: string,
  dados: { possuiCnpj: boolean; cnpj?: string | undefined; nomeOrganizacao: string; instagram?: string | undefined; telefone: string },
): Promise<SolicitacaoOrganizador> {
  await latencia();
  if (dados.possuiCnpj && !cnpjValido(dados.cnpj ?? "")) {
    throw new ErroDominio("cnpj", tr("cnpj_invalido"));
  }
  if (!telefoneValido(dados.telefone)) throw new ErroDominio("telefone", tr("telefone_invalido"));
  if (!dados.nomeOrganizacao.trim()) throw new ErroDominio("nome", tr("informe_o_nome_da_organizacao"));

  return mutarBase((base) => {
    const existente = base.solicitacoes.find(
      (s) => s.usuarioId === usuarioId && ["pendente", "em_analise"].includes(s.status),
    );
    if (existente) {
      throw new ErroDominio("duplicada", tr("voce_ja_possui_uma_solicitacao_em"));
    }
    const sol: SolicitacaoOrganizador = {
      id: gerarId("sol"),
      usuarioId,
      possuiCnpj: dados.possuiCnpj,
      cnpj: dados.possuiCnpj ? somenteDigitos(dados.cnpj ?? "") : undefined,
      nomeOrganizacao: dados.nomeOrganizacao.trim(),
      instagram: dados.instagram?.trim() || undefined,
      telefone: somenteDigitos(dados.telefone),
      status: "pendente",
      criadoEm: new Date().toISOString(),
      atualizadoEm: new Date().toISOString(),
    };
    base.solicitacoes.push(sol);
    for (const admin of base.usuarios.filter((u) => u.perfil === "admin" && u.ativo)) {
      if (silenciado(base, admin.id, "geral")) continue;
      base.notificacoes.push({
        id: gerarId("not"),
        usuarioId: admin.id,
        titulo: "Solicitação de organizador",
        corpo: `Nova solicitação aguardando análise: ${sol.nomeOrganizacao}.`,
        link: "/admin/solicitacoes",
        lida: false,
        criadoEm: new Date().toISOString(),
      });
    }
    return sol;
  });
}

export async function reenviarSolicitacao(
  solicitacaoId: string,
  dados: { nomeOrganizacao: string; instagram?: string | undefined; telefone: string },
): Promise<void> {
  await latencia();
  mutarBase((base) => {
    const sol = base.solicitacoes.find((s) => s.id === solicitacaoId);
    if (!sol || sol.status !== "ajustes_solicitados") {
      throw new ErroDominio("status", tr("esta_solicitacao_nao_pode_ser_reenviada"));
    }
    sol.nomeOrganizacao = dados.nomeOrganizacao.trim();
    sol.instagram = dados.instagram?.trim() || undefined;
    sol.telefone = somenteDigitos(dados.telefone);
    sol.status = "pendente";
    sol.atualizadoEm = new Date().toISOString();
  });
}

function assertDono(evento: Evento, usuarioId: string, perfil: string) {
  const base = carregarBase();
  const usuario = base.usuarios.find((u) => u.id === usuarioId);
  if (perfil === "admin") return;
  if (!usuario?.organizacaoId || evento.organizacaoId !== usuario.organizacaoId) {
    throw new ErroDominio("permissao", tr("voce_so_pode_gerenciar_eventos_da"));
  }
}

export async function salvarEvento(
  evento: Evento,
  usuarioId: string,
  perfil: string,
): Promise<Evento> {
  await latencia();
  const erroContato = errosContatoEvento(evento)[0];
  if (erroContato) throw new ErroDominio("contato", erroContato.mensagem);
  evento = contatoParaGravar(evento);
  return mutarBase((base) => {
    const idx = base.eventos.findIndex((e) => e.id === evento.id);
    if (idx >= 0) {
      assertDono(base.eventos[idx]!, usuarioId, perfil);
      // Não permitir redução de capacidade abaixo da ocupação atual
      const ativas = base.inscricoes.filter((i) => i.eventoId === evento.id && ocupaVaga(i));
      if (evento.capacidadeTotal < ativas.length) {
        throw new ErroDominio("capacidade", tr("capacidade_total_abaixo_da_ocupacao_atua"));
      }
      for (const ex of evento.exercitos) {
        const ocup = ativas.filter((i) => i.exercitoId === ex.id).length;
        if (ex.capacidade < ocup) {
          throw new ErroDominio("capacidade_exercito", tr("capacidade_do_nome_abaixo_da_ocupacao", { nome: ex.nome }));
        }
      }
      const nomes = evento.exercitos.map((e) => e.nome.trim().toLowerCase());
      if (new Set(nomes).size !== nomes.length) {
        throw new ErroDominio("exercito_duplicado", tr("ha_exercitos_com_nomes_duplicados"));
      }
      const anterior = base.eventos[idx]!.modalidade;
      if (evento.status === "publicado" && !ehModalidade(evento.modalidade)) {
        throw new ErroDominio("modalidade", tr("eventos_publicados_precisam_de_uma_modal"));
      }
      if (anterior !== evento.modalidade) {
        base.auditoria.push({
          id: gerarId("aud"), autorId: usuarioId, acao: "alterar_modalidade_evento", entidade: "evento", entidadeId: evento.id,
          justificativa: `${nomeModalidade(anterior)} → ${nomeModalidade(evento.modalidade)}`, criadoEm: new Date().toISOString(),
        });
      }
      base.eventos[idx] = evento;
    } else {
      base.eventos.push(evento);
    }
    return evento;
  });
}

export function validarParaPublicacao(evento: Evento): string[] {
  const erros: string[] = [];
  if (!evento.nome.trim()) erros.push(tr("nome_obrigatorio"));
  const erroMod = erroModalidadeParaPublicar(evento);
  if (erroMod) erros.push(erroMod);
  if (!evento.descricaoResumida.trim()) erros.push(tr("descricao_resumida_obrigatoria"));
  if (!evento.enredo.trim()) erros.push(tr("enredo_obrigatorio"));
  if (!evento.local.trim()) erros.push(tr("local_obrigatorio"));
  if (!evento.imagemUrl) erros.push(tr("adicione_a_imagem_principal_do_evento"));
  if (evento.exercitos.length === 0) erros.push(tr("cadastre_ao_menos_um_exercito"));
  if (evento.tipos.length === 0) erros.push(tr("cadastre_ao_menos_um_tipo_de"));
  if (evento.cronograma.length === 0) erros.push(tr("o_cronograma_precisa_de_ao_menos"));
  // Data e horário da atividade valem no fuso do evento (o servidor roda em UTC).
  for (const at of evento.cronograma) {
    if (!atividadeNoPeriodo(evento, at)) erros.push(tr("atividade_titulo_fora_do_periodo_do", { titulo: at.titulo }));
  }
  const fim = new Date(evento.fimEm).getTime();
  for (const l of evento.lotes) {
    if (l.status !== "arquivado" && new Date(l.fimVendas).getTime() > fim) erros.push(tr("lote_nome_as_vendas_devem_terminar", { nome: l.nome }));
  }
  return erros;
}

export async function publicarEvento(eventoId: string, usuarioId: string, perfil: string): Promise<void> {
  await latencia();
  mutarBase((base) => {
    const evento = base.eventos.find((e) => e.id === eventoId);
    if (!evento) throw new ErroDominio("evento", tr("evento_nao_encontrado"));
    assertDono(evento, usuarioId, perfil);
    const erros = validarParaPublicacao(evento);
    if (new Date(evento.inicioEm).getTime() <= Date.now()) erros.unshift(tr("o_inicio_da_operacao_ja_passou"));
    // Uma mensagem por linha: o editor separa e mostra cada uma na etapa certa.
    if (erros.length) throw new ErroDominio("validacao", erros.join("\n"));
    evento.status = "publicado";
  });
}

export async function cancelarEvento(
  eventoId: string,
  justificativa: string,
  usuarioId: string,
  perfil: string,
): Promise<{ canceladas: number; sessoesAExpirar: string[] }> {
  await latencia();
  if (!justificativa.trim()) throw new ErroDominio("justificativa", tr("informe_a_justificativa"));
  return mutarBase((base) => {
    const evento = base.eventos.find((e) => e.id === eventoId);
    if (!evento) throw new ErroDominio("evento", tr("evento_nao_encontrado"));
    assertDono(evento, usuarioId, perfil);
    evento.status = "cancelado";
    let canceladas = 0;
    const sessoesAExpirar = estornarEventoNaBase(base, eventoId, `Evento cancelado: ${justificativa}`, (ins) => {
      canceladas += 1;
      if (silenciado(base, ins.usuarioId, "geral")) return;
      base.notificacoes.push({
        id: gerarId("not"),
        usuarioId: ins.usuarioId,
        titulo: "Evento cancelado",
        corpo: ins.pagamento
          ? `${evento.nome} foi cancelado. O reembolso integral foi solicitado ao meio de pagamento.`
          : `${evento.nome} foi cancelado. O estorno integral foi registrado.`,
        link: "/app/ingressos",
        lida: false,
        criadoEm: new Date().toISOString(),
      });
    });
    base.auditoria.push({
      id: gerarId("aud"),
      autorId: usuarioId,
      acao: "cancelamento_evento",
      entidade: "evento",
      entidadeId: eventoId,
      justificativa,
      criadoEm: new Date().toISOString(),
    });
    return { canceladas, sessoesAExpirar };
  });
}

export async function criarCupom(dados: DadosCupom & { eventoId: string }): Promise<void> {
  await latencia();
  mutarBase((base) => {
    const evento = base.eventos.find((e) => e.id === dados.eventoId);
    if (!evento) throw new ErroDominio("evento", tr("evento_nao_encontrado"));
    const erros = validarDadosCupom(dados, {
      codigosExistentes: base.cupons.filter((c) => c.eventoId === dados.eventoId).map((c) => c.codigo),
      tiposDoEvento: evento.tipos.filter((t) => !t.arquivado).map((t) => t.id),
    });
    const primeiro = Object.values(erros)[0];
    if (primeiro) throw new ErroDominio("cupom_dados", primeiro);
    base.cupons.push({ ...dados, id: gerarId("cup"), codigo: normalizarCodigoCupom(dados.codigo), usos: 0 });
  });
}

/**
 * Edita um cupom sem tocar nas inscrições já feitas (o desconto aplicado fica
 * gravado em cada inscrição). O código não muda, para preservar o histórico.
 */
export async function atualizarCupom(cupomId: string, dados: Omit<DadosCupom, "codigo">): Promise<void> {
  await latencia();
  mutarBase((base) => {
    const cupom = base.cupons.find((c) => c.id === cupomId);
    if (!cupom) throw new ErroDominio("cupom", tr("cupom_nao_encontrado"));
    const evento = base.eventos.find((e) => e.id === cupom.eventoId)!;
    const erros = validarDadosCupom({ ...dados, codigo: cupom.codigo }, {
      codigosExistentes: [],
      tiposDoEvento: evento.tipos.map((t) => t.id),
    });
    if (dados.limiteUsos !== null && dados.limiteUsos < cupom.usos) {
      erros.limiteUsos = tr("o_limite_nao_pode_ser_menor", { usos: cupom.usos });
    }
    const primeiro = Object.values(erros)[0];
    if (primeiro) throw new ErroDominio("cupom_dados", primeiro);
    Object.assign(cupom, dados);
  });
}

export async function criarCortesia(
  dados: { eventoId: string; nomeConvidado: string; emailConvidado: string; tipoId: string; exercitoId?: string | undefined; validade: string },
): Promise<string> {
  await latencia();
  const codigo = gerarCodigo("CORT");
  mutarBase((base) => {
    base.cortesias.push({
      id: gerarId("cor"),
      ...dados,
      emailConvidado: normalizarEmail(dados.emailConvidado),
      codigo,
      status: "pendente",
      criadoEm: new Date().toISOString(),
    });
  });
  return codigo;
}

/** Exclui um evento. Só é permitido quando não há inscrições confirmadas (caso contrário, cancele). */
export async function excluirEvento(eventoId: string, usuarioId: string, perfil: string): Promise<void> {
  await latencia();
  mutarBase((base) => {
    const evento = base.eventos.find((e) => e.id === eventoId);
    if (!evento) throw new ErroDominio("evento", tr("evento_nao_encontrado"));
    assertDono(evento, usuarioId, perfil);
    const ativas = base.inscricoes.filter((i) => i.eventoId === eventoId && (i.status === "confirmada" || i.status === "pendente"));
    if (ativas.length > 0) {
      throw new ErroDominio("inscricoes_ativas", tr("ha_inscricoes_confirmadas_ou_aguardando"));
    }
    base.eventos = base.eventos.filter((e) => e.id !== eventoId);
    base.cupons = base.cupons.filter((c) => c.eventoId !== eventoId);
    base.cortesias = base.cortesias.filter((c) => c.eventoId !== eventoId);
    base.auditoria.push({
      id: gerarId("aud"),
      autorId: usuarioId,
      acao: "exclusao_evento",
      entidade: "evento",
      entidadeId: eventoId,
      justificativa: `Evento "${evento.nome}" excluído.`,
      criadoEm: new Date().toISOString(),
    });
  });
}
