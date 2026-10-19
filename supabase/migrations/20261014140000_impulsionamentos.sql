-- Campanhas de impulsionamento de operações (concedidas pela administração).
-- Executar no editor SQL do banco. Sem policies: só o servidor (service_role) acessa.
begin;

create table if not exists public.impulsionamentos (
  id text primary key,
  evento_id text not null,
  nome text not null,
  objetivo text not null check (objetivo in ('divulgacao', 'inscricoes')),
  posicoes jsonb not null default '[]'::jsonb,
  abrangencia jsonb not null default '{"escopo":"nacional"}'::jsonb,
  inicio_em timestamptz not null,
  fim_em timestamptz not null,
  fuso text not null default 'America/Sao_Paulo',
  prioridade text not null default 'normal' check (prioridade in ('normal', 'alta')),
  ordem integer not null default 0,
  imagem_promocional text,
  chamada text,
  status text not null default 'rascunho' check (status in ('rascunho', 'ativo', 'pausado', 'encerrado')),
  criado_por text not null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index if not exists impulsionamentos_evento_idx on public.impulsionamentos (evento_id);

revoke all on public.impulsionamentos from anon, authenticated;
grant select, insert, update, delete on public.impulsionamentos to service_role;
alter table public.impulsionamentos enable row level security;

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
    'campanhas_recompensa', 'vouchers', 'correcoes_participacao', 'impulsionamentos'
  ]::text[];
$$;
revoke all on function public.tabelas_base() from public, anon, authenticated;
grant execute on function public.tabelas_base() to service_role;

notify pgrst, 'reload schema';
commit;
