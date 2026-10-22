-- Realtime em todas as tabelas de public.
--
-- 1) Toda tabela de public entra na publicação supabase_realtime ("Realtime" ligado no
--    painel do Supabase). O navegador continua sem acesso às tabelas: RLS sem policies e
--    nenhum grant para anon/authenticated, então uma assinatura postgres_changes feita
--    com a chave publicável não recebe linha nenhuma. Sem assinantes, a publicação não
--    custa nada (o Realtime só abre o slot de replicação quando alguém assina).
--
-- 2) O site atualiza em tempo real por um sinal: toda gravação da base passa por
--    apply_changes, que incrementa base_control.version. Um gatilho em base_control manda
--    só o número da versão por Broadcast no canal público "base"; o navegador recebe e
--    busca a sua visão de novo pela API (que continua aplicando as regras de leitura).
--    Nenhum dado de tabela sai pelo Realtime.
begin;

do $$
declare
  t record;
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
  -- Publicação "for all tables" já cobre tudo (e não aceita "add table").
  if not (select puballtables from pg_publication where pubname = 'supabase_realtime') then
    for t in
      select c.relname from pg_class c
        join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'public' and c.relkind in ('r', 'p') and not c.relispartition
         and not exists (
           select 1 from pg_publication_tables p
            where p.pubname = 'supabase_realtime' and p.schemaname = 'public' and p.tablename = c.relname
         )
       order by c.relname
    loop
      execute format('alter publication supabase_realtime add table public.%I', t.relname);
    end loop;
  end if;
  -- Tabela publicada sem chave primária recusa UPDATE/DELETE ("does not have a replica
  -- identity"): essas passam a registrar a linha inteira.
  for t in
    select c.relname from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relkind in ('r', 'p') and c.relreplident = 'd'
       and not exists (select 1 from pg_index i where i.indrelid = c.oid and i.indisprimary)
  loop
    execute format('alter table public.%I replica identity full', t.relname);
  end loop;
end
$$;

-- Sinal de versão nova. Um erro do Realtime nunca impede a gravação: o site também
-- atualiza ao voltar para a aba.
create or replace function public.notify_base_version()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.version is distinct from old.version
     and to_regprocedure('realtime.send(jsonb, text, text, boolean)') is not null then
    begin
      perform realtime.send(jsonb_build_object('version', new.version), 'versao', 'base', false);
    exception when others then
      raise warning 'Realtime: falha ao avisar a versão %: %', new.version, sqlerrm;
    end;
  end if;
  return null;
end;
$$;
revoke all on function public.notify_base_version() from public, anon, authenticated;

drop trigger if exists base_control_notify_version on public.base_control;
create trigger base_control_notify_version
  after update of version on public.base_control
  for each row execute function public.notify_base_version();

commit;
