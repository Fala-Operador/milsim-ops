-- Reset dos dados de teste do banco (decisão do Isaac em 19/10/2026), rodado pela ação
-- manual .github/workflows/reset-banco.yml, que salva um backup antes.
--
-- MANTÉM
--   contas: users (e auth.users), privacy_requests, operator_profiles, equipment,
--     profile_photos, private_documents
--   organizações, com a conta Stripe Connect vinculada (organization_payout_accounts)
--   configuração do site: platform_settings (taxa), home_sections, partners, badges,
--     reward_campaigns
--   vendas Stripe: eventos com inscrição paga pelo Stripe, essas inscrições, as movimentações,
--     check-ins e cupons delas, e os vouchers que elas usaram
-- APAGA todo o resto (demais eventos e inscrições, cortesias, comunidade, suporte,
--   notificações, auditoria, missões, comunicados, impulsionamentos, métricas e conquistas
--   calculadas, que voltam a ser geradas pelo recálculo da progressão).
-- As tabelas filhas (listas e objetos de cada registro) caem junto por on delete cascade.
--
-- Nada é apagado no Stripe nem no Storage. Tudo numa transação: qualquer erro desfaz tudo.
begin;

create temp table _inscricoes_stripe on commit drop as
  select r.id, r.event_id, r.coupon_id, r.voucher_id
  from public.registrations r
  join public.registration_payments p on p.registration_id = r.id
  where p.payment_intent_id is not null
     or p.status in ('pago', 'processando', 'estorno_pendente', 'estornado');

create temp table _eventos_stripe on commit drop as
  select distinct event_id as id from _inscricoes_stripe;

-- Dentro dos eventos mantidos, só as inscrições pagas e o que pertence a elas.
delete from public.check_ins where registration_id not in (select id from _inscricoes_stripe);
delete from public.financial_transactions where registration_id is null or registration_id not in (select id from _inscricoes_stripe);
delete from public.registrations where id not in (select id from _inscricoes_stripe);
delete from public.complimentary_tickets;
delete from public.coupons where event_id not in (select id from _eventos_stripe);

-- Os demais eventos (as tabelas filhas caem junto por on delete cascade).
delete from public.events where id not in (select id from _eventos_stripe);

-- Dados de teste sem relação com as vendas.
delete from public.organizer_requests;
delete from public.mission_submissions;
delete from public.missions;
delete from public.announcement_comments;
delete from public.announcements;
delete from public.support_tickets;
delete from public.notifications;
delete from public.audit_logs;
delete from public.forum_post_likes;
delete from public.forum_replies;
delete from public.community_reports;
delete from public.forum_posts;
delete from public.forum_preferences;
delete from public.community_restrictions;
delete from public.moderation_logs;
delete from public.forums;
delete from public.community_visits;
delete from public.event_boosts;
delete from public.analytics_events;
delete from public.marketing_campaigns;
delete from public.badge_awards;
delete from public.attendance_corrections;
delete from public.vouchers where id not in (select voucher_id from _inscricoes_stripe where voucher_id is not null);

-- O servidor guarda a última exportação da base; a nova versão força a releitura.
update public.base_control set version = version + 1 where id = 1;

-- Conferência no log da ação.
select
  (select count(*) from public.users) as usuarios,
  (select count(*) from public.organizations) as organizacoes,
  (select count(*) from public.events) as eventos_mantidos,
  (select count(*) from public.registrations) as inscricoes_stripe_mantidas;

commit;
