-- Modelo de acesso do banco (docs/ARQUITETURA.md, seção 5.1): o navegador nunca fala com o
-- banco, então anon e authenticated não podem ler nem gravar nada e só service_role executa
-- as RPCs do servidor. Roda com `supabase test db` sobre todas as migrations aplicadas do zero.
begin;
select plan(16);

select is(
  (select array_agg(t order by t) from unnest(public.base_tables()) t
    where to_regclass('public.' || t) is null),
  null,
  'toda tabela de base_tables() existe em public'
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
  not has_function_privilege('anon', 'public.apply_changes(jsonb, bigint)', 'execute')
    and not has_function_privilege('authenticated', 'public.apply_changes(jsonb, bigint)', 'execute'),
  'apply_changes fechada para anon e authenticated'
);

select ok(
  has_function_privilege('service_role', 'public.apply_changes(jsonb, bigint)', 'execute')
    and has_function_privilege('service_role', 'public.export_base()', 'execute'),
  'service_role executa as RPCs do servidor'
);

select throws_ok(
  $$insert into public.platform_settings (id, platform_fee_percent, updated_by) values ('plataforma', 60, 'teste')$$,
  '23514',
  null,
  'taxa da plataforma acima de 50% é rejeitada'
);

select throws_ok(
  $$insert into public.platform_settings (id, platform_fee_percent, buyer_fee_percent, updated_by) values ('plataforma', 5, 60, 'teste')$$,
  '23514',
  null,
  'taxa do comprador acima de 50% é rejeitada'
);

select col_has_check('public', 'organizations', 'buyer_fee_percent', 'taxa do comprador da organização limitada a 0%-50%');

select throws_ok(
  $$insert into public.platform_settings (id, platform_fee_percent, updated_by) values ('outra', 5, 'teste')$$,
  '23514',
  null,
  'só existe o registro "plataforma"'
);

-- Ficha de emergência (dado de saúde): compartilhar exige a data da autorização, e vice-versa.
select throws_ok(
  $$insert into public.user_emergency_records (user_id, share_with_organizers, updated_at)
    values ('00000000-0000-0000-0000-000000000001', true, now())$$,
  '23514',
  null,
  'ficha compartilhada sem data de autorização é rejeitada'
);

select throws_ok(
  $$insert into public.user_emergency_records (user_id, blood_type, share_with_organizers, updated_at)
    values ('00000000-0000-0000-0000-000000000001', 'Z+', false, now())$$,
  '23514',
  null,
  'tipo sanguíneo fora da lista é rejeitado'
);

select is(
  (select array_agg(c.table_name || '.' || c.column_name order by 1) from information_schema.columns c
    where c.table_schema = 'public' and c.data_type in ('json', 'jsonb')),
  null,
  'nenhuma coluna json/jsonb em public: listas e objetos ficam em tabelas próprias'
);

-- Realtime: toda tabela de public publicada (o navegador continua sem ler nada, pelas regras
-- acima); o site atualiza pelo sinal de versão de base_control.
select is(
  (select array_agg(c.relname::text order by c.relname) from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind = 'r'
     and not exists (select 1 from pg_publication_tables p
                      where p.pubname = 'supabase_realtime' and p.schemaname = 'public' and p.tablename = c.relname)),
  null,
  'toda tabela de public está na publicação supabase_realtime (inclua tabelas novas numa migration)'
);

select is(
  (select array_agg(c.relname::text order by c.relname) from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind = 'r'
     and (c.relreplident = 'n' or (c.relreplident = 'd'
       and not exists (select 1 from pg_index i where i.indrelid = c.oid and i.indisprimary)))),
  null,
  'toda tabela de public tem chave primária ou replica identity (publicada sem ela, UPDATE/DELETE falham)'
);

select has_trigger('public', 'base_control', 'base_control_notify_version', 'base_control avisa o site a cada versão nova');

select * from finish();
rollback;
