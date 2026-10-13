// Métricas no servidor: registros anônimos (append-only) e campanhas, fora da base
// transacional. O servidor revalida cada registro antes de gravar.
import "@tanstack/react-start/server-only";
import { ErroDominio } from "@/services/db";
import { daLinha, paraLinha } from "@/lib/persistencia";
import { gereEvento } from "@/lib/visao";
import { contextoSomenteLeitura } from "@/server/unidade.server";
import { supabaseAdmin } from "@/server/supabase.server";
import type { Campanha, OrigemCampanha, RegistroAnalytics } from "@/lib/analytics";

const DIA = 86400000;
const PAGINA = 1000;

async function campanhasDe(eventoIds?: string[]): Promise<Campanha[]> {
  let q = supabaseAdmin().from("campanhas").select("*").order("criado_em");
  if (eventoIds) q = q.in("evento_id", eventoIds.length ? eventoIds : ["\u0000"]);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []).map((l) => daLinha<Campanha>(l));
}

/** Grava registros vindos do navegador, descartando inválidos e acessos excluídos. */
export async function registrar(registros: RegistroAnalytics[]): Promise<number> {
  const { base, usuario } = await contextoSomenteLeitura();
  const agora = Date.now();
  const eventos = new Map(base.eventos.map((e) => [e.id, e]));
  const campanhas = new Map((await campanhasDe()).map((c) => [c.id, c]));
  const validos = registros.flatMap((r) => {
    const evento = eventos.get(r.eventoId);
    // Admin e a própria organização não entram na coleta.
    if (!evento || gereEvento(usuario, evento)) return [];
    const campanhaOk = r.campanhaId && campanhas.get(r.campanhaId)?.eventoId === r.eventoId;
    const reg: RegistroAnalytics = {
      ...r,
      campanhaId: campanhaOk ? r.campanhaId : undefined,
      origem: r.origem === "campanha" && !campanhaOk ? "direto" : r.origem,
      em: Math.min(agora, Math.max(agora - DIA, r.em)),
    };
    return [paraLinha(reg)];
  });
  if (validos.length === 0) return 0;
  const { error } = await supabaseAdmin().from("analytics_registros").upsert(validos, { onConflict: "id", ignoreDuplicates: true });
  if (error) throw new Error(error.message);
  return validos.length;
}

/** Registros dos eventos que a pessoa gere (admin: todos). */
export async function listar(): Promise<{ registros: RegistroAnalytics[]; campanhas: Campanha[] }> {
  const { base, usuario } = await contextoSomenteLeitura();
  if (!usuario || (usuario.perfil !== "admin" && usuario.perfil !== "organizador")) {
    throw new ErroDominio("sem_permissao", "Sem acesso às métricas.");
  }
  const ids = base.eventos.filter((e) => gereEvento(usuario, e)).map((e) => e.id);
  const registros: RegistroAnalytics[] = [];
  for (let de = 0; ids.length; de += PAGINA) {
    const { data, error } = await supabaseAdmin()
      .from("analytics_registros").select("*").in("evento_id", ids).order("id").range(de, de + PAGINA - 1);
    if (error) throw new Error(error.message);
    registros.push(...(data ?? []).map((l) => ({ ...daLinha<RegistroAnalytics>(l), em: Number(l["em"]) })));
    if (!data || data.length < PAGINA) break;
  }
  return { registros, campanhas: await campanhasDe(ids) };
}

export async function criarCampanha(eventoId: string, nome: string, origem: OrigemCampanha): Promise<Campanha> {
  const { base, usuario } = await contextoSomenteLeitura();
  const evento = base.eventos.find((e) => e.id === eventoId);
  if (!evento || !gereEvento(usuario, evento)) throw new ErroDominio("sem_permissao", "Você não pode criar campanhas para este evento.");
  if (!nome.trim()) throw new ErroDominio("nome", "Informe o nome da campanha.");
  const c: Campanha = {
    id: `cmp-${crypto.randomUUID().slice(0, 12)}`, eventoId, nome: nome.trim().slice(0, 60), origem, criadoEm: new Date().toISOString(),
  };
  const { error } = await supabaseAdmin().from("campanhas").insert(paraLinha(c));
  if (error) throw new Error(error.message);
  return c;
}
