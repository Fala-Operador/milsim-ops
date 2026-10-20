-- Reset de tudo que os usuários geraram (pedido do Isaac em 20/10/2026): operações, eventos,
-- inscrições, fóruns, comunidade, suporte, missões e o que deriva deles. Roda UMA vez, no
-- deploy do main. Faça um backup antes do merge (ação "Reset do banco" ou `supabase db dump`).
--
-- MANTÉM
--   contas: users (e auth.users), user_addresses, user_notification_settings,
--     user_modality_preferences, user_preferred_modalities, privacy_requests (LGPD)
--   perfil: operator_profiles, operator_profile_privacy, equipment (fotos e notas fiscais),
--     profile_photos, private_documents
--   organizações e a conta Stripe Connect vinculada (organization_payout_accounts)
--   configuração do site: platform_settings (taxa), home_sections, partners, badges,
--     reward_campaigns
-- APAGA
--   eventos com tudo que pende deles (inscrições, pagamentos, disputas, check-ins,
--   movimentações, cupons, cortesias, missões, comunicados, fóruns), operações externas do
--   perfil, solicitações de organizador, suporte, notificações, auditoria, comunidade,
--   impulsionamentos, métricas, campanhas de marketing, conquistas e vouchers (gerados de
--   novo pelo recálculo da progressão) e as referências a eventos que ficaram na
--   configuração (destaques da home, eventos elegíveis de campanhas de recompensa) e no
--   perfil (eventos ocultos, insígnia em destaque).
--
-- Proteção: se houver venda Stripe em modo live (checkout cs_live_), nada é apagado, para não
-- perder o vínculo de dinheiro real (estorno, disputa, repasse). Nada é apagado no Stripe nem
-- no Storage (imagens e anexos antigos ficam órfãos no bucket).
-- Num banco vazio não faz nada.

do $$
begin
  if exists (
    select 1 from public.registration_payments where checkout_session_id like 'cs_live_%'
  ) then
    raise exception 'Há vendas Stripe em modo live; o reset não apaga dinheiro real.'
      using errcode = 'MS409';
  end if;
end;
$$;

-- Eventos (as tabelas filhas caem junto por on delete cascade; as sem cascade vêm antes).
delete from public.registrations;
delete from public.complimentary_tickets;
delete from public.coupons;
delete from public.mission_submissions;
delete from public.missions;
delete from public.announcement_comments;
delete from public.announcements;
delete from public.forum_post_likes;
delete from public.forum_replies;
delete from public.community_reports;
delete from public.forum_posts;
delete from public.forum_preferences;
delete from public.community_restrictions;
delete from public.forums;
delete from public.support_tickets;
delete from public.events;

-- Demais dados gerados pelos usuários.
delete from public.external_operations;
delete from public.organizer_requests;
delete from public.user_support_reads;
delete from public.notifications;
delete from public.audit_logs;
delete from public.moderation_logs;
delete from public.community_visits;
delete from public.event_boosts;
delete from public.analytics_events;
delete from public.marketing_campaigns;
delete from public.badge_awards;
delete from public.vouchers;
delete from public.attendance_corrections;

-- Referências a eventos e conquistas que deixaram de existir.
delete from public.home_section_highlights;
delete from public.reward_campaign_eligible_events;
delete from public.operator_profile_hidden_events;
update public.operator_profiles set featured_badge_id = null where featured_badge_id is not null;

-- O servidor guarda a última exportação da base; a nova versão força a releitura.
update public.base_control set version = version + 1 where id = 1;
