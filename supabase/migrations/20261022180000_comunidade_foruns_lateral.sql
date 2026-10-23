-- Comunidade geral, fases 2 e 3.
--
-- Fase 2 — fóruns criados pelas contas: públicos (qualquer pessoa lê e entra na hora) ou
-- privados (só membros aprovados leem; entrar vira pedido para o dono/moderadores aprovarem).
-- Posts de fórum ficam só no fórum: não entram no feed geral nem no perfil do autor.
-- Como o resto da comunidade geral, fica FORA de base_tables(): leitura paginada no banco.
--
-- Fase 3 — lateral da comunidade: banners da página inicial e parceiros (patrocinadores)
-- marcados pela administração para aparecer também na comunidade (colunas na base).
-- Operações impulsionadas usam a posição "comunidade" do impulsionamento (texto livre).
-- Aditiva: tabelas, colunas opcionais e funções.
begin;

create table if not exists public.social_forums (
  id text primary key,
  owner_id uuid not null references public.users (id) on delete cascade deferrable initially deferred,
  name text not null check (char_length(name) between 3 and 60),
  description text check (char_length(description) <= 300),
  visibility text not null check (visibility in ('publico', 'privado')),
  status text not null default 'ativo' check (status in ('ativo', 'arquivado')),
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  archived_at timestamptz,
  archived_by uuid
);
-- Nome único entre os fóruns ativos (sem diferenciar maiúsculas).
create unique index if not exists social_forums_nome_idx on public.social_forums (lower(name)) where status = 'ativo';
create index if not exists social_forums_owner_idx on public.social_forums (owner_id) where status = 'ativo';

create table if not exists public.social_forum_members (
  forum_id text not null references public.social_forums (id) on delete cascade deferrable initially deferred,
  user_id uuid not null references public.users (id) on delete cascade deferrable initially deferred,
  role text not null check (role in ('dono', 'moderador', 'membro')),
  status text not null check (status in ('pendente', 'aprovado')),
  created_at timestamptz not null default now(),
  approved_at timestamptz,
  primary key (forum_id, user_id),
  -- Dono e moderador são sempre membros aprovados.
  check (role = 'membro' or status = 'aprovado')
);
create index if not exists social_forum_members_user_idx on public.social_forum_members (user_id, status);
create index if not exists social_forum_members_pend_idx on public.social_forum_members (forum_id, status);

alter table public.social_posts add column if not exists forum_id text
  references public.social_forums (id) on delete cascade deferrable initially deferred;
create index if not exists social_posts_forum_idx on public.social_posts (forum_id, created_at desc, id desc)
  where parent_id is null and status = 'publicado';

do $$
declare t text;
begin
  foreach t in array array['social_forums', 'social_forum_members'] loop
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('grant select, insert, update, delete on public.%I to service_role', t);
    execute format('alter table public.%I enable row level security', t);
  end loop;
  -- Realtime: toda tabela de public na publicação (o navegador continua sem ler nada).
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not (select puballtables from pg_publication where pubname = 'supabase_realtime') then
    foreach t in array array['social_forums', 'social_forum_members'] loop
      if not exists (select 1 from pg_publication_tables p
                      where p.pubname = 'supabase_realtime' and p.schemaname = 'public' and p.tablename = t) then
        execute format('alter publication supabase_realtime add table public.%I', t);
      end if;
    end loop;
  end if;
end $$;

-- Fase 3: o que a administração escolhe mostrar na lateral da comunidade (null = não).
alter table public.home_sections add column if not exists show_in_community boolean;
alter table public.partners add column if not exists show_in_community boolean;

-- Autor ativo e sem bloqueio com quem vê (dentro de um fórum vale o acesso ao fórum).
create or replace function public.social_author_ok(p_viewer uuid, p_author uuid)
returns boolean
language sql
stable
set search_path = ''
as $$
  select exists (
    select 1 from public.users a
     where a.id = p_author and a.active
       and not exists (select 1 from public.social_blocks b
                        where (b.blocker_id = a.id and b.blocked_id = p_viewer)
                           or (b.blocker_id = p_viewer and b.blocked_id = a.id))
  );
$$;

-- Quem lê um fórum: ativo e público, ou membro aprovado do privado.
create or replace function public.social_forum_readable(p_viewer uuid, p_forum text)
returns boolean
language sql
stable
set search_path = ''
as $$
  select exists (
    select 1 from public.social_forums f
     where f.id = p_forum and f.status = 'ativo'
       and (f.visibility = 'publico'
            or exists (select 1 from public.social_forum_members m
                        where m.forum_id = f.id and m.user_id = p_viewer and m.status = 'aprovado'))
  );
$$;

-- Visibilidade de um post (fora de fórum: regra do perfil; em fórum: acesso ao fórum).
create or replace function public.social_post_visible(p_viewer uuid, p_author uuid, p_forum text)
returns boolean
language sql
stable
set search_path = ''
as $$
  select case
    when p_forum is null then public.social_visible_author(p_viewer, p_author)
    else public.social_forum_readable(p_viewer, p_forum) and public.social_author_ok(p_viewer, p_author)
  end;
$$;

-- Nova assinatura com fórum: troca a da fase 1.
drop function if exists public.social_posts_page(uuid, uuid, text, text, timestamptz, text, integer);
create or replace function public.social_posts_page(
  p_viewer uuid,
  p_author uuid default null,
  p_parent text default null,
  p_post text default null,
  p_before timestamptz default null,
  p_before_id text default null,
  p_limit integer default 20,
  p_forum text default null
)
returns table (
  id text, author_id uuid, parent_id text, forum_id text, body text, created_at timestamptz, edited_at timestamptz,
  image_urls text[], image_alts text[], like_count bigint, reply_count bigint, liked boolean
)
language sql
stable
set search_path = ''
as $$
  select p.id, p.author_id, p.parent_id, p.forum_id, p.body, p.created_at, p.edited_at,
         coalesce((select array_agg(i.url order by i.position) from public.social_post_images i where i.post_id = p.id), '{}'::text[]),
         coalesce((select array_agg(coalesce(i.alt, '') order by i.position) from public.social_post_images i where i.post_id = p.id), '{}'::text[]),
         (select count(*) from public.social_likes l where l.post_id = p.id),
         (select count(*) from public.social_posts r
           where r.parent_id = p.id and r.status = 'publicado' and public.social_post_visible(p_viewer, r.author_id, r.forum_id)),
         coalesce(p_viewer is not null and exists (select 1 from public.social_likes l where l.post_id = p.id and l.user_id = p_viewer), false)
    from public.social_posts p
   where p.status = 'publicado'
     and public.social_post_visible(p_viewer, p.author_id, p.forum_id)
     and (p_post is null or p.id = p_post)
     -- Perfil do autor: só os posts fora de fórum (fórum privado não vaza pelo perfil).
     and (p_author is null or (p.author_id = p_author and p.forum_id is null))
     -- Detalhe; ou respostas de um post; ou o feed (geral = sem fórum; de um fórum = só ele).
     and (p_post is not null
          or (p_parent is not null and p.parent_id = p_parent)
          or (p_parent is null and p.parent_id is null and p.forum_id is not distinct from p_forum))
     and (p_before is null or (p.created_at, p.id) < (p_before, coalesce(p_before_id, '')))
   order by p.created_at desc, p.id desc
   limit least(greatest(coalesce(p_limit, 20), 1), 50);
$$;

-- Publica (com fotos) numa transação; resposta herda o fórum do post respondido.
drop function if exists public.social_create_post(text, uuid, text, text, text[], text[]);
create or replace function public.social_create_post(
  p_id text, p_author uuid, p_parent text, p_body text, p_urls text[], p_alts text[], p_forum text default null
)
returns void
language plpgsql
set search_path = ''
as $$
declare
  i integer;
  v_forum text := p_forum;
begin
  if p_parent is not null then
    select forum_id into v_forum from public.social_posts where id = p_parent;
  end if;
  insert into public.social_posts (id, author_id, parent_id, forum_id, body) values (p_id, p_author, p_parent, v_forum, p_body);
  for i in 1 .. coalesce(array_length(p_urls, 1), 0) loop
    insert into public.social_post_images (post_id, position, url, alt)
    values (p_id, i - 1, p_urls[i], nullif(p_alts[i], ''));
  end loop;
end;
$$;

-- Cria o fórum e já registra o dono como membro aprovado.
create or replace function public.social_create_forum(
  p_id text, p_owner uuid, p_name text, p_description text, p_visibility text
)
returns void
language plpgsql
set search_path = ''
as $$
begin
  insert into public.social_forums (id, owner_id, name, description, visibility)
  values (p_id, p_owner, p_name, nullif(p_description, ''), p_visibility);
  insert into public.social_forum_members (forum_id, user_id, role, status, approved_at)
  values (p_id, p_owner, 'dono', 'aprovado', now());
end;
$$;

-- Lista de fóruns ativos (nome e descrição de privados aparecem; o conteúdo não), com a
-- situação de quem vê. Os da pessoa primeiro; depois os mais movimentados.
create or replace function public.social_forums_page(
  p_viewer uuid, p_query text default null, p_only_mine boolean default false,
  p_limit integer default 30, p_offset integer default 0, p_forum text default null
)
returns table (
  id text, owner_id uuid, name text, description text, visibility text, created_at timestamptz,
  member_count bigint, pending_count bigint, my_role text, my_status text
)
language sql
stable
set search_path = ''
as $$
  select f.id, f.owner_id, f.name, f.description, f.visibility, f.created_at,
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

do $$
declare f text;
begin
  foreach f in array array[
    'public.social_author_ok(uuid, uuid)',
    'public.social_forum_readable(uuid, text)',
    'public.social_post_visible(uuid, uuid, text)',
    'public.social_posts_page(uuid, uuid, text, text, timestamptz, text, integer, text)',
    'public.social_create_post(text, uuid, text, text, text[], text[], text)',
    'public.social_create_forum(text, uuid, text, text, text)',
    'public.social_forums_page(uuid, text, boolean, integer, integer, text)'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end $$;

notify pgrst, 'reload schema';
commit;
