// Anexos do suporte: bucket PRIVADO "documentos", prefixo suporte/<chamado>/, separados
// das fotos públicas e das notas fiscais. Download só por URL assinada curta, após
// verificar que a pessoa vê o chamado. Arquivos nunca são executados nem interpretados.
import "@tanstack/react-start/server-only";
import { ErroDominio } from "@/services/db";
import { supabaseAdmin } from "@/server/supabase.server";
import { lerArquivoNota } from "@/server/documentos.server";
import type { AnexoChamado } from "@/lib/domain/types";
import { tr } from "@/i18n/server/anexosSuporte.server";

const BUCKET = "documentos";

export async function gravarAnexo(chamadoId: string, clienteId: string, nome: string, dataUrl: string): Promise<AnexoChamado> {
  const arq = lerArquivoNota(dataUrl); // PDF/JPEG/PNG/WebP, ≤ 5 MB, assinatura real conferida
  const seguro = nome.replace(/[^\p{L}\p{N} ._-]/gu, "").slice(0, 100) || `anexo.${arq.ext}`;
  // Caminho determinístico por mensagem: reenvio sobrescreve em vez de duplicar.
  const caminho = `suporte/${chamadoId}/${clienteId}.${arq.ext}`;
  const { error } = await supabaseAdmin().storage.from(BUCKET).upload(caminho, arq.bytes, { contentType: arq.tipo, upsert: true });
  if (error) throw new Error(tr("falha_ao_enviar_anexo_message", { message: error.message }));
  return { caminho, nome: seguro, tipo: arq.tipo, tamanho: arq.bytes.byteLength };
}

export async function urlDoAnexo(anexo: AnexoChamado, baixar: boolean): Promise<string> {
  if (!anexo.caminho.startsWith("suporte/")) throw new ErroDominio("anexo", tr("anexo_nao_encontrado"));
  const { data, error } = await supabaseAdmin().storage.from(BUCKET)
    .createSignedUrl(anexo.caminho, 60, baixar ? { download: anexo.nome } : undefined);
  if (error || !data) throw new Error(error?.message ?? tr("falha_ao_gerar_link"));
  return data.signedUrl;
}
