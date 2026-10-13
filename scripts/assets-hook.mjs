// Hook de módulos do Node para o script de seed: importações de imagem (.jpg/.png/.webp)
// viram data URLs, que a semeadura envia ao Supabase Storage.
import { readFile } from "node:fs/promises";

const TIPOS = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp" };

export async function load(url, context, next) {
  const ext = /\.(jpe?g|png|webp)$/i.exec(url)?.[1]?.toLowerCase();
  if (!ext) return next(url, context);
  const dados = (await readFile(new URL(url))).toString("base64");
  return { format: "module", shortCircuit: true, source: `export default "data:${TIPOS[ext]};base64,${dados}";` };
}
