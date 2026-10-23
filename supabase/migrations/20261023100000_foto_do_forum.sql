-- Foto do fórum (comunidade geral): imagem quadrada opcional, enviada ao bucket público "midia"
-- pelo servidor (o banco guarda só a URL). Aditiva: uma coluna opcional; as duas funções que
-- mexem com fórum passam a ler/gravar a foto (mudam de assinatura, então são recriadas).
begin;

alter table public.social_forums add column if not exists photo_url text;

drop function if exists public.social_forums_page(uuid, text, boolean, integer, integer, text);
create or replace function public.social_forums_page(
  p_viewer uuid, p_query text default null, p_only_mine boolean default false,
  p_limit integer default 30, p_offset integer default 0, p_forum text default null
)
returns table (
  id text, owner_id uuid, name text, description text, visibility text, photo_url text, created_at timestamptz,
  member_count bigint, pending_count bigint, my_role text, my_status text
)
language sql
stable
set search_path = ''
as $$
  select f.id, f.owner_id, f.name, f.description, f.visibility, f.photo_url, f.created_at,
         (select count(*) from public.social_forum_members m where m.forum_id = f.id and m.status = 'aprovado'),
         -- Pedidos pendentes: só quem modera vê o número.
         case when me.role in ('dono', 'moderador') and me.status = 'aprovado'
              then (select count(*) from public.social_forum_members m where m.forum_id = f.id and m.status = 'pendente')
              else 0 end,
         me.role, me.status
    from public.social_forums f
    left join public.social_forum_members me on me.forum_id = f.id and me.user_id = p_viewer
   where f.status = 'ativo'
     and (p_forum is null or f.id = p_forum)
     and (not coalesce(p_only_mine, false) or me.status is not null)
     and (p_query is null or p_query = '' or f.name ilike '%' || replace(replace(p_query, '%', ''), '_', '') || '%')
     and public.social_author_ok(p_viewer, f.owner_id)
   order by (me.status = 'aprovado') desc nulls last,
            (select count(*) from public.social_forum_members m where m.forum_id = f.id and m.status = 'aprovado') desc,
            f.created_at desc, f.id
   limit least(greatest(coalesce(p_limit, 30), 1), 50)
  offset greatest(coalesce(p_offset, 0), 0);
$$;

drop function if exists public.social_create_forum(text, uuid, text, text, text);
create or replace function public.social_create_forum(
  p_id text, p_owner uuid, p_name text, p_description text, p_visibility text, p_photo text default null
)
returns void
language plpgsql
set search_path = ''
as $$
begin
  insert into public.social_forums (id, owner_id, name, description, visibility, photo_url)
  values (p_id, p_owner, p_name, nullif(p_description, ''), p_visibility, nullif(p_photo, ''));
  insert into public.social_forum_members (forum_id, user_id, role, status, approved_at)
  values (p_id, p_owner, 'dono', 'aprovado', now());
end;
$$;

do $$
declare f text;
begin
  foreach f in array array[
    'public.social_forums_page(uuid, text, boolean, integer, integer, text)',
    'public.social_create_forum(text, uuid, text, text, text, text)'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end $$;

notify pgrst, 'reload schema';
commit;
