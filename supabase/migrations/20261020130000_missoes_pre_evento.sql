-- Missões pré-evento com pontos, placar por exército e prêmios (todas as fases):
--  * missions: pontos, abertura, rascunho, código secreto, meta coletiva, aviso de lançamento;
--  * mission_submissions: foto, exército de quem enviou, pontos, avaliação, destaque;
--  * mission_campaigns (+ prêmios e resultado congelado): uma por evento.
-- Aditiva: colunas novas opcionais (com padrão para as linhas existentes) e tabelas novas.
-- As missões já existentes continuam publicadas e valendo 0 ponto.
begin;

alter table public.missions add column if not exists points integer not null default 0 check (points between 0 and 10000);
alter table public.missions add column if not exists opens_at timestamptz;
alter table public.missions add column if not exists draft boolean not null default false;
alter table public.missions add column if not exists answer_code text;
alter table public.missions add column if not exists team_goal_percent integer check (team_goal_percent between 1 and 100);
alter table public.missions add column if not exists team_goal_bonus integer check (team_goal_bonus between 0 and 10000);
alter table public.missions add column if not exists announced_at timestamptz;
alter table public.missions add column if not exists created_at timestamptz;

alter table public.missions drop constraint if exists missoes_tipo_entrega_check;
alter table public.missions drop constraint if exists missions_submission_type_check;
alter table public.missions add constraint missions_submission_type_check
  check (submission_type in ('confirmacao', 'texto', 'imagem', 'codigo'));

alter table public.mission_submissions add column if not exists attachment_url text;
alter table public.mission_submissions add column if not exists faction_id text;
alter table public.mission_submissions add column if not exists awarded_points integer;
alter table public.mission_submissions add column if not exists reviewed_by text;
alter table public.mission_submissions add column if not exists reviewed_at timestamptz;
alter table public.mission_submissions add column if not exists allow_highlight boolean not null default false;
alter table public.mission_submissions add column if not exists highlighted_at timestamptz;

alter table public.mission_submissions drop constraint if exists entregas_status_check;
alter table public.mission_submissions drop constraint if exists mission_submissions_status_check;
alter table public.mission_submissions add constraint mission_submissions_status_check
  check (status in ('disponivel', 'enviada', 'concluida', 'ajustes_solicitados', 'prazo_encerrado', 'recusada'));

create table if not exists public.mission_campaigns (
  event_id text primary key references public.events (id) on delete cascade deferrable initially deferred,
  closed_at timestamptz,
  closed_by text,
  updated_at timestamptz not null default now()
);
create table if not exists public.mission_campaign_prizes (
  event_id text not null,
  position integer not null,
  place integer,
  description text,
  primary key (event_id, position),
  foreign key (event_id) references public.mission_campaigns (event_id) on delete cascade deferrable initially deferred
);
create table if not exists public.mission_campaign_results (
  event_id text not null,
  position integer not null,
  faction_id text,
  place integer,
  points double precision,
  members integer,
  average double precision,
  team_bonus double precision,
  total double precision,
  prize text,
  primary key (event_id, position),
  foreign key (event_id) references public.mission_campaigns (event_id) on delete cascade deferrable initially deferred
);

do $$
declare t text;
begin
  foreach t in array array['mission_campaigns', 'mission_campaign_prizes', 'mission_campaign_results'] loop
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
    'attendance_corrections', 'platform_settings', 'community_visits'
  ]::text[];
$$;
revoke all on function public.base_tables() from public, anon, authenticated;
grant execute on function public.base_tables() to service_role;

notify pgrst, 'reload schema';
commit;
