-- Perfil do operador, equipamentos, galeria, insígnias, campanhas e vouchers.
-- Mesma convenção do esquema inicial: RLS ligado, sem políticas, acesso só pelo servidor.
-- Aplicada pelo workflow de deploy (antes, à mão com psql).
-- Idempotente: o banco de produção já recebeu esta migration à mão, então rodar de novo
-- só completa o que faltar. Os dados demonstrativos entram apenas na primeira aplicação.
create temp table _perfil_operador_reaplicada as
  select to_regclass('public.perfis_operador') is not null as sim;

create table if not exists public.perfis_operador (
  usuario_id uuid primary key references public.usuarios (id) on delete cascade deferrable initially deferred,
  callsign text,
  bio text,
  squad text,
  instagram text,
  capa_url text,
  insignia_destaque text,
  privacidade jsonb not null,
  operacoes_ocultas jsonb not null default '[]'::jsonb,
  intro_vista boolean not null default false,
  atualizado_em timestamptz not null default now()
);

create table if not exists public.equipamentos (
  id text primary key,
  usuario_id uuid not null references public.usuarios (id) on delete cascade deferrable initially deferred,
  marca text not null,
  tipo text not null check (tipo in ('spring', 'hpa', 'aeg', 'gbbr')),
  modelo text not null,
  apelido text,
  observacoes text,
  fotos jsonb not null default '[]'::jsonb,
  nota jsonb,
  visivel boolean not null default false,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index if not exists equipamentos_usuario_id_idx on public.equipamentos (usuario_id);

create table if not exists public.fotos_perfil (
  id text primary key,
  usuario_id uuid not null references public.usuarios (id) on delete cascade deferrable initially deferred,
  url text not null,
  legenda text,
  alt text,
  visivel boolean not null default false,
  criado_em timestamptz not null default now()
);
create index if not exists fotos_perfil_usuario_id_idx on public.fotos_perfil (usuario_id);

create table if not exists public.insignias (
  id text primary key,
  nome text not null,
  descricao text not null,
  icone text not null,
  criterio jsonb not null,
  ativa boolean not null default true,
  versao integer not null default 1,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create table if not exists public.concessoes_insignia (
  id text primary key,
  usuario_id uuid not null references public.usuarios (id) on delete cascade deferrable initially deferred,
  insignia_id text not null references public.insignias (id) on delete cascade deferrable initially deferred,
  versao_regra integer not null,
  criterio jsonb not null,
  conquistada_em timestamptz not null,
  revogada_em timestamptz,
  motivo_revogacao text
);
create index if not exists concessoes_insignia_usuario_id_idx on public.concessoes_insignia (usuario_id);

create table if not exists public.campanhas_recompensa (
  id text primary key,
  nome text not null,
  descricao text not null,
  insignia_id text not null references public.insignias (id) deferrable initially deferred,
  organizacao_id text not null references public.organizacoes (id) deferrable initially deferred,
  tipo text not null check (tipo in ('percentual', 'fixo', 'gratuito')),
  valor integer not null default 0,
  eventos_elegiveis jsonb not null default '[]'::jsonb,
  tipos_elegiveis jsonb not null default '[]'::jsonb,
  maximo integer not null check (maximo > 0),
  limite_por_participante integer not null default 1 check (limite_por_participante > 0),
  inicio_em timestamptz not null,
  conquistar_ate timestamptz not null,
  resgatar_ate timestamptz not null,
  regras text not null default '',
  aceita_anteriores boolean not null default false,
  ativa boolean not null default true,
  versao integer not null default 1,
  autorizacao text,
  criado_por uuid not null,
  criado_em timestamptz not null default now()
);

create table if not exists public.vouchers (
  id text primary key,
  campanha_id text not null references public.campanhas_recompensa (id) on delete cascade deferrable initially deferred,
  campanha_versao integer not null,
  usuario_id uuid not null references public.usuarios (id) on delete cascade deferrable initially deferred,
  concessao_id text not null,
  codigo text not null unique,
  status text not null check (status in ('disponivel', 'utilizada', 'expirada', 'revogada')),
  concedido_em timestamptz not null,
  inscricao_id text,
  usado_em timestamptz,
  motivo text,
  ocorrencia text
);
create index if not exists vouchers_usuario_id_idx on public.vouchers (usuario_id);

create table if not exists public.correcoes_participacao (
  id text primary key,
  usuario_id uuid not null references public.usuarios (id) on delete cascade deferrable initially deferred,
  evento_id text not null references public.eventos (id) on delete cascade deferrable initially deferred,
  tipo text not null check (tipo in ('invalidar', 'validar')),
  justificativa text not null,
  autor_id uuid not null,
  criado_em timestamptz not null default now()
);

alter table public.inscricoes add column if not exists voucher_id text;

-- Notas fiscais: fora da base transacional (nunca vão para a visão do navegador).
create table if not exists public.documentos_privados (
  id text primary key,
  usuario_id uuid not null references public.usuarios (id) on delete cascade,
  equipamento_id text not null unique,
  caminho text not null,
  nome text not null,
  tipo text not null,
  tamanho integer not null,
  enviado_em timestamptz not null default now()
);

do $$
declare t text;
begin
  foreach t in array array['perfis_operador', 'equipamentos', 'fotos_perfil', 'insignias', 'concessoes_insignia',
    'campanhas_recompensa', 'vouchers', 'correcoes_participacao', 'documentos_privados'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('grant select, insert, update, delete on public.%I to service_role', t);
  end loop;
end
$$;

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
    'campanhas_recompensa', 'vouchers', 'correcoes_participacao'
  ]::text[];
$$;
revoke all on function public.tabelas_base() from public, anon, authenticated;
grant execute on function public.tabelas_base() to service_role;

-- Bucket PRIVADO para notas fiscais (acesso só por URL assinada gerada pelo servidor).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('documentos', 'documentos', false, 5242880,
        array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
on conflict (id) do nothing;

-- ===================== Catálogo inicial de insígnias =====================
insert into public.insignias (id, nome, descricao, icone, criterio) values
  ('ins-primeira', 'Primeira operação', 'Concluiu a primeira operação com presença confirmada.', '🎖️', '{"tipo":"operacoes","meta":1}'),
  ('ins-frequente', 'Operador frequente', 'Concluiu cinco operações.', '🪖', '{"tipo":"operacoes","meta":5}'),
  ('ins-veterano', 'Veterano de campo', 'Concluiu dez operações.', '🏅', '{"tipo":"operacoes","meta":10}'),
  ('ins-regional', 'Explorador regional', 'Participou de operações em três estados.', '🧭', '{"tipo":"estados","meta":3}'),
  ('ins-nacional', 'Explorador nacional', 'Participou de operações em cinco estados.', '🗺️', '{"tipo":"estados","meta":5}'),
  ('ins-versatil', 'Versátil', 'Participou de três modalidades diferentes.', '🎯', '{"tipo":"modalidades","meta":3}')
on conflict (id) do nothing;

-- ===================== Dados demonstrativos =====================
-- Só entram onde a seed já criou a organização demonstrativa (num banco novo, como o dos
-- testes pgTAP, os eventos ficam de fora).
insert into public.eventos (id, organizacao_id, nome, descricao_resumida, enredo, inicio_em, fim_em, fuso, local, endereco,
  cidade, uf, capacidade_total, exercitos, tipos, lotes, cronograma, modalidade, status)
select v.id, v.org, v.nome, v.resumo, v.enredo, v.inicio::timestamptz, v.fim::timestamptz, v.fuso, v.local, v.endereco,
  v.cidade, v.uf, v.cap, v.exercitos::jsonb, v.tipos::jsonb, v.lotes::jsonb, v.cronograma::jsonb, v.modalidade, v.status
from (values
  ('evt-pantanal', 'org-bravo', 'Operação Pantanal', 'Real action nas matas ciliares de Bonito.', 'Patrulhas ribeirinhas e resgate de suprimentos.',
   '2026-05-09 11:00:00+00', '2026-05-10 20:00:00+00', 'America/Campo_Grande', 'Fazenda Rio Formoso', 'Rodovia MS-178, km 12',
   'Bonito', 'MS', 60, '[{"id":"ex-p1","nome":"Onça","capacidade":30},{"id":"ex-p2","nome":"Tuiuiú","capacidade":30}]',
   '[{"id":"tp-p1","nome":"Ingresso Padrão","precoBaseCentavos":12000,"quantidadeMaxima":60}]', '[]', '[]', 'real_action', 'concluido'),
  ('evt-sertao', 'org-bravo', 'Operação Sertão', 'Speedsoft em arena coberta.', 'Rodadas rápidas em formato de torneio.',
   '2026-03-14 12:00:00+00', '2026-03-14 21:00:00+00', 'America/Recife', 'Arena Velho Chico', 'Av. Cardoso de Sá, 900',
   'Petrolina', 'PE', 40, '[{"id":"ex-s1","nome":"Mandacaru","capacidade":20},{"id":"ex-s2","nome":"Carcará","capacidade":20}]',
   '[{"id":"tp-s1","nome":"Ingresso Padrão","precoBaseCentavos":8000,"quantidadeMaxima":40}]', '[]', '[]', 'speedsoft', 'concluido')
) as v(id, org, nome, resumo, enredo, inicio, fim, fuso, local, endereco, cidade, uf, cap, exercitos, tipos, lotes, cronograma, modalidade, status)
where exists (select 1 from public.organizacoes o where o.id = v.org)
  and not (select sim from _perfil_operador_reaplicada)
on conflict (id) do nothing;

insert into public.inscricoes (id, evento_id, usuario_id, tipo_id, exercito_id, codigo, status, origem, valor_centavos, desconto_centavos, criado_em)
select v.id, v.ev, u.id, v.tp, v.ex, v.cod, 'confirmada', v.orig, v.val, 0, v.em::timestamptz
from (values
  ('ins-demo-pantanal', 'evt-pantanal', 'tp-p1', 'ex-p1', 'PN-2026-01', 'plataforma', 12000, '2026-04-01 12:00:00+00'),
  ('ins-demo-sertao', 'evt-sertao', 'tp-s1', 'ex-s2', 'SR-2026-01', 'cortesia', 0, '2026-02-20 12:00:00+00')
) as v(id, ev, tp, ex, cod, orig, val, em)
join public.usuarios u on u.email = 'usuario@teste.com.br'
where not (select sim from _perfil_operador_reaplicada)
on conflict (id) do nothing;

insert into public.checkins (id, evento_id, inscricao_id, tipo, origem, operador_id, operador_nome, dispositivo_id, em, sync)
select v.id, v.ev, v.ins, 'entrada', v.orig, 'demo', 'Portaria', 'disp-demo', v.em::timestamptz, 'sincronizado'
from (values
  ('ck-demo-trovao', 'evt-trovao', 'ins-hist-1', 'qr', '2026-08-14 16:00:00+00'),
  ('ck-demo-pantanal', 'evt-pantanal', 'ins-demo-pantanal', 'qr', '2026-05-09 11:20:00+00'),
  ('ck-demo-sertao', 'evt-sertao', 'ins-demo-sertao', 'codigo', '2026-03-14 12:10:00+00')
) as v(id, ev, ins, orig, em)
where exists (select 1 from public.inscricoes i where i.id = v.ins)
  and not (select sim from _perfil_operador_reaplicada)
on conflict (id) do nothing;

insert into public.campanhas_recompensa (id, nome, descricao, insignia_id, organizacao_id, tipo, valor, eventos_elegiveis,
  maximo, limite_por_participante, inicio_em, conquistar_ate, resgatar_ate, regras, aceita_anteriores, criado_por)
select 'cmp-explorador', 'Explorador ganha 20%', '20% de desconto para quem conquistou a insígnia Explorador regional.',
  'ins-regional', 'org-bravo', 'percentual', 20, '["evt-serra-verde","evt-escudo-norte"]', 50, 1,
  '2026-01-01 00:00:00+00', '2026-12-31 23:59:00+00', '2027-03-31 23:59:00+00',
  'Válido para um ingresso. Não acumula com cupom. Não reserva vaga.', true, u.id
from public.usuarios u where u.email = 'organizador@teste.com.br'
  and not (select sim from _perfil_operador_reaplicada)
on conflict (id) do nothing;

update public.controle_base set versao = versao + 1 where id = 1;

alter table public.vouchers add column if not exists beneficio jsonb not null;
drop table _perfil_operador_reaplicada;
