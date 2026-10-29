// Situação da entrada do próprio ingresso, consultada pelo participante enquanto o QR Code
// está aberto. Consulta leve (duas leituras pontuais), sem carregar a base inteira: a tela
// repete a pergunta a cada poucos segundos.
import "@tanstack/react-start/server-only";
import { supabaseAdmin } from "@/server/supabase.server";
import { idDaSessao } from "@/server/unidade.server";
import { ErroDominio } from "@/services/db";
import { entradaAtiva, type RegistroCheckin } from "@/lib/checkin";
import { tr } from "@/i18n/server/entrada.server";

export interface SituacaoEntrada {
  confirmada: boolean;
  /** Momento da entrada vigente (ISO), quando confirmada. */
  em?: string | undefined;
}

export async function situacaoEntrada(inscricaoId: string): Promise<SituacaoEntrada> {
  const sessao = await idDaSessao();
  if (!sessao) throw new ErroDominio("sem_sessao", tr("entre_na_sua_conta_para_continuar"));
  const db = supabaseAdmin();
  const ins = await db.from("registrations").select("user_id").eq("id", inscricaoId).maybeSingle();
  if (ins.error) throw new Error(tr("falha_ao_ler_a_inscricao_message", { message: ins.error.message }));
  // Só o dono do ingresso consulta; para os demais o ingresso "não existe".
  if (!ins.data || ins.data.user_id !== sessao)
    throw new ErroDominio("sem_ingresso", tr("ingresso_indisponivel"));
  const r = await db
    .from("check_ins")
    .select("id, type, reverted_id, sync_status, occurred_at")
    .eq("registration_id", inscricaoId);
  if (r.error) throw new Error(tr("falha_ao_ler_o_check_in", { message: r.error.message }));
  const registros = (r.data ?? []).map((c) => ({
    id: c.id,
    inscricaoId,
    tipo: c.type,
    revertidoId: c.reverted_id ?? undefined,
    sync: c.sync_status,
    em: c.occurred_at,
  })) as RegistroCheckin[];
  const ativa = entradaAtiva(registros, inscricaoId);
  return ativa ? { confirmada: true, em: ativa.em } : { confirmada: false };
}
