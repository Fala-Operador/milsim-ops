-- Ficha de emergência do operador (opcional): tipo sanguíneo, alergias e contato de emergência.
-- Dado de saúde (LGPD, art. 11). Sem políticas: o navegador nunca lê o banco; o servidor
-- entrega a ficha só ao titular e, com a autorização dele, à gestão do evento na janela do
-- evento (src/lib/fichaEmergencia.ts + visão). Aditiva: uma tabela nova, filha de users (1:1).
-- Também avisa as contas já existentes (uma notificação por conta, sem repetir).
begin;

create table if not exists public.user_emergency_records (
  user_id uuid not null,
  blood_type text check (blood_type in ('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-')),
  allergies text check (char_length(allergies) <= 500),
  contact_name text check (char_length(contact_name) <= 120),
  contact_phone text check (contact_phone ~ '^[0-9]{10,13}$'),
  share_with_organizers boolean not null default false,
  consent_at timestamptz,
  updated_at timestamptz not null,
  primary key (user_id),
  foreign key (user_id) references public.users (id) on delete cascade deferrable initially deferred,
  -- Autorização sempre com data; sem autorização, sem data.
  check ((share_with_organizers and consent_at is not null) or (not share_with_organizers and consent_at is null))
);

revoke all on public.user_emergency_records from anon, authenticated;
grant select, insert, update, delete on public.user_emergency_records to service_role;
alter table public.user_emergency_records enable row level security;

-- Tabelas que compõem a BaseDados carregada pelo servidor (espelha TABELAS_BANCO; há teste).
create or replace function public.base_tables()
returns text[]
language sql
immutable
set search_path = ''
as $$
  select array[
    'users', 'user_addresses', 'user_notification_settings', 'user_support_reads',
    'user_modality_preferences', 'user_preferred_modalities', 'user_emergency_records', 'organizations',
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

-- Contas existentes sem ficha: um aviso para preencher (id fixo por conta, não repete).
insert into public.notifications (id, user_id, title, body, link, read, created_at)
select
  'not-ficha-emergencia-' || u.id,
  u.id,
  'Atualize sua ficha de emergência',
  'Agora você pode informar tipo sanguíneo, alergias e um contato de emergência. É opcional, e a organização só vê com a sua autorização, durante o evento.',
  '/app/perfil?aba=emergencia',
  false,
  now()
from public.users u
where u.active
  and not exists (select 1 from public.user_emergency_records r where r.user_id = u.id)
on conflict (id) do nothing;

-- Dados da base mudaram fora de apply_changes: invalida o cache dos servidores.
update public.base_control set version = version + 1 where id = 1;

notify pgrst, 'reload schema';
commit;
