-- Comunidade geral: a visibilidade é aplicada no banco por social_posts_page() (o servidor não
-- refiltra). Perfil público: todos; privado: o próprio e seguidores aprovados; bloqueio esconde;
-- o feed não traz respostas; post ocultado some. Roda com `supabase test db`.
begin;
select plan(12);

-- Pessoas: A (pública), B (privada), C (quem vê).
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'a@teste.local'),
  ('00000000-0000-0000-0000-00000000000b', 'b@teste.local'),
  ('00000000-0000-0000-0000-00000000000c', 'c@teste.local');
insert into public.users (id, role, full_name, cpf, birth_date, email, whatsapp, terms_version, terms_accepted_at, active, social_private) values
  ('00000000-0000-0000-0000-00000000000a', 'participante', 'Ana', '00000000001', '1990-01-01', 'a@teste.local', '11999990001', 'v1', now(), true, null),
  ('00000000-0000-0000-0000-00000000000b', 'participante', 'Bia', '00000000002', '1990-01-01', 'b@teste.local', '11999990002', 'v1', now(), true, true),
  ('00000000-0000-0000-0000-00000000000c', 'participante', 'Caio', '00000000003', '1990-01-01', 'c@teste.local', '11999990003', 'v1', now(), true, null);

select public.social_create_post('pa', '00000000-0000-0000-0000-00000000000a', null, 'post da Ana', array['https://x/1.jpg'], array['foto']);
select public.social_create_post('pb', '00000000-0000-0000-0000-00000000000b', null, 'post da Bia', '{}', '{}');
select public.social_create_post('r1', '00000000-0000-0000-0000-00000000000c', 'pa', 'resposta do Caio', '{}', '{}');

select is(
  (select array_agg(id order by id) from public.social_posts_page(null)),
  array['pa'],
  'visitante vê só o perfil público, sem respostas no feed'
);

select is(
  (select image_urls from public.social_posts_page(null, p_post => 'pa')),
  array['https://x/1.jpg'],
  'post traz as fotos na ordem'
);

select is(
  (select reply_count from public.social_posts_page('00000000-0000-0000-0000-00000000000c', p_post => 'pa')),
  1::bigint,
  'contagem de respostas visíveis'
);

select is(
  (select array_agg(id) from public.social_posts_page('00000000-0000-0000-0000-00000000000a', p_parent => 'pa')),
  array['r1'],
  'respostas de um post'
);

select is(
  (select count(*) from public.social_posts_page('00000000-0000-0000-0000-00000000000c', p_post => 'pb')),
  0::bigint,
  'perfil privado: quem não segue não vê'
);

select is(
  (select count(*) from public.social_posts_page('00000000-0000-0000-0000-00000000000b', p_post => 'pb')),
  1::bigint,
  'perfil privado: a própria pessoa vê'
);

insert into public.social_follows (follower_id, followed_id, status)
values ('00000000-0000-0000-0000-00000000000c', '00000000-0000-0000-0000-00000000000b', 'pendente');
select is(
  (select count(*) from public.social_posts_page('00000000-0000-0000-0000-00000000000c', p_post => 'pb')),
  0::bigint,
  'pedido pendente ainda não libera'
);

update public.social_follows set status = 'aprovado', approved_at = now()
 where follower_id = '00000000-0000-0000-0000-00000000000c' and followed_id = '00000000-0000-0000-0000-00000000000b';
select is(
  (select count(*) from public.social_posts_page('00000000-0000-0000-0000-00000000000c', p_post => 'pb')),
  1::bigint,
  'seguidor aprovado vê o perfil privado'
);

insert into public.social_blocks (blocker_id, blocked_id)
values ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000c');
select is(
  (select count(*) from public.social_posts_page('00000000-0000-0000-0000-00000000000c', p_post => 'pa')),
  0::bigint,
  'bloqueio esconde os posts de quem bloqueou'
);
select is(
  (select reply_count from public.social_posts_page('00000000-0000-0000-0000-00000000000a', p_post => 'pa')),
  0::bigint,
  'e quem bloqueou deixa de ver as respostas da pessoa bloqueada'
);

update public.social_posts set status = 'oculto', hidden_reason = 'teste' where id = 'pb';
select is(
  (select count(*) from public.social_posts_page('00000000-0000-0000-0000-00000000000b', p_post => 'pb')),
  0::bigint,
  'post ocultado pela moderação some até para o autor'
);

select throws_ok(
  $$insert into public.social_posts (id, author_id, body) values ('longo', '00000000-0000-0000-0000-00000000000a', repeat('x', 221))$$,
  '23514',
  null,
  'mais de 220 caracteres é rejeitado pelo banco'
);

select * from finish();
rollback;
