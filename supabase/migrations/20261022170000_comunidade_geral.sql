-- Comunidade geral (estilo Twitter), fase 1: posts de até 220 caracteres com até 4 fotos,
-- respostas, curtidas, seguir (perfil privado = só seguidores aprovados), bloqueio e denúncia.
--
-- ATENÇÃO: estas tabelas ficam FORA de base_tables() de propósito. Um feed em que todos veem
-- todos não cabe na base inteira exportada para o servidor e filtrada por visão: aqui a leitura
-- é paginada por social_posts_page(), que aplica a regra de visibilidade no próprio banco, e a
-- escrita é feita pelo servidor (src/server/social.server.ts) com a identidade da sessão.
-- Só a preferência de perfil (users.social_private) vive na base, como dado da conta.
-- Aditiva: uma coluna opcional em users, tabelas e funções novas.
begin;

-- Perfil na comunidade: null/false = público; true = privado (só seguidores aprovados).
alter table public.users add column if not exists social_private boolean;
-- Contas de 15 a 17 anos começam privadas (podem mudar depois).
update public.users set social_private = true
 where social_private is null and birth_date > (current_date - interval '18 years');

create table if not exists public.social_posts (
  id text primary key,
  author_id uuid not null references public.users (id) on delete cascade deferrable initially deferred,
  -- Resposta: aponta para o post respondido (null = post do feed).
  parent_id text references public.social_posts (id) on delete cascade deferrable initially deferred,
  body text not null check (char_length(body) between 0 and 220),
  status text not null default 'publicado' check (status in ('publicado', 'oculto', 'removido')),
  hidden_reason text check (char_length(hidden_reason) <= 300),
  created_at timestamptz not null default now(),
  edited_at timestamptz
);
create index if not exists social_posts_feed_idx on public.social_posts (created_at desc, id desc) where parent_id is null and status = 'publicado';
create index if not exists social_posts_author_idx on public.social_posts (author_id, created_at desc);
create index if not exists social_posts_parent_idx on public.social_posts (parent_id, created_at desc);

create table if not exists public.social_post_images (
  post_id text not null references public.social_posts (id) on delete cascade deferrable initially deferred,
  position integer not null check (position between 0 and 3),
  url text not null,
  alt text check (char_length(alt) <= 200),
  primary key (post_id, position)
);

create table if not exists public.social_likes (
  post_id text not null references public.social_posts (id) on delete cascade deferrable initially deferred,
  user_id uuid not null references public.users (id) on delete cascade deferrable initially deferred,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);
create index if not exists social_likes_user_idx on public.social_likes (user_id);

create table if not exists public.social_follows (
  follower_id uuid not null references public.users (id) on delete cascade deferrable initially deferred,
  followed_id uuid not null references public.users (id) on delete cascade deferrable initially deferred,
  status text not null check (status in ('pendente', 'aprovado')),
  created_at timestamptz not null default now(),
  approved_at timestamptz,
  primary key (follower_id, followed_id),
  check (follower_id <> followed_id)
);
create index if not exists social_follows_followed_idx on public.social_follows (followed_id, status);

create table if not exists public.social_blocks (
  blocker_id uuid not null references public.users (id) on delete cascade deferrable initially deferred,
  blocked_id uuid not null references public.users (id) on delete cascade deferrable initially deferred,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);
create index if not exists social_blocks_blocked_idx on public.social_blocks (blocked_id);

create table if not exists public.social_reports (
  id text primary key,
  post_id text not null references public.social_posts (id) on delete cascade deferrable initially deferred,
  reporter_id uuid not null references public.users (id) on delete cascade deferrable initially deferred,
  reason text not null check (reason in ('adulto', 'violencia', 'drogas', 'ofensa', 'spam', 'dados_pessoais', 'outro')),
  details text check (char_length(details) <= 500),
  status text not null default 'pendente' check (status in ('pendente', 'procedente', 'descartada')),
  created_at timestamptz not null default now(),
  resolved_by uuid,
  resolved_at timestamptz
);
-- Uma denúncia em aberto por pessoa e post.
create unique index if not exists social_reports_aberta_idx on public.social_reports (post_id, reporter_id) where status = 'pendente';
create index if not exists social_reports_status_idx on public.social_reports (status, created_at);

do $$
declare t text;
begin
  foreach t in array array['social_posts', 'social_post_images', 'social_likes', 'social_follows', 'social_blocks', 'social_reports'] loop
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('grant select, insert, update, delete on public.%I to service_role', t);
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- Quem vê os posts de um autor: o próprio; qualquer pessoa se o perfil é público; seguidores
-- aprovados se é privado. Bloqueio (em qualquer sentido) esconde. Conta inativa some.
-- p_viewer null = visitante (só perfis públicos).
create or replace function public.social_visible_author(p_viewer uuid, p_author uuid)
returns boolean
language sql
stable
set search_path = ''
as $$
  select exists (
    select 1 from public.users a
     where a.id = p_author
       and a.active
       and (
         a.id = p_viewer
         or not coalesce(a.social_private, false)
         or exists (select 1 from public.social_follows f
                     where f.follower_id = p_viewer and f.followed_id = a.id and f.status = 'aprovado')
       )
       and not exists (select 1 from public.social_blocks b
                        where (b.blocker_id = a.id and b.blocked_id = p_viewer)
                           or (b.blocker_id = p_viewer and b.blocked_id = a.id))
  );
$$;

-- Página de posts visíveis para quem vê, do mais novo para o mais antigo (cursor = data + id).
--  * p_post: um post específico (detalhe);
--  * p_parent: as respostas de um post; sem p_parent nem p_post, só posts do feed (sem respostas);
--  * p_author: só os de um autor.
create or replace function public.social_posts_page(
  p_viewer uuid,
  p_author uuid default null,
  p_parent text default null,
  p_post text default null,
  p_before timestamptz default null,
  p_before_id text default null,
  p_limit integer default 20
)
returns table (
  id text, author_id uuid, parent_id text, body text, created_at timestamptz, edited_at timestamptz,
  image_urls text[], image_alts text[], like_count bigint, reply_count bigint, liked boolean
)
language sql
stable
set search_path = ''
as $$
  select p.id, p.author_id, p.parent_id, p.body, p.created_at, p.edited_at,
         coalesce((select array_agg(i.url order by i.position) from public.social_post_images i where i.post_id = p.id), '{}'::text[]),
         coalesce((select array_agg(coalesce(i.alt, '') order by i.position) from public.social_post_images i where i.post_id = p.id), '{}'::text[]),
         (select count(*) from public.social_likes l where l.post_id = p.id),
         (select count(*) from public.social_posts r
           where r.parent_id = p.id and r.status = 'publicado' and public.social_visible_author(p_viewer, r.author_id)),
         coalesce(p_viewer is not null and exists (select 1 from public.social_likes l where l.post_id = p.id and l.user_id = p_viewer), false)
    from public.social_posts p
   where p.status = 'publicado'
     and public.social_visible_author(p_viewer, p.author_id)
     and (p_post is null or p.id = p_post)
     and (p_author is null or p.author_id = p_author)
     and (p_post is not null or (p_parent is null and p.parent_id is null) or p.parent_id = p_parent)
     and (p_before is null or (p.created_at, p.id) < (p_before, coalesce(p_before_id, '')))
   order by p.created_at desc, p.id desc
   limit least(greatest(coalesce(p_limit, 20), 1), 50);
$$;

-- Publica um post (ou resposta) com as fotos numa transação só.
create or replace function public.social_create_post(
  p_id text, p_author uuid, p_parent text, p_body text, p_urls text[], p_alts text[]
)
returns void
language plpgsql
set search_path = ''
as $$
declare i integer;
begin
  insert into public.social_posts (id, author_id, parent_id, body) values (p_id, p_author, p_parent, p_body);
  for i in 1 .. coalesce(array_length(p_urls, 1), 0) loop
    insert into public.social_post_images (post_id, position, url, alt)
    values (p_id, i - 1, p_urls[i], nullif(p_alts[i], ''));
  end loop;
end;
$$;

do $$
declare f text;
begin
  foreach f in array array[
    'public.social_visible_author(uuid, uuid)',
    'public.social_posts_page(uuid, uuid, text, text, timestamptz, text, integer)',
    'public.social_create_post(text, uuid, text, text, text[], text[])'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end $$;

-- Realtime: toda tabela de public fica na publicação supabase_realtime (ver
-- 20261022153000_realtime_todas_as_tabelas.sql). O navegador continua sem ler nada: RLS sem
-- policies e nenhum grant para anon/authenticated. "for all tables" já cobre (e não aceita add).
do $$
declare t text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not (select puballtables from pg_publication where pubname = 'supabase_realtime') then
    foreach t in array array['social_posts', 'social_post_images', 'social_likes', 'social_follows', 'social_blocks', 'social_reports'] loop
      if not exists (select 1 from pg_publication_tables p
                      where p.pubname = 'supabase_realtime' and p.schemaname = 'public' and p.tablename = t) then
        execute format('alter publication supabase_realtime add table public.%I', t);
      end if;
    end loop;
  end if;
end $$;

-- users.social_private mudou por SQL (contas menores): invalida o cache dos servidores.
update public.base_control set version = version + 1 where id = 1;

notify pgrst, 'reload schema';
commit;
