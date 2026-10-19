// Normaliza os links de Instagram já gravados nos parceiros (ex.: "@perfil" →
// https://www.instagram.com/perfil/) usando a mesma regra do cadastro.
// Valores que não podem ser convertidos com segurança ficam como estão e aparecem
// como pendência no painel do admin.
// Uso: bun run db:normalizar-links            (só mostra o que mudaria)
//      bun run db:normalizar-links -- --aplicar
import { createClient } from "@supabase/supabase-js";
import { linksPendentes, normalizarLinks } from "@/lib/divulgacao";
import { baseDasTabelas, calcularMudancas, type TabelasExportadas } from "@/lib/persistencia";

const url = process.env["SUPABASE_URL"];
const chave = process.env["SUPABASE_SECRET_KEY"];
if (!url || !chave) {
  console.error("Defina SUPABASE_URL e SUPABASE_SECRET_KEY (ex.: em .env.local).");
  process.exit(1);
}
const aplicar = process.argv.includes("--aplicar");
const admin = createClient(url, chave, { auth: { persistSession: false, autoRefreshToken: false } });

const { data, error } = await admin.rpc("export_base");
if (error) throw new Error(error.message);
const r = data as { version: number; tables: TabelasExportadas };
const antes = baseDasTabelas(r.tables);
const depois = structuredClone(antes);

for (const p of depois.parceiros) {
  const novos = normalizarLinks(p.links);
  novos.forEach((l, i) => {
    if (l !== p.links[i]) console.log(`• ${p.nome}: ${p.links[i]!.url} → ${l.url}`);
  });
  p.links = novos;
  for (const { link, erro } of linksPendentes(p)) console.log(`! ${p.nome}: pendência em "${link.url ?? link.telefone}" — ${erro}`);
}

const lote = calcularMudancas(antes, depois);
// Links ficam na tabela partner_links: conta os parceiros com alguma linha alterada.
const alterados = new Set(
  ["partners", "partner_links"].flatMap((t) => [...(lote[t]?.gravar ?? []), ...(lote[t]?.excluir ?? [])])
    .map((l) => String(l["partner_id"] ?? l["id"])),
);
const total = alterados.size;
if (total === 0) {
  console.log("Nada a normalizar.");
} else if (!aplicar) {
  console.log(`${total} parceiro(s) seriam atualizados. Rode com -- --aplicar para gravar.`);
} else {
  const { error: erro } = await admin.rpc("apply_changes", { p_changes: lote, p_version: r.version });
  if (erro) throw new Error(`Falha ao gravar: ${erro.message}`);
  console.log(`${total} parceiro(s) atualizados.`);
}
