-- Repasse das vendas às organizações (Stripe Connect Express):
--  1) organizacoes.recebimento (jsonb): situação da conta de recebimento de cada organização
--     (contaId acct_..., status, transferências, saques, pendências);
--  2) configuracoes_plataforma: registro único "plataforma" com a taxa retida nas vendas
--     repassadas, editada em Administração → Pagamentos.
-- Aplicar junto com 20261019150000_pagamentos_stripe.sql. Sem dados novos (a taxa nasce
-- quando a administração salva pela primeira vez), por isso não incrementa controle_base.versao.
begin;

alter table public.organizacoes add column if not exists recebimento jsonb;

create table if not exists public.configuracoes_plataforma (
  id text primary key check (id = 'plataforma'),
  taxa_plataforma_percentual numeric(5, 2) not null default 0
    check (taxa_plataforma_percentual >= 0 and taxa_plataforma_percentual <= 50),
  atualizado_em timestamptz not null default now(),
  atualizado_por text not null
);

revoke all on public.configuracoes_plataforma from anon, authenticated;
grant select, insert, update, delete on public.configuracoes_plataforma to service_role;
alter table public.configuracoes_plataforma enable row level security;

create or replace function public.tabelas_base()
returns text[]
language sql
immutable
set search_path = ''
as $$
  select array[
    'usuarios', 'organizacoes', 'solicitacoes', 'eventos', 'cupons', 'cortesias',
    'inscricoes', 'movimentacoes', 'missoes', 'entregas', 'comunicados', 'comentarios',
    'chamados', 'notificacoes', 'auditoria', 'privacidade', 'foruns', 'publicacoes',
    'respostas', 'curtidas', 'denuncias', 'preferencias_forum', 'restricoes_comunidade',
    'moderacao', 'visitas_comunidade', 'parceiros', 'secoes_inicio', 'checkins',
    'perfis_operador', 'equipamentos', 'fotos_perfil', 'insignias', 'concessoes_insignia',
    'campanhas_recompensa', 'vouchers', 'correcoes_participacao', 'impulsionamentos',
    'configuracoes_plataforma'
  ]::text[];
$$;
revoke all on function public.tabelas_base() from public, anon, authenticated;
grant execute on function public.tabelas_base() to service_role;

notify pgrst, 'reload schema';
commit;
