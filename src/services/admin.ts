// Serviços administrativos: análise de solicitações, usuários, privacidade e auditoria.
import { mutarBase, latencia, ErroDominio, gerarId } from "./db";
import { carregarBase } from "./db";
import { silenciado } from "./notificacoes";
import { atualizarDadosConta, type DadosConta } from "./conta";
import { cpfValido, somenteDigitos } from "@/lib/domain/validators";
import type { StatusSolicitacao, Usuario } from "@/lib/domain/types";
import { tr } from "@/i18n/services/admin";

function auditar(autorId: string, acao: string, entidade: string, entidadeId: string, justificativa?: string) {
  return {
    id: gerarId("aud"),
    autorId,
    acao,
    entidade,
    entidadeId,
    justificativa,
    criadoEm: new Date().toISOString(),
  };
}

function notificar(usuarioId: string, titulo: string, corpo: string, link?: string) {
  return {
    id: gerarId("not"),
    usuarioId,
    titulo,
    corpo,
    link,
    lida: false,
    criadoEm: new Date().toISOString(),
  };
}

export async function analisarSolicitacao(
  solicitacaoId: string,
  adminId: string,
  acao: "iniciar" | "aprovar" | "ajustes" | "rejeitar",
  justificativa?: string,
): Promise<void> {
  await latencia();
  if ((acao === "ajustes" || acao === "rejeitar") && !justificativa?.trim()) {
    throw new ErroDominio("justificativa", tr("informe_a_justificativa"));
  }
  mutarBase((base) => {
    const sol = base.solicitacoes.find((s) => s.id === solicitacaoId);
    if (!sol) throw new ErroDominio("solicitacao", tr("solicitacao_nao_encontrada"));
    const mapa = {
      iniciar: "em_analise",
      aprovar: "aprovada",
      ajustes: "ajustes_solicitados",
      rejeitar: "rejeitada",
    } as const satisfies Record<string, StatusSolicitacao>;
    sol.status = mapa[acao];
    sol.observacaoAdmin = justificativa?.trim() || undefined;
    sol.atualizadoEm = new Date().toISOString();

    if (acao === "aprovar") {
      const usuario = base.usuarios.find((u) => u.id === sol.usuarioId);
      if (!usuario) throw new ErroDominio("usuario", tr("usuario_nao_encontrado"));
      const org = {
        id: gerarId("org"),
        nome: sol.nomeOrganizacao,
        cnpj: sol.cnpj,
        instagram: sol.instagram,
        telefone: sol.telefone,
        responsavelId: usuario.id,
        status: "ativa" as const,
        criadoEm: new Date().toISOString(),
      };
      base.organizacoes.push(org);
      usuario.perfil = "organizador";
      usuario.organizacaoId = org.id;
      if (!silenciado(base, usuario.id, "geral")) {
        base.notificacoes.push(
          notificar(usuario.id, "Solicitação aprovada", "Sua organização foi aprovada! A área da organização já está liberada.", "/organizacao"),
        );
      }
    } else {
      const textos: Record<string, string> = {
        iniciar: "Sua solicitação está em análise.",
        ajustes: `Ajustes solicitados: ${justificativa}`,
        rejeitar: `Solicitação rejeitada: ${justificativa}`,
      };
      if (!silenciado(base, sol.usuarioId, "geral")) {
        base.notificacoes.push(
          notificar(sol.usuarioId, "Atualização da solicitação", textos[acao] ?? "", "/app/organizador"),
        );
      }
    }
    base.auditoria.push(auditar(adminId, `solicitacao_${acao}`, "solicitacao", solicitacaoId, justificativa));
  });
}

export async function desativarUsuario(usuarioId: string, adminId: string, justificativa: string): Promise<void> {
  await latencia();
  if (!justificativa.trim()) throw new ErroDominio("justificativa", tr("informe_a_justificativa"));
  mutarBase((base) => {
    const alvo = base.usuarios.find((u) => u.id === usuarioId);
    if (!alvo) throw new ErroDominio("usuario", tr("usuario_nao_encontrado"));
    if (alvo.perfil === "admin") {
      const adminsAtivos = base.usuarios.filter((u) => u.perfil === "admin" && u.ativo);
      if (adminsAtivos.length <= 1) {
        throw new ErroDominio("ultimo_admin", tr("a_aplicacao_nao_pode_ficar_sem"));
      }
    }
    alvo.ativo = false;
    base.auditoria.push(auditar(adminId, "desativar_usuario", "usuario", usuarioId, justificativa));
  });
}

/** O que o admin pode corrigir no cadastro de outra pessoa: os dados da conta e o CPF. */
export interface DadosUsuarioAdmin extends DadosConta {
  cpf: string;
}

/** Nomes (não valores) dos campos alterados: a auditoria não guarda dado pessoal. */
const CAMPOS_AUDITADOS: [string, (u: Usuario) => unknown][] = [
  ["nome", (u) => u.nomeCompleto],
  ["cpf", (u) => u.cpf],
  ["nascimento", (u) => u.dataNascimento],
  ["whatsapp", (u) => u.whatsapp],
  ["endereco", (u) => JSON.stringify(u.endereco)],
  ["instagram", (u) => u.instagram],
  ["squad", (u) => u.squad],
];

/**
 * Edição do cadastro de um usuário pela administração. Mesmas regras de "Meu perfil"
 * (atualizarDadosConta), mais o CPF (válido e único). O e-mail não muda: é o login da conta.
 */
export async function editarDadosUsuario(usuarioId: string, adminId: string, dados: DadosUsuarioAdmin): Promise<void> {
  await latencia();
  const cpf = somenteDigitos(dados.cpf);
  if (!cpfValido(cpf)) throw new ErroDominio("cpf", tr("cpf_invalido"));
  mutarBase((base) => {
    const alvo = base.usuarios.find((u) => u.id === usuarioId);
    if (!alvo) throw new ErroDominio("usuario", tr("usuario_nao_encontrado"));
    if (base.usuarios.some((u) => u.id !== alvo.id && u.cpf === cpf)) {
      throw new ErroDominio("cpf_duplicado", tr("ja_existe_um_cadastro_com_este_cpf"));
    }
    const antes = CAMPOS_AUDITADOS.map(([, ler]) => ler(alvo));
    const { cpf: _cpf, ...conta } = dados;
    atualizarDadosConta(alvo, conta);
    alvo.cpf = cpf;
    const alterados = CAMPOS_AUDITADOS.filter(([, ler], i) => ler(alvo) !== antes[i]).map(([nome]) => nome);
    if (alterados.length === 0) return;
    base.auditoria.push(auditar(adminId, "editar_usuario", "usuario", usuarioId, `Campos alterados: ${alterados.join(", ")}`));
  });
}

export async function aprovarAutorizacaoResponsavel(usuarioId: string, adminId: string): Promise<void> {
  await latencia();
  mutarBase((base) => {
    const alvo = base.usuarios.find((u) => u.id === usuarioId);
    if (!alvo) throw new ErroDominio("usuario", tr("usuario_nao_encontrado"));
    alvo.autorizacaoResponsavel = "aprovada";
    if (!silenciado(base, alvo.id, "geral")) {
      base.notificacoes.push(
        notificar(alvo.id, "Autorização aprovada", "A autorização do responsável foi aprovada. Você já pode se inscrever em eventos.", "/app"),
      );
    }
    base.auditoria.push(auditar(adminId, "aprovar_autorizacao_responsavel", "usuario", usuarioId));
  });
}

export async function responderPrivacidade(
  solicitacaoId: string,
  adminId: string,
  resposta: string,
): Promise<void> {
  await latencia();
  if (!resposta.trim()) throw new ErroDominio("resposta", tr("informe_a_resposta"));
  mutarBase((base) => {
    const sol = base.privacidade.find((s) => s.id === solicitacaoId);
    if (!sol) throw new ErroDominio("privacidade", tr("solicitacao_nao_encontrada"));
    sol.status = "respondida";
    sol.resposta = resposta;
    if (!silenciado(base, sol.usuarioId, "geral")) {
      base.notificacoes.push(
        notificar(sol.usuarioId, "Solicitação de privacidade respondida", resposta, "/app/privacidade"),
      );
    }
    base.auditoria.push(auditar(adminId, "responder_privacidade", "privacidade", solicitacaoId));
  });
}

export function listarAuditoria() {
  return carregarBase().auditoria.slice().sort((a, b) => b.criadoEm.localeCompare(a.criadoEm));
}
