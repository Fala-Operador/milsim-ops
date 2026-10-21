-- Impulsos comprados pelas organizações (24h, 3, 5, 7, 15 e 30 dias):
--  * boost_plans: preço, validade e venda de cada tipo, editados pela administração (sem
--    linha = valor padrão do código, src/lib/impulsos.ts);
--  * boost_purchases: cada impulso comprado, com o pagamento no Stripe, a validade para usar
--    (expires_at) e o evento/campanha em que foi usado;
--  * event_boosts.purchase_id: campanha gerada por um impulso comprado (vazio = concedida
--    pela administração).
-- Aditiva: só tabelas novas e uma coluna opcional.
begin;

create table if not exists public.boost_plans (
  id text primary key check (id in ('24h', '3d', '5d', '7d', '15d', '30d')),
  price_cents integer not null check (price_cents between 0 and 1000000),
  validity_days integer not null check (validity_days between 1 and 365),
  active boolean not null,
  updated_at timestamptz not null,
  updated_by text not null
);

create table if not exists public.boost_purchases (
  id text primary key,
  organization_id text not null references public.organizations (id) on delete cascade deferrable initially deferred,
  plan_id text not null check (plan_id in ('24h', '3d', '5d', '7d', '15d', '30d')),
  purchased_by text not null,
  duration_hours integer not null check (duration_hours > 0),
  price_cents integer not null check (price_cents >= 0),
  validity_days integer not null check (validity_days > 0),
  status text not null check (status in ('aguardando_pagamento', 'processando', 'disponivel', 'usado', 'cancelado', 'reembolsado')),
  created_at timestamptz not null,
  paid_at timestamptz,
  expires_at timestamptz,
  checkout_session_id text,
  payment_intent_id text,
  used_at timestamptz,
  event_id text,
  boost_id text,
  closed_at timestamptz
);
create index if not exists boost_purchases_organization_idx on public.boost_purchases (organization_id);

alter table public.event_boosts add column if not exists purchase_id text;

do $$
declare t text;
begin
  foreach t in array array['boost_plans', 'boost_purchases'] loop
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('grant select, insert, update, delete on public.%I to service_role', t);
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- Tabelas que compõem a BaseDados carregada pelo servidor (espelha TABELAS_BANCO; há teste).
create or replace function public.base_tables()
returns text[]
language sql
immutable
set search_path = ''
as $$
  select array[
    'users', 'user_addresses', 'user_notification_settings', 'user_support_reads',
    'user_modality_preferences', 'user_preferred_modalities', 'organizations',
    'organization_payout_accounts', 'organization_payout_requirements', 'organizer_requests', 'events',
    'event_images', 'event_factions', 'event_ticket_types', 'event_ticket_batches',
    'event_ticket_batch_items', 'event_schedule_items', 'event_rules_documents', 'registrations',
    'registration_payments', 'registration_payment_disputes', 'coupons',
    'coupon_eligible_ticket_types', 'complimentary_tickets', 'missions', 'mission_submissions', 'mission_campaigns', 'mission_campaign_prizes',
    'mission_campaign_results',
    'announcements', 'announcement_comments', 'support_tickets', 'support_ticket_messages',
    'support_message_shared_attachments', 'notifications', 'financial_transactions', 'audit_logs',
    'privacy_requests', 'forums', 'forum_posts', 'forum_post_images', 'forum_replies',
    'forum_reply_images', 'forum_post_likes', 'community_reports', 'forum_preferences',
    'community_restrictions', 'moderation_logs', 'partners', 'partner_links', 'home_sections',
    'home_section_geo_scopes', 'home_section_schedules', 'home_section_highlights',
    'home_section_auto_selections', 'home_section_partners', 'home_section_banners', 'event_boosts',
    'event_boost_placements', 'event_boost_geo_scopes', 'check_ins', 'operator_profiles',
    'operator_profile_privacy', 'operator_profile_hidden_events', 'equipment', 'equipment_photos',
    'equipment_invoices', 'profile_photos', 'external_operations', 'badges', 'badge_criteria', 'badge_awards',
    'badge_award_criteria', 'reward_campaigns', 'reward_campaign_eligible_events',
    'reward_campaign_eligible_ticket_types', 'vouchers', 'voucher_benefits',
    'voucher_benefit_eligible_events', 'voucher_benefit_eligible_ticket_types',
    'attendance_corrections', 'platform_settings', 'community_visits', 'boost_plans', 'boost_purchases'
  ]::text[];
$$;
revoke all on function public.base_tables() from public, anon, authenticated;
grant execute on function public.base_tables() to service_role;

notify pgrst, 'reload schema';
commit;
