-- Fóruns da comunidade geral: visibilidade aplicada no banco por social_posts_page().
-- Público: qualquer pessoa lê; privado: só membros aprovados; arquivado: ninguém.
-- Posts de fórum não entram no feed geral nem no perfil do autor; respostas herdam o fórum.
begin;
select plan(13);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000f1', 'dono@teste.local'),
  ('00000000-0000-0000-0000-0000000000f2', 'membro@teste.local'),
  ('00000000-0000-0000-0000-0000000000f3', 'fora@teste.local');
insert into public.users (id, role, full_name, cpf, birth_date, email, whatsapp, terms_version, terms_accepted_at, active) values
  ('00000000-0000-0000-0000-0000000000f1', 'participante', 'Dono', '00000000011', '1990-01-01', 'dono@teste.local', '11999990011', 'v1', now(), true),
  ('00000000-0000-0000-0000-0000000000f2', 'participante', 'Membro', '00000000012', '1990-01-01', 'membro@teste.local', '11999990012', 'v1', now(), true),
  ('00000000-0000-0000-0000-0000000000f3', 'participante', 'Fora', '00000000013', '1990-01-01', 'fora@teste.local', '11999990013', 'v1', now(), true);

select public.social_create_forum('fp', '00000000-0000-0000-0000-0000000000f1', 'Fórum Público', 'aberto', 'publico');
select public.social_create_forum('fv', '00000000-0000-0000-0000-0000000000f1', 'Fórum Privado', '', 'privado');

select is(
  (select role || '/' || status from public.social_forum_members where forum_id = 'fv' and user_id = '00000000-0000-0000-0000-0000000000f1'),
  'dono/aprovado',
  'quem cria o fórum entra como dono aprovado'
);

select public.social_create_post('pp', '00000000-0000-0000-0000-0000000000f1', null, 'no público', '{}', '{}', 'fp');
select public.social_create_post('pv', '00000000-0000-0000-0000-0000000000f1', null, 'no privado', '{}', '{}', 'fv');
select public.social_create_post('rv', '00000000-0000-0000-0000-0000000000f1', 'pv', 'resposta no privado', '{}', '{}');
select public.social_create_post('pg', '00000000-0000-0000-0000-0000000000f1', null, 'no feed geral', '{}', '{}');

select is((select forum_id from public.social_posts where id = 'rv'), 'fv', 'resposta herda o fórum do post respondido');

select is(
  (select array_agg(id) from public.social_posts_page(null)),
  array['pg'],
  'feed geral não traz posts de fórum'
);

select is(
  (select array_agg(id) from public.social_posts_page('00000000-0000-0000-0000-0000000000f3', p_author => '00000000-0000-0000-0000-0000000000f1')),
  array['pg'],
  'perfil do autor não traz posts de fórum'
);

select is(
  (select array_agg(id) from public.social_posts_page(null, p_forum => 'fp')),
  array['pp'],
  'fórum público: visitante lê'
);

select is(
  (select count(*) from public.social_posts_page('00000000-0000-0000-0000-0000000000f3', p_forum => 'fv')),
  0::bigint,
  'fórum privado: quem não é membro não lê'
);

insert into public.social_forum_members (forum_id, user_id, role, status)
values ('fv', '00000000-0000-0000-0000-0000000000f2', 'membro', 'pendente');
select is(
  (select count(*) from public.social_posts_page('00000000-0000-0000-0000-0000000000f2', p_post => 'pv')),
  0::bigint,
  'pedido pendente não lê o fórum privado'
);

update public.social_forum_members set status = 'aprovado', approved_at = now()
 where forum_id = 'fv' and user_id = '00000000-0000-0000-0000-0000000000f2';
select is(
  (select reply_count from public.social_posts_page('00000000-0000-0000-0000-0000000000f2', p_post => 'pv')),
  1::bigint,
  'membro aprovado lê o fórum privado e as respostas'
);

select is(
  (select name from public.social_forums_page('00000000-0000-0000-0000-0000000000f3', p_forum => 'fv')),
  'Fórum Privado',
  'fórum privado aparece na lista (nome), mesmo sem acesso ao conteúdo'
);

insert into public.social_forum_members (forum_id, user_id, role, status)
values ('fv', '00000000-0000-0000-0000-0000000000f3', 'membro', 'pendente');
select is(
  (select pending_count from public.social_forums_page('00000000-0000-0000-0000-0000000000f1', p_forum => 'fv')),
  1::bigint,
  'dono vê o número de pedidos pendentes'
);
select is(
  (select pending_count from public.social_forums_page('00000000-0000-0000-0000-0000000000f2', p_forum => 'fv')),
  0::bigint,
  'membro comum não vê o número de pedidos'
);

select throws_ok(
  $$select public.social_create_forum('dup', '00000000-0000-0000-0000-0000000000f2', 'fórum público', '', 'publico')$$,
  '23505',
  null,
  'nome de fórum ativo é único (sem diferenciar maiúsculas)'
);

update public.social_forums set status = 'arquivado' where id = 'fp';
select is(
  (select count(*) from public.social_posts_page(null, p_forum => 'fp')),
  0::bigint,
  'fórum arquivado ninguém lê'
);

select * from finish();
rollback;
