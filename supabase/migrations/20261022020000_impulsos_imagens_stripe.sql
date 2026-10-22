-- Imagens dos tipos de impulso e catálogo do Stripe:
--  * boost_plans.image_url: imagem do tipo (vitrine da organização e produto no Stripe). As
--    padrão ficam no site em /impulsos/<tipo>.jpg; a administração pode trocar por outra
--    (enviada ao bucket "midia");
--  * boost_plans.stripe_product_id / stripe_price_id / stripe_synced_at: produto e preço do
--    tipo no catálogo do Stripe da plataforma, gravados pelo servidor ao sincronizar.
-- Cria os seis tipos com os valores iniciais (preço sugerido, 30 dias, à venda) quando ainda
-- não existem; tipos já salvos pela administração só ganham a imagem padrão.
begin;

alter table public.boost_plans add column if not exists image_url text;
alter table public.boost_plans add column if not exists stripe_product_id text;
alter table public.boost_plans add column if not exists stripe_price_id text;
alter table public.boost_plans add column if not exists stripe_synced_at timestamptz;

insert into public.boost_plans (id, price_cents, validity_days, active, image_url, updated_at, updated_by)
values
  ('24h', 990, 30, true, '/impulsos/24h.jpg', now(), 'sistema'),
  ('3d', 2490, 30, true, '/impulsos/3d.jpg', now(), 'sistema'),
  ('5d', 3490, 30, true, '/impulsos/5d.jpg', now(), 'sistema'),
  ('7d', 4490, 30, true, '/impulsos/7d.jpg', now(), 'sistema'),
  ('15d', 8490, 30, true, '/impulsos/15d.jpg', now(), 'sistema'),
  ('30d', 14990, 30, true, '/impulsos/30d.jpg', now(), 'sistema')
on conflict (id) do update set image_url = coalesce(public.boost_plans.image_url, excluded.image_url);

-- Dados da base mudaram fora de apply_changes: invalida o cache dos servidores.
update public.base_control set version = version + 1 where id = 1;

notify pgrst, 'reload schema';
commit;
