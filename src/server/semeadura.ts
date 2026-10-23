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
import { CAMPANHAS_METRICAS, REGISTROS_METRICAS } from "@/lib/esquemaBanco";
import { enviarMidia } from "@/server/midia";
import { chaveiroDoAmbiente, cifrarLote, decifrarTabelas } from "@/server/cifraDados";
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
  const { data: atual, error: erroLeitura } = await admin.rpc("export_base");
  if (erroLeitura) throw new Error(`Falha ao ler a base: ${erroLeitura.message}`);
  const r = atual as { version: number; tables: TabelasExportadas };
  // Mesma chave do servidor (PERSONAL_DATA_ENCRYPTION_KEY): os dados pessoais são gravados cifrados.
  const chaveiro = await chaveiroDoAmbiente();
  const { tabelas } = await decifrarTabelas(r.tables, chaveiro);
  const lote = await cifrarLote(calcularMudancas(baseDasTabelas(tabelas), base), chaveiro);
  const { error: erroGravacao } = await admin.rpc("apply_changes", { p_changes: lote, p_version: r.version });
  if (erroGravacao) throw new Error(`Falha ao gravar a seed: ${erroGravacao.message}`);
  log("Tabelas da aplicação substituídas pela base demonstrativa.");

  // 4. Métricas fictícias
  const { campanhas, registros } = gerarHistoricoDemo(base.eventos);
  await admin.from(REGISTROS_METRICAS.tabela).delete().neq("id", "");
  await admin.from(CAMPANHAS_METRICAS.tabela).delete().neq("id", "");
  const { error: erroCamp } = await admin.from(CAMPANHAS_METRICAS.tabela).insert(campanhas.map((c) => paraLinha(CAMPANHAS_METRICAS, c)));
  if (erroCamp) throw new Error(`Falha ao gravar campanhas: ${erroCamp.message}`);
  for (let i = 0; i < registros.length; i += 1000) {
    const { error } = await admin.from(REGISTROS_METRICAS.tabela).insert(registros.slice(i, i + 1000).map((r) => paraLinha(REGISTROS_METRICAS, r)));
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
