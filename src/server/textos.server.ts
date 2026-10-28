// Textos fixos do site (public.site_texts), lidos com a chave secreta e guardados em memória.
import "@tanstack/react-start/server-only";
import { supabaseAdmin } from "@/server/supabase.server";
import type { Idioma, Textos } from "@/lib/i18n";

// Uma edição no banco aparece no site em até 1 minuto, sem republicar.
const VALIDADE_MS = 60_000;
const cache = new Map<Idioma, { textos: Textos; em: number }>();
const pendentes = new Map<Idioma, Promise<Textos>>();

async function buscar(idioma: Idioma): Promise<Textos> {
  const { data, error } = await supabaseAdmin().from("site_texts").select("key,value").eq("locale", idioma).range(0, 4999);
  if (error) throw new Error(error.message);
  const textos: Textos = {};
  for (const linha of (data ?? []) as { key: string; value: string }[]) textos[linha.key] = linha.value;
  return textos;
}

/** Sem banco, devolve a última versão lida (ou nada): a página mostra as chaves em vez de quebrar. */
export async function textosDoIdioma(idioma: Idioma): Promise<Textos> {
  const atual = cache.get(idioma);
  if (atual && Date.now() - atual.em < VALIDADE_MS) return atual.textos;
  let pedido = pendentes.get(idioma);
  if (!pedido) {
    pedido = buscar(idioma)
      .then((textos) => {
        cache.set(idioma, { textos, em: Date.now() });
        return textos;
      })
      .catch((e: unknown) => {
        console.error("[textos do site]", e instanceof Error ? e.message : e);
        return atual?.textos ?? {};
      })
      .finally(() => pendentes.delete(idioma));
    pendentes.set(idioma, pedido);
  }
  return pedido;
}
