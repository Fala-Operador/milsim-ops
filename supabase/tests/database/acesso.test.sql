-- Modelo de acesso do banco (docs/ARQUITETURA.md, seção 5.1): o navegador nunca fala com o
-- banco, então anon e authenticated não podem ler nem gravar nada e só service_role executa
-- as RPCs do servidor. Roda com `supabase test db` sobre todas as migrations aplicadas do zero.
begin;
select plan(8);

select is(
  (select array_agg(t order by t) from unnest(public.tabelas_base()) t
    where to_regclass('public.' || t) is null),
  null,
  'toda tabela de tabelas_base() existe em public'
);

select is(
  (select array_agg(c.relname::text order by c.relname) from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity),
  null,
  'RLS ativo em todas as tabelas de public'
);

select is(
  (select array_agg(tablename::text order by tablename) from pg_policies where schemaname = 'public'),
  null,
  'nenhuma policy em public (negação total para anon e authenticated)'
);

select is(
  (select array_agg(distinct table_name::text order by table_name::text) from information_schema.role_table_grants
    where table_schema = 'public' and grantee in ('anon', 'authenticated')),
  null,
  'anon e authenticated não têm privilégio em nenhuma tabela de public'
);

select ok(
  not has_function_privilege('anon', 'public.aplicar_mudancas(jsonb, bigint)', 'execute')
    and not has_function_privilege('authenticated', 'public.aplicar_mudancas(jsonb, bigint)', 'execute'),
  'aplicar_mudancas fechada para anon e authenticated'
);

select ok(
  has_function_privilege('service_role', 'public.aplicar_mudancas(jsonb, bigint)', 'execute')
    and has_function_privilege('service_role', 'public.exportar_base()', 'execute'),
  'service_role executa as RPCs do servidor'
);

select throws_ok(
  $$insert into public.configuracoes_plataforma (id, taxa_plataforma_percentual, atualizado_por) values ('plataforma', 60, 'teste')$$,
  '23514',
  null,
  'taxa da plataforma acima de 50% é rejeitada'
);

select throws_ok(
  $$insert into public.configuracoes_plataforma (id, taxa_plataforma_percentual, atualizado_por) values ('outra', 5, 'teste')$$,
  '23514',
  null,
  'só existe o registro "plataforma"'
);

select * from finish();
rollback;
