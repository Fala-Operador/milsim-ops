// Semeadura da base demonstrativa no Supabase (script `bun run db:seed`, só para
// desenvolvimento — substitui todos os dados):
//  1. garante uma conta no Supabase Auth para cada usuário da seed (senhas de SENHAS_DEMO;
//     contas fictícias recebem senha aleatória e não podem entrar);
//  2. troca os ids fictícios ("usr-admin"...) pelos UUIDs de auth.users;
//  3. substitui todo o conteúdo das tabelas pela seed numa única transação;
//  4. recria o histórico fictício de métricas e as campanhas.
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { criarBaseInicial, SENHAS_DEMO } from "@/data/seed";
import { gerarHistoricoDemo } from "@/data/seedAnalytics";
import { aleatorioSeguro } from "@/lib/checkin";
import { baseDasTabelas, calcularMudancas, objetosAlterados, paraLinha, type TabelasExportadas } from "@/lib/persistencia";
import { enviarMidia } from "@/server/midia";
import type { BaseDados } from "@/lib/domain/types";

async function todasAsContas(admin: SupabaseClient): Promise<User[]> {
  const contas: User[] = [];
  for (let pagina = 1; ; pagina++) {
    const { data, error } = await admin.auth.admin.listUsers({ page: pagina, perPage: 1000 });
    if (error) throw new Error(`Falha ao listar contas: ${error.message}`);
    contas.push(...data.users);
    if (data.users.length < 1000) return contas;
  }
}

/** Troca ids antigos por novos em toda a base (valores e chaves "usuario:evento"). */
function trocarIds(base: BaseDados, mapa: Map<string, string>): BaseDados {
  let json = JSON.stringify(base);
  const ids = [...mapa.keys()].sort((a, b) => b.length - a.length);
  for (const antigo of ids) {
    const novo = mapa.get(antigo)!;
    json = json.split(`"${antigo}"`).join(`"${novo}"`).split(`"${antigo}:`).join(`"${novo}:`);
  }
  return JSON.parse(json) as BaseDados;
}

export interface OpcoesSemeadura {
  /** Remove do Auth as contas que não fazem parte da seed (restauração completa). */
  removerOutrasContas?: boolean;
  registrar?: (msg: string) => void;
}

export async function semearBase(admin: SupabaseClient, opcoes: OpcoesSemeadura = {}): Promise<void> {
  const log = opcoes.registrar ?? (() => {});
  const seed = criarBaseInicial();

  // 1. Contas no Supabase Auth
  const existentes = new Map((await todasAsContas(admin)).map((u) => [u.email?.toLowerCase(), u]));
  const mapa = new Map<string, string>();
  for (const u of seed.usuarios) {
    const senha = SENHAS_DEMO[u.email] ?? `${aleatorioSeguro(24)}a1!`;
    const conta = existentes.get(u.email);
    if (conta) {
      const { error } = await admin.auth.admin.updateUserById(conta.id, { password: senha, email_confirm: true });
      if (error) throw new Error(`Falha ao atualizar ${u.email}: ${error.message}`);
      mapa.set(u.id, conta.id);
    } else {
      const { data, error } = await admin.auth.admin.createUser({ email: u.email, password: senha, email_confirm: true });
      if (error || !data.user) throw new Error(`Falha ao criar ${u.email}: ${error?.message}`);
      mapa.set(u.id, data.user.id);
    }
  }
  log(`${mapa.size} contas garantidas no Supabase Auth.`);
  const base = trocarIds(seed, mapa);

  // 2. Imagens da seed (data URLs) → Storage
  await enviarMidia(admin, objetosAlterados(baseDasTabelas({}), base));

  // 3. Conteúdo das tabelas (substituição completa, numa transação)
  const { data: atual, error: erroLeitura } = await admin.rpc("exportar_base");
  if (erroLeitura) throw new Error(`Falha ao ler a base: ${erroLeitura.message}`);
  const r = atual as { versao: number; tabelas: TabelasExportadas };
  const lote = calcularMudancas(baseDasTabelas(r.tabelas), base);
  const { error: erroGravacao } = await admin.rpc("aplicar_mudancas", { p_mudancas: lote, p_versao: r.versao });
  if (erroGravacao) throw new Error(`Falha ao gravar a seed: ${erroGravacao.message}`);
  log("Tabelas da aplicação substituídas pela base demonstrativa.");

  // 4. Métricas fictícias
  const { campanhas, registros } = gerarHistoricoDemo(base.eventos);
  await admin.from("analytics_registros").delete().neq("id", "");
  await admin.from("campanhas").delete().neq("id", "");
  const { error: erroCamp } = await admin.from("campanhas").insert(campanhas.map(paraLinha));
  if (erroCamp) throw new Error(`Falha ao gravar campanhas: ${erroCamp.message}`);
  for (let i = 0; i < registros.length; i += 1000) {
    const { error } = await admin.from("analytics_registros").insert(registros.slice(i, i + 1000).map(paraLinha));
    if (error) throw new Error(`Falha ao gravar métricas: ${error.message}`);
  }
  log(`${registros.length} registros de métricas fictícios gravados.`);

  // 5. Contas fora da seed (somente na restauração completa)
  if (opcoes.removerOutrasContas) {
    const daSeed = new Set(mapa.values());
    for (const conta of await todasAsContas(admin)) {
      if (!daSeed.has(conta.id)) await admin.auth.admin.deleteUser(conta.id);
    }
  }
}
