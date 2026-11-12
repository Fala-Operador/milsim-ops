// Clientes Supabase do servidor. Nunca importar no navegador.
//  - supabaseAdmin: chave secreta; acesso total ao banco/Storage/Auth admin.
//    Usado SÓ depois que a server function autenticou a pessoa e aplicou as regras.
//  - supabaseSessao: chave publicável + cookies da requisição; lê/renova a sessão
//    do Supabase Auth e faz login/logout. Um cliente novo por requisição.
import "@tanstack/react-start/server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { getCookies, getRequestUrl, setCookie, setResponseHeader } from "@tanstack/react-start/server";
import { papelDaChave } from "@/lib/chavesSupabase";

// Nomes alternativos usados pelos segredos do projeto (o prefixo SUPABASE_ é reservado lá).
const ALTERNATIVAS: Record<string, string> = {
  SUPABASE_URL: "BANCO_URL",
  SUPABASE_PUBLISHABLE_KEY: "BANCO_CHAVE_PUBLICA",
  SUPABASE_SECRET_KEY: "BANCO_CHAVE_SECRETA",
};

function variavel(nome: string): string {
  const alt = ALTERNATIVAS[nome];
  const valor = process.env[nome] || (alt ? process.env[alt] : undefined);
  if (!valor) throw new Error(`Variável de ambiente ${nome} não configurada.`);
  return valor;
}

/** A chave secreta precisa ser service_role: com a publicável, o banco nega tudo ("permission denied"). */
function chaveSecreta(): string {
  const chave = variavel("SUPABASE_SECRET_KEY");
  const papel = papelDaChave(chave);
  if (papel && papel !== "service_role") {
    throw new Error(
      `SUPABASE_SECRET_KEY contém uma chave "${papel}", não a secreta (service_role). ` +
        "Use a secret key do projeto (Project Settings → API Keys).",
    );
  }
  return chave;
}

/**
 * URL e chave publicável para o navegador assinar o sinal de versão do Realtime.
 * Só a chave publicável sai daqui: se a variável tiver outra chave, o tempo real fica desligado.
 */
export function configRealtimeNavegador(): { url: string; chave: string } | null {
  try {
    const chave = variavel("SUPABASE_PUBLISHABLE_KEY");
    if (papelDaChave(chave) !== "anon") return null;
    return { url: variavel("SUPABASE_URL"), chave };
  } catch {
    return null;
  }
}

let admin: SupabaseClient | null = null;

export function supabaseAdmin(): SupabaseClient {
  admin ??= createClient(variavel("SUPABASE_URL"), chaveSecreta(), {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  return admin;
}

/** Fora do ambiente local o site é sempre https (atrás do Cloudflare/proxy a requisição chega como http). */
function cookieSeguro(): boolean {
  try {
    return !/^(localhost|127\.0\.0\.1|\[::1\])$/.test(getRequestUrl({ xForwardedHost: true }).hostname);
  } catch {
    return true;
  }
}

export function supabaseSessao(): SupabaseClient {
  const seguro = cookieSeguro();
  return createServerClient(variavel("SUPABASE_URL"), variavel("SUPABASE_PUBLISHABLE_KEY"), {
    // A sessão só é lida no servidor: o cookie fica fora do alcance do JavaScript da página
    // (httpOnly), para que um XSS não consiga roubar o token.
    cookieOptions: { httpOnly: true, secure: seguro, sameSite: "lax", path: "/" },
    cookies: {
      getAll() {
        return Object.entries(getCookies()).map(([name, value]) => ({ name, value }));
      },
      setAll(cookies, cabecalhos) {
        for (const c of cookies) setCookie(c.name, c.value, { ...c.options, httpOnly: true, secure: seguro, sameSite: "lax", path: "/" });
        // Respostas que gravam cookies de sessão não podem ficar em cache de CDN.
        for (const [nome, valor] of Object.entries(cabecalhos ?? {})) setResponseHeader(nome as never, valor);
      },
    },
  });
}
