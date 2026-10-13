// Clientes Supabase do servidor. Nunca importar no navegador.
//  - supabaseAdmin: chave secreta; acesso total ao banco/Storage/Auth admin.
//    Usado SÓ depois que a server function autenticou a pessoa e aplicou as regras.
//  - supabaseSessao: chave publicável + cookies da requisição; lê/renova a sessão
//    do Supabase Auth e faz login/logout. Um cliente novo por requisição.
import "@tanstack/react-start/server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { getCookies, setCookie, setResponseHeader } from "@tanstack/react-start/server";

function variavel(nome: string): string {
  const valor = process.env[nome];
  if (!valor) throw new Error(`Variável de ambiente ${nome} não configurada.`);
  return valor;
}

let admin: SupabaseClient | null = null;

export function supabaseAdmin(): SupabaseClient {
  admin ??= createClient(variavel("SUPABASE_URL"), variavel("SUPABASE_SECRET_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  return admin;
}

export function supabaseSessao(): SupabaseClient {
  return createServerClient(variavel("SUPABASE_URL"), variavel("SUPABASE_PUBLISHABLE_KEY"), {
    cookies: {
      getAll() {
        return Object.entries(getCookies()).map(([name, value]) => ({ name, value }));
      },
      setAll(cookies, cabecalhos) {
        for (const c of cookies) setCookie(c.name, c.value, c.options);
        // Respostas que gravam cookies de sessão não podem ficar em cache de CDN.
        for (const [nome, valor] of Object.entries(cabecalhos ?? {})) setResponseHeader(nome as never, valor);
      },
    },
  });
}
