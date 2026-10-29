// Impulsionamento de operações: só a administração cria, ativa, pausa, retoma e encerra.
// Campanhas não são apagadas, para preservar o histórico.
import { mutarBase, ErroDominio, gerarId } from "./db";
import type { BaseDados, Impulsionamento, Usuario } from "@/lib/domain/types";
import { pendenciasAtivacao, statusExibido } from "@/lib/impulsionamento";
import { tr } from "@/i18n/services/impulsionamentos";

function exigirAdmin(u: Usuario | null) {
  if (!u || u.perfil !== "admin") throw new ErroDominio("permissao", tr("somente_a_administracao_gerencia_impulsi"));
}

function auditar(b: BaseDados, autorId: string, acao: string, id: string, detalhe?: string) {
  b.auditoria.push({ id: gerarId("aud"), autorId, acao, entidade: "impulsionamento", entidadeId: id, justificativa: detalhe, criadoEm: new Date().toISOString() });
}

export type DadosImpulsionamento = Omit<Impulsionamento, "id" | "status" | "criadoPor" | "criadoEm" | "atualizadoEm"> & {
  id?: string;
  /** true = ativar/agendar; false = salvar como rascunho. */
  ativar: boolean;
};

function validarBasico(d: DadosImpulsionamento) {
  if (!d.nome.trim()) throw new ErroDominio("nome", tr("informe_o_nome_interno_da_campanha"));
  if ((d.chamada ?? "").length > 120) throw new ErroDominio("chamada", tr("a_chamada_tem_no_maximo_120"));
}

export function salvarImpulsionamento(admin: Usuario | null, d: DadosImpulsionamento): Impulsionamento {
  exigirAdmin(admin);
  validarBasico(d);
  return mutarBase((b) => {
    const agora = new Date();
    if (d.ativar) {
      const erros = pendenciasAtivacao(b, d, agora);
      if (erros.length) throw new ErroDominio("elegibilidade", erros.join(" "));
    }
    const { ativar, id: _id, ...campos } = d;
    const existente = d.id ? b.impulsionamentos.find((x) => x.id === d.id) : undefined;
    const iso = agora.toISOString();
    if (existente) {
      if (existente.status === "encerrado") throw new ErroDominio("status", tr("campanha_encerrada_nao_pode_ser_editada"));
      Object.assign(existente, { ...campos, nome: campos.nome.trim(), status: ativar ? "ativo" : existente.status, atualizadoEm: iso });
      auditar(b, admin!.id, "impulsionamento_editado", existente.id, existente.nome);
      return existente;
    }
    const novo: Impulsionamento = {
      ...campos, nome: campos.nome.trim(), id: gerarId("imp"), status: ativar ? "ativo" : "rascunho",
      criadoPor: admin!.id, criadoEm: iso, atualizadoEm: iso,
    };
    b.impulsionamentos.push(novo);
    auditar(b, admin!.id, ativar ? "impulsionamento_ativado" : "impulsionamento_criado", novo.id, novo.nome);
    return novo;
  });
}

export type AcaoImpulsionamento = "pausar" | "retomar" | "encerrar";

export function alterarImpulsionamento(admin: Usuario | null, id: string, acao: AcaoImpulsionamento): void {
  exigirAdmin(admin);
  mutarBase((b) => {
    const c = b.impulsionamentos.find((x) => x.id === id);
    if (!c) throw new ErroDominio("impulsionamento", tr("campanha_nao_encontrada"));
    if (c.status === "encerrado") throw new ErroDominio("status", tr("campanha_ja_encerrada"));
    const agora = new Date();
    if (acao === "retomar") {
      // Retomar exige nova validação de elegibilidade.
      const erros = pendenciasAtivacao(b, c, agora);
      if (erros.length) throw new ErroDominio("elegibilidade", erros.join(" "));
      c.status = "ativo";
    } else if (acao === "pausar") {
      if (statusExibido(b, c, agora) === "rascunho") throw new ErroDominio("status", tr("rascunhos_nao_podem_ser_pausados"));
      c.status = "pausado";
    } else {
      c.status = "encerrado";
    }
    c.atualizadoEm = agora.toISOString();
    auditar(b, admin!.id, `impulsionamento_${acao}`, id, c.nome);
  });
}
