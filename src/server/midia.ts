// Arquivos enviados pelo navegador chegam como data URL (base64) dentro dos registros.
// Antes de gravar, o servidor os envia ao bucket público "midia" do Supabase Storage e
// troca o data URL pela URL pública — o banco guarda só a URL.
// Recebe o cliente admin por parâmetro para ser usado também pelo script de seed.
import type { SupabaseClient } from "@supabase/supabase-js";

const BUCKET = "midia";
const DATA_URL = /^data:([a-z]+\/[a-z0-9.+-]+);base64,([A-Za-z0-9+/=]+)$/;
const LIMITES: Record<string, { ext: string; max: number }> = {
  "image/jpeg": { ext: "jpg", max: 10 * 1024 * 1024 },
  "image/png": { ext: "png", max: 10 * 1024 * 1024 },
  "image/webp": { ext: "webp", max: 10 * 1024 * 1024 },
  "image/gif": { ext: "gif", max: 10 * 1024 * 1024 },
  "application/pdf": { ext: "pdf", max: 5 * 1024 * 1024 },
};

async function enviar(admin: SupabaseClient, dataUrl: string): Promise<string> {
  const m = DATA_URL.exec(dataUrl);
  const tipo = m?.[1] ?? "";
  const regra = LIMITES[tipo];
  if (!m || !regra) throw new Error(`Tipo de arquivo não permitido: ${tipo || "desconhecido"}.`);
  const bytes = Uint8Array.from(atob(m[2]!), (c) => c.charCodeAt(0));
  if (bytes.byteLength > regra.max) throw new Error("Arquivo acima do tamanho permitido.");
  const caminho = `${new Date().toISOString().slice(0, 7)}/${crypto.randomUUID()}.${regra.ext}`;
  const storage = admin.storage.from(BUCKET);
  const { error } = await storage.upload(caminho, bytes, { contentType: tipo, upsert: false });
  if (error) throw new Error(`Falha ao enviar arquivo: ${error.message}`);
  return storage.getPublicUrl(caminho).data.publicUrl;
}

/** Percorre os registros e troca, no próprio objeto, cada data URL base64 pela URL do Storage. */
export async function enviarMidia(admin: SupabaseClient, registros: object[]): Promise<void> {
  const pendentes: Promise<void>[] = [];
  const visitar = (alvo: Record<string, unknown>) => {
    for (const [k, v] of Object.entries(alvo)) {
      if (typeof v === "string") {
        if (v.startsWith("data:") && v.includes(";base64,")) {
          pendentes.push(enviar(admin, v).then((url) => { alvo[k] = url; }));
        }
      } else if (v && typeof v === "object") {
        visitar(v as Record<string, unknown>);
      }
    }
  };
  registros.forEach((r) => visitar(r as Record<string, unknown>));
  await Promise.all(pendentes);
}
