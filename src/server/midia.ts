// Arquivos enviados pelo navegador chegam como data URL (base64) dentro dos registros.
// Antes de gravar, o servidor os envia ao bucket público "midia" do Supabase Storage e
// troca o data URL pela URL pública — o banco guarda só a URL.
// Recebe o cliente admin por parâmetro para ser usado também pelo script de seed.
import type { SupabaseClient } from "@supabase/supabase-js";
import { tr } from "@/i18n/server/midia";

const BUCKET = "midia";
const DATA_URL = /^data:([a-z]+\/[a-z0-9.+-]+);base64,([A-Za-z0-9+/=]+)$/;
const texto = (b: Uint8Array, de: number, ate: number) => String.fromCharCode(...b.slice(de, ate));
// `assinatura`: o conteúdo real precisa ser do tipo declarado (o bucket é público: nada de
// HTML, executável ou outro arquivo disfarçado de imagem/PDF).
const LIMITES: Record<string, { ext: string; max: number; assinatura: (b: Uint8Array) => boolean }> = {
  "image/jpeg": { ext: "jpg", max: 10 * 1024 * 1024, assinatura: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  "image/png": { ext: "png", max: 10 * 1024 * 1024, assinatura: (b) => b[0] === 0x89 && texto(b, 1, 4) === "PNG" },
  "image/webp": { ext: "webp", max: 10 * 1024 * 1024, assinatura: (b) => texto(b, 0, 4) === "RIFF" && texto(b, 8, 12) === "WEBP" },
  "image/gif": { ext: "gif", max: 10 * 1024 * 1024, assinatura: (b) => texto(b, 0, 4) === "GIF8" },
  "application/pdf": { ext: "pdf", max: 5 * 1024 * 1024, assinatura: (b) => texto(b, 0, 5) === "%PDF-" },
};

/** Envia um data URL ao bucket público "midia" e devolve a URL pública. */
export async function enviarArquivo(admin: SupabaseClient, dataUrl: string): Promise<string> {
  const m = DATA_URL.exec(dataUrl);
  const tipo = m?.[1] ?? "";
  const regra = LIMITES[tipo];
  if (!m || !regra) throw new Error(tr("tipo_de_arquivo_nao_permitido_valor", { valor: tipo || "desconhecido" }));
  const bytes = Uint8Array.from(atob(m[2]!), (c) => c.charCodeAt(0));
  if (bytes.byteLength > regra.max) throw new Error(tr("arquivo_acima_do_tamanho_permitido"));
  if (!regra.assinatura(bytes)) throw new Error(tr("tipo_de_arquivo_nao_permitido_valor", { valor: tipo }));
  const caminho = `${new Date().toISOString().slice(0, 7)}/${crypto.randomUUID()}.${regra.ext}`;
  const storage = admin.storage.from(BUCKET);
  const { error } = await storage.upload(caminho, bytes, { contentType: tipo, upsert: false });
  if (error) throw new Error(tr("falha_ao_enviar_arquivo_message", { message: error.message }));
  return storage.getPublicUrl(caminho).data.publicUrl;
}

/** Percorre os registros e troca, no próprio objeto, cada data URL base64 pela URL do Storage. */
export async function enviarMidia(admin: SupabaseClient, registros: object[]): Promise<void> {
  const pendentes: Promise<void>[] = [];
  const visitar = (alvo: Record<string, unknown>) => {
    for (const [k, v] of Object.entries(alvo)) {
      if (typeof v === "string") {
        if (v.startsWith("data:") && v.includes(";base64,")) {
          pendentes.push(enviarArquivo(admin, v).then((url) => { alvo[k] = url; }));
        }
      } else if (v && typeof v === "object") {
        visitar(v as Record<string, unknown>);
      }
    }
  };
  registros.forEach((r) => visitar(r as Record<string, unknown>));
  await Promise.all(pendentes);
}

/**
 * Imagem de publicação aceita: data URL de imagem (vai para o Storage ao gravar) ou URL pública
 * do próprio bucket "midia" (imagem já enviada, reenviada numa edição). URL externa não: ela
 * rastrearia quem vê e mostraria conteúdo que não passou pela moderação.
 */
export function imagemPermitida(url: string): boolean {
  if (/^data:image\/(jpeg|png|webp|gif);base64,/.test(url)) return true;
  const base = process.env["SUPABASE_URL"] || process.env["BANCO_URL"];
  if (!base) return false;
  try {
    const u = new URL(url);
    return u.protocol === "https:" && u.origin === new URL(base).origin && u.pathname.startsWith(`/storage/v1/object/public/${BUCKET}/`);
  } catch {
    return false;
  }
}
