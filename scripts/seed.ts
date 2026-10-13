// Popula o projeto Supabase com a base demonstrativa.
// Uso: bun run db:seed                 (lê SUPABASE_URL e SUPABASE_SECRET_KEY de .env.local)
//      bun run db:seed -- --limpar-contas  (também remove do Auth as contas fora da seed)
// ATENÇÃO: substitui todo o conteúdo das tabelas da aplicação.
import { createClient } from "@supabase/supabase-js";
import { semearBase } from "@/server/semeadura";

const url = process.env["SUPABASE_URL"];
const chave = process.env["SUPABASE_SECRET_KEY"];
if (!url || !chave) {
  console.error("Defina SUPABASE_URL e SUPABASE_SECRET_KEY (ex.: em .env.local).");
  process.exit(1);
}

const admin = createClient(url, chave, { auth: { persistSession: false, autoRefreshToken: false } });
await semearBase(admin, {
  removerOutrasContas: process.argv.includes("--limpar-contas"),
  registrar: (m) => console.log(`• ${m}`),
});
console.log("Base demonstrativa gravada no Supabase.");
