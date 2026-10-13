import { normalizarCodigoCupom, validarDadosCupom, type DadosCupom } from "@/lib/vendas";
// Serviços do organizador: solicitação, eventos, cupons, cortesias.
import { ehModalidade, erroModalidadeParaPublicar, nomeModalidade } from "@/lib/modalidades";
import { restaurarVoucherDaInscricao } from "@/services/progressao";
import { carregarBase, mutarBase, latencia, ErroDominio, gerarId, gerarCodigo } from "./db";
import { silenciado } from "./notificacoes";
import { cnpjValido, normalizarEmail, somenteDigitos, telefoneValido } from "@/lib/domain/validators";
import type { Evento, SolicitacaoOrganizador } from "@/lib/domain/types";

export async function solicitarOrganizador(
  usuarioId: string,
  dados: { possuiCnpj: boolean; cnpj?: string | undefined; nomeOrganizacao: string; instagram?: string | undefined; telefone: string },
): Promise<SolicitacaoOrganizador> {
  await latencia();
  if (dados.possuiCnpj && !cnpjValido(dados.cnpj ?? "")) {
    throw new ErroDominio("cnpj", "CNPJ inválido.");
  }
  if (!telefoneValido(dados.telefone)) throw new ErroDominio("telefone", "Telefone inválido.");
  if (!dados.nomeOrganizacao.trim()) throw new ErroDominio("nome", "Informe o nome da organização.");

  return mutarBase((base) => {
    const existente = base.solicitacoes.find(
      (s) => s.usuarioId === usuarioId && ["pendente", "em_analise"].includes(s.status),
    );
    if (existente) {
      throw new ErroDominio("duplicada", "Você já possui uma solicitação em andamento.");
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
      throw new ErroDominio("status", "Esta solicitação não pode ser reenviada.");
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
    throw new ErroDominio("permissao", "Você só pode gerenciar eventos da sua organização.");
  }
}

export async function salvarEvento(
  evento: Evento,
  usuarioId: string,
  perfil: string,
): Promise<Evento> {
  await latencia();
  return mutarBase((base) => {
    const idx = base.eventos.findIndex((e) => e.id === evento.id);
    if (idx >= 0) {
      assertDono(base.eventos[idx]!, usuarioId, perfil);
      // Não permitir redução de capacidade abaixo da ocupação atual
      const ativas = base.inscricoes.filter(
        (i) => i.eventoId === evento.id && i.status === "confirmada",
      );
      if (evento.capacidadeTotal < ativas.length) {
        throw new ErroDominio("capacidade", "Capacidade total abaixo da ocupação atual.");
      }
      for (const ex of evento.exercitos) {
        const ocup = ativas.filter((i) => i.exercitoId === ex.id).length;
        if (ex.capacidade < ocup) {
          throw new ErroDominio("capacidade_exercito", `Capacidade do ${ex.nome} abaixo da ocupação atual.`);
        }
      }
      const nomes = evento.exercitos.map((e) => e.nome.trim().toLowerCase());
      if (new Set(nomes).size !== nomes.length) {
        throw new ErroDominio("exercito_duplicado", "Há exércitos com nomes duplicados.");
      }
      const anterior = base.eventos[idx]!.modalidade;
      if (evento.status === "publicado" && !ehModalidade(evento.modalidade)) {
        throw new ErroDominio("modalidade", "Eventos publicados precisam de uma modalidade principal.");
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
  if (!evento.nome.trim()) erros.push("Nome obrigatório.");
  const erroMod = erroModalidadeParaPublicar(evento);
  if (erroMod) erros.push(erroMod);
  if (!evento.descricaoResumida.trim()) erros.push("Descrição resumida obrigatória.");
  if (!evento.enredo.trim()) erros.push("Enredo obrigatório.");
  if (!evento.local.trim()) erros.push("Local obrigatório.");
  if (!evento.imagemUrl) erros.push("Adicione a imagem principal do evento.");
  if (evento.exercitos.length === 0) erros.push("Cadastre ao menos um exército.");
  if (evento.tipos.length === 0) erros.push("Cadastre ao menos um tipo de ingresso.");
  if (evento.cronograma.length === 0) erros.push("O cronograma precisa de ao menos uma atividade.");
  const inicio = new Date(evento.inicioEm);
  const fim = new Date(evento.fimEm);
  for (const at of evento.cronograma) {
    const dataAt = new Date(`${at.data}T${at.horario}:00`);
    if (dataAt < inicio || dataAt > fim) {
      erros.push(`Atividade "${at.titulo}" fora do período do evento.`);
    }
  }
  return erros;
}

export async function publicarEvento(eventoId: string, usuarioId: string, perfil: string): Promise<void> {
  await latencia();
  mutarBase((base) => {
    const evento = base.eventos.find((e) => e.id === eventoId);
    if (!evento) throw new ErroDominio("evento", "Evento não encontrado.");
    assertDono(evento, usuarioId, perfil);
    const erros = validarParaPublicacao(evento);
    if (erros.length) throw new ErroDominio("validacao", erros.join(" "));
    evento.status = "publicado";
  });
}

export async function cancelarEvento(
  eventoId: string,
  justificativa: string,
  usuarioId: string,
  perfil: string,
): Promise<{ canceladas: number }> {
  await latencia();
  if (!justificativa.trim()) throw new ErroDominio("justificativa", "Informe a justificativa.");
  return mutarBase((base) => {
    const evento = base.eventos.find((e) => e.id === eventoId);
    if (!evento) throw new ErroDominio("evento", "Evento não encontrado.");
    assertDono(evento, usuarioId, perfil);
    evento.status = "cancelado";
    const ativas = base.inscricoes.filter(
      (i) => i.eventoId === eventoId && i.status === "confirmada",
    );
    for (const ins of ativas) {
      ins.status = "estornada";
      ins.canceladoEm = new Date().toISOString();
      ins.motivoCancelamento = `Evento cancelado: ${justificativa}`;
      restaurarVoucherDaInscricao(base, ins.id, "evento cancelado pelo organizador");
      const valorFinal = ins.valorCentavos - ins.descontoCentavos;
      if (valorFinal > 0) {
        base.movimentacoes.push({
          id: gerarId("mov"),
          eventoId,
          inscricaoId: ins.id,
          tipo: "estorno",
          valorCentavos: -valorFinal,
          descricao: "Estorno integral — evento cancelado",
          criadoEm: new Date().toISOString(),
        });
      }
      if (silenciado(base, ins.usuarioId, "geral")) continue;
      base.notificacoes.push({
        id: gerarId("not"),
        usuarioId: ins.usuarioId,
        titulo: "Evento cancelado",
        corpo: `${evento.nome} foi cancelado. O estorno integral foi registrado.`,
        link: "/app/ingressos",
        lida: false,
        criadoEm: new Date().toISOString(),
      });
    }
    base.auditoria.push({
      id: gerarId("aud"),
      autorId: usuarioId,
      acao: "cancelamento_evento",
      entidade: "evento",
      entidadeId: eventoId,
      justificativa,
      criadoEm: new Date().toISOString(),
    });
    return { canceladas: ativas.length };
  });
}

export async function criarCupom(dados: DadosCupom & { eventoId: string }): Promise<void> {
  await latencia();
  mutarBase((base) => {
    const evento = base.eventos.find((e) => e.id === dados.eventoId);
    if (!evento) throw new ErroDominio("evento", "Evento não encontrado.");
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
    if (!cupom) throw new ErroDominio("cupom", "Cupom não encontrado.");
    const evento = base.eventos.find((e) => e.id === cupom.eventoId)!;
    const erros = validarDadosCupom({ ...dados, codigo: cupom.codigo }, {
      codigosExistentes: [],
      tiposDoEvento: evento.tipos.map((t) => t.id),
    });
    if (dados.limiteUsos !== null && dados.limiteUsos < cupom.usos) {
      erros.limiteUsos = `O limite não pode ser menor que as ${cupom.usos} utilizações já feitas.`;
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
    if (!evento) throw new ErroDominio("evento", "Evento não encontrado.");
    assertDono(evento, usuarioId, perfil);
    const ativas = base.inscricoes.filter((i) => i.eventoId === eventoId && i.status === "confirmada");
    if (ativas.length > 0) {
      throw new ErroDominio("inscricoes_ativas", "Há inscrições confirmadas. Cancele o evento em vez de excluí-lo.");
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
