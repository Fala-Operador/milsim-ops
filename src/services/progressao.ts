// Serviço central da progressão: concede/revoga insígnias e emite/revoga vouchers.
// Idempotente: ids determinísticos (`usuario:insignia`, `campanha:usuario:n`) garantem que
// recarregar a página ou repetir a sincronização nunca duplica conquistas ou benefícios.
// Roda sobre a base da unidade de trabalho (servidor).
import { gerarId } from "@/services/db";
import { aleatorioSeguro } from "@/lib/checkin";
import {
  atende, concessaoAtiva, dataDaConquista, participacoesDoUsuario, resumir,
} from "@/lib/participacao";
import { missoesConcluidas } from "@/lib/missoes";
import type { BaseDados, CampanhaRecompensa, ConcessaoInsignia, Voucher } from "@/lib/domain/types";

const MOTIVO_REVOGACAO = "Participação invalidada ou presença revertida.";

function notificar(base: BaseDados, usuarioId: string, titulo: string, corpo: string, link: string) {
  const u = base.usuarios.find((x) => x.id === usuarioId);
  if (u?.silencioNotificacoes?.todas) return;
  base.notificacoes.push({ id: gerarId("not"), usuarioId, titulo, corpo, link, lida: false, criadoEm: new Date().toISOString() });
}

/** Pode a concessão gerar benefício nesta campanha? */
export function concessaoElegivel(c: CampanhaRecompensa, conc: ConcessaoInsignia, agora: Date): boolean {
  if (!c.ativa || c.insigniaId !== conc.insigniaId || !concessaoAtiva(conc)) return false;
  if (agora < new Date(c.inicioEm) || agora > new Date(c.resgatarAte)) return false;
  if (new Date(conc.conquistadaEm) > new Date(c.conquistarAte)) return false;
  // Retroatividade só quando a campanha declara aceitar conquistas anteriores ao início.
  if (!c.aceitaAnteriores && new Date(conc.conquistadaEm) < new Date(c.inicioEm)) return false;
  return true;
}

export function recalcularProgressao(base: BaseDados, agora = new Date()): void {
  const pessoas = new Set<string>();
  for (const i of base.inscricoes) pessoas.add(i.usuarioId);
  for (const c of base.concessoesInsignia) pessoas.add(c.usuarioId);
  for (const e of base.entregas) if (e.status === "concluida") pessoas.add(e.usuarioId);

  // ----- Insígnias -----
  for (const uid of pessoas) {
    const ps = participacoesDoUsuario(base, uid, agora);
    const missoes = missoesConcluidas(base, uid);
    const r = { ...resumir(ps), missoes: missoes.length };
    for (const ins of base.insignias) {
      const id = `${uid}:${ins.id}`;
      const existente = base.concessoesInsignia.find((c) => c.id === id);
      if (existente && concessaoAtiva(existente)) {
        // Mudanças na regra não afetam quem já conquistou: avalia pela regra da concessão.
        if (!atende(existente.criterio, r)) {
          existente.revogadaEm = agora.toISOString();
          existente.motivoRevogacao = MOTIVO_REVOGACAO;
        }
        continue;
      }
      if (!ins.ativa || !atende(ins.criterio, r)) continue;
      const conquistadaEm = (ins.criterio.tipo === "missoes"
        ? missoes[ins.criterio.meta - 1]?.avaliadoEm ?? missoes[ins.criterio.meta - 1]?.enviadoEm
        : dataDaConquista(ins.criterio, ps)) ?? agora.toISOString();
      if (existente) {
        existente.revogadaEm = undefined;
        existente.motivoRevogacao = undefined;
        existente.criterio = { ...ins.criterio };
        existente.versaoRegra = ins.versao;
        existente.conquistadaEm = conquistadaEm;
      } else {
        base.concessoesInsignia.push({
          id, usuarioId: uid, insigniaId: ins.id, versaoRegra: ins.versao, criterio: { ...ins.criterio }, conquistadaEm,
        });
        notificar(base, uid, `Insígnia conquistada: ${ins.nome}`, ins.descricao, `/operador/${uid}`);
      }
    }
  }

  // ----- Vouchers: revogação/ocorrências e expiração -----
  for (const v of base.vouchers) {
    const conc = base.concessoesInsignia.find((c) => c.id === v.concessaoId);
    const valida = !!conc && concessaoAtiva(conc);
    if (!valida && v.status === "disponivel") {
      v.status = "revogada";
      v.motivo = MOTIVO_REVOGACAO;
    } else if (!valida && v.status === "utilizada" && !v.ocorrencia) {
      // Já usado: só registra para análise — nenhuma cobrança ou cancelamento automático.
      v.ocorrencia = `Benefício usado, mas a conquista foi revogada em ${agora.toISOString().slice(0, 10)}.`;
      base.auditoria.push({
        id: gerarId("aud"), autorId: "sistema", acao: "ocorrencia_voucher", entidade: "voucher", entidadeId: v.id,
        justificativa: v.ocorrencia, criadoEm: agora.toISOString(),
      });
    } else if (v.status === "disponivel" && agora > new Date(v.beneficio.resgatarAte)) {
      v.status = "expirada";
    }
  }

  // ----- Vouchers: emissão -----
  for (const c of base.campanhasRecompensa) {
    for (const conc of base.concessoesInsignia) {
      if (!concessaoElegivel(c, conc, agora)) continue;
      const total = base.vouchers.filter((v) => v.campanhaId === c.id).length;
      if (total >= c.maximo) break;
      const meus = base.vouchers.filter((v) => v.campanhaId === c.id && v.usuarioId === conc.usuarioId);
      if (meus.some((v) => v.status === "disponivel" || v.status === "utilizada")) continue;
      if (meus.length >= c.limitePorParticipante) continue;
      const v: Voucher = {
        id: `${c.id}:${conc.usuarioId}:${meus.length + 1}`,
        campanhaId: c.id,
        campanhaVersao: c.versao,
        usuarioId: conc.usuarioId,
        concessaoId: conc.id,
        beneficio: {
          nome: c.nome, organizacaoId: c.organizacaoId, tipo: c.tipo, valor: c.valor,
          eventosElegiveis: [...c.eventosElegiveis], tiposElegiveis: [...c.tiposElegiveis],
          resgatarAte: c.resgatarAte, regras: c.regras,
        },
        codigo: `RW-${aleatorioSeguro(10)}`,
        status: "disponivel",
        concedidoEm: agora.toISOString(),
      };
      base.vouchers.push(v);
      notificar(base, conc.usuarioId, "Nova recompensa disponível", `${c.nome}. Lembre-se: o benefício não reserva vaga.`, `/operador/${conc.usuarioId}?aba=recompensas`);
    }
  }
}

/**
 * Inscrição cancelada (pelo evento ou pela pessoa): devolve o benefício usado, se ainda
 * estiver no prazo; senão marca para substituição. Nunca cria um voucher novo.
 */
export function restaurarVoucherDaInscricao(base: BaseDados, inscricaoId: string, motivo: string, agora = new Date()): void {
  const v = base.vouchers.find((x) => x.inscricaoId === inscricaoId && x.status === "utilizada");
  if (!v) return;
  const noPrazo = agora <= new Date(v.beneficio.resgatarAte);
  if (noPrazo && !v.ocorrencia) {
    v.status = "disponivel";
    v.inscricaoId = undefined;
    v.usadoEm = undefined;
    v.motivo = `Restaurado: ${motivo}`;
  } else {
    v.ocorrencia = `Inscrição cancelada (${motivo}); benefício fora do prazo — avaliar substituição.`;
  }
  base.auditoria.push({
    id: gerarId("aud"), autorId: "sistema", acao: noPrazo ? "voucher_restaurado" : "voucher_substituicao",
    entidade: "voucher", entidadeId: v.id, justificativa: motivo, criadoEm: agora.toISOString(),
  });
}
