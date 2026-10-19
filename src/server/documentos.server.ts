// Notas fiscais dos equipamentos: bucket PRIVADO "documentos" + tabela documentos_privados,
// fora da base transacional (nunca entram na visão do navegador). Só o dono acessa,
// por URL assinada de curta duração. Nada é extraído ou interpretado do arquivo.
import "@tanstack/react-start/server-only";
import { ErroDominio } from "@/services/db";
import { supabaseAdmin } from "@/server/supabase.server";

const BUCKET = "documentos";
export const TAMANHO_MAX_NOTA = 5 * 1024 * 1024;
const TIPOS: Record<string, { ext: string; assinatura: (b: Uint8Array) => boolean }> = {
  "application/pdf": { ext: "pdf", assinatura: (b) => b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46 },
  "image/jpeg": { ext: "jpg", assinatura: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  "image/png": { ext: "png", assinatura: (b) => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 },
  "image/webp": { ext: "webp", assinatura: (b) => String.fromCharCode(...b.slice(0, 4)) === "RIFF" && String.fromCharCode(...b.slice(8, 12)) === "WEBP" },
};
const DATA_URL = /^data:([a-z]+\/[a-z0-9.+-]+);base64,([A-Za-z0-9+/=]+)$/;

export interface ArquivoNota { bytes: Uint8Array; tipo: string; ext: string }

/** Valida tipo declarado, tamanho e assinatura real do arquivo. */
export function lerArquivoNota(dataUrl: string): ArquivoNota {
  const m = DATA_URL.exec(dataUrl);
  const regra = m && TIPOS[m[1]!];
  if (!m || !regra) throw new ErroDominio("nota_tipo", "Formato não aceito. Envie PDF, JPEG, PNG ou WebP.");
  const bytes = Uint8Array.from(atob(m[2]!), (c) => c.charCodeAt(0));
  if (bytes.byteLength > TAMANHO_MAX_NOTA) throw new ErroDominio("nota_tamanho", "Arquivo acima de 5 MB.");
  if (!regra.assinatura(bytes)) throw new ErroDominio("nota_invalida", "O conteúdo do arquivo não corresponde ao formato informado.");
  return { bytes, tipo: m[1]!, ext: regra.ext };
}

interface LinhaDoc { id: string; usuario_id: string; equipamento_id: string; caminho: string; nome: string; tipo: string; tamanho: number }

async function docDoEquipamento(equipamentoId: string): Promise<LinhaDoc | null> {
  const { data, error } = await supabaseAdmin().from("documentos_privados").select("*").eq("equipamento_id", equipamentoId).maybeSingle();
  if (error) throw new Error(error.message);
  return data as LinhaDoc | null;
}

export async function gravarNota(usuarioId: string, equipamentoId: string, nome: string, arq: ArquivoNota) {
  const caminho = `${usuarioId}/${crypto.randomUUID()}.${arq.ext}`;
  const storage = supabaseAdmin().storage.from(BUCKET);
  const { error } = await storage.upload(caminho, arq.bytes, { contentType: arq.tipo, upsert: false });
  if (error) throw new Error(`Falha ao enviar documento: ${error.message}`);
  const anterior = await docDoEquipamento(equipamentoId);
  const linha = { id: `doc-${equipamentoId}`, usuario_id: usuarioId, equipamento_id: equipamentoId, caminho, nome, tipo: arq.tipo, tamanho: arq.bytes.byteLength, enviado_em: new Date().toISOString() };
  const { error: e2 } = await supabaseAdmin().from("documentos_privados").upsert(linha, { onConflict: "equipamento_id" });
  if (e2) { await storage.remove([caminho]); throw new Error(e2.message); }
  if (anterior) await storage.remove([anterior.caminho]);
  return { nome, tipo: arq.tipo, tamanho: arq.bytes.byteLength, enviadaEm: linha.enviado_em };
}

/** URL assinada (60 s) — somente para o dono do documento. */
export async function urlDaNota(usuarioId: string, equipamentoId: string, baixar: boolean): Promise<string> {
  const doc = await docDoEquipamento(equipamentoId);
  if (!doc || doc.usuario_id !== usuarioId) throw new ErroDominio("nota", "Documento não encontrado.");
  const { data, error } = await supabaseAdmin().storage.from(BUCKET)
    .createSignedUrl(doc.caminho, 60, baixar ? { download: doc.nome } : undefined);
  if (error || !data) throw new Error(error?.message ?? "Falha ao gerar link.");
  return data.signedUrl;
}

export async function removerNota(usuarioId: string, equipamentoId: string): Promise<void> {
  const doc = await docDoEquipamento(equipamentoId);
  if (!doc) return;
  if (doc.usuario_id !== usuarioId) throw new ErroDominio("nota", "Documento não encontrado.");
  await supabaseAdmin().storage.from(BUCKET).remove([doc.caminho]);
  await supabaseAdmin().from("documentos_privados").delete().eq("id", doc.id);
}

