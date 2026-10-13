-- MilSim Ops — esquema inicial.
--
-- Modelo de acesso: o navegador NUNCA acessa o banco. Todas as leituras e escritas
-- passam pelas server functions do monólito (TanStack Start), que autenticam o
-- usuário (Supabase Auth) e aplicam as regras de negócio. Por isso:
--   * RLS está ativo em todas as tabelas e não há policies para anon/authenticated
--     (negação total como defesa em profundidade);
--   * somente service_role recebe privilégios nas tabelas e nas funções.
--
-- Convenções: colunas em snake_case espelham os campos camelCase dos tipos em
-- src/lib/domain/types.ts; listas e objetos aninhados ficam em jsonb. Ids são
-- texto gerado pela aplicação (prefixo + tempo), exceto usuarios.id = auth.users.id.
-- Chaves estrangeiras são DEFERRABLE INITIALLY DEFERRED para que aplicar_mudancas
-- grave um lote de alterações em qualquer ordem dentro da mesma transação.

-- ===================== Contas =====================

create table public.usuarios (
  id uuid primary key references auth.users (id) on delete cascade,
  perfil text not null check (perfil in ('admin', 'participante', 'organizador')),
  nome_completo text not null,
  cpf text not null unique,
  data_nascimento date not null,
  email text not null unique,
  whatsapp text not null,
  endereco jsonb not null,
  instagram text,
  squad text,
  foto_url text,
  nome_exibicao text,
  silencio_notificacoes jsonb,
  tema text check (tema in ('dark', 'light')),
  preferencias_modalidade jsonb,
  autorizacao_responsavel text check (autorizacao_responsavel in ('pendente', 'aprovada', 'nao_aplicavel')),
  autorizacao_promocional boolean not null default false,
  aceite_termos_versao text not null,
  aceite_termos_em timestamptz not null,
  organizacao_id text,
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);

create table public.organizacoes (
  id text primary key,
  nome text not null,
  cnpj text,
  instagram text,
  telefone text not null,
  responsavel_id uuid not null references public.usuarios (id) deferrable initially deferred,
  status text not null check (status in ('ativa', 'suspensa')),
  criado_em timestamptz not null default now()
);
create index organizacoes_responsavel_id_idx on public.organizacoes (responsavel_id);

alter table public.usuarios
  add constraint usuarios_organizacao_id_fkey foreign key (organizacao_id)
  references public.organizacoes (id) deferrable initially deferred;
create index usuarios_organizacao_id_idx on public.usuarios (organizacao_id);

create table public.solicitacoes (
  id text primary key,
  usuario_id uuid not null references public.usuarios (id) deferrable initially deferred,
  possui_cnpj boolean not null,
  cnpj text,
  nome_organizacao text not null,
  instagram text,
  telefone text not null,
  status text not null check (status in ('pendente', 'em_analise', 'ajustes_solicitados', 'aprovada', 'rejeitada')),
  observacao_admin text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index solicitacoes_usuario_id_idx on public.solicitacoes (usuario_id);

-- ===================== Eventos e vendas =====================

create table public.eventos (
  id text primary key,
  organizacao_id text not null references public.organizacoes (id) deferrable initially deferred,
  nome text not null,
  descricao_resumida text not null,
  enredo text not null,
  inicio_em timestamptz not null,
  fim_em timestamptz not null,
  fuso text not null,
  local text not null,
  endereco text not null,
  cidade text not null,
  uf text not null,
  capacidade_total integer not null check (capacidade_total >= 0),
  imagem_url text,
  exercitos jsonb not null default '[]',
  tipos jsonb not null default '[]',
  lotes jsonb not null default '[]',
  cronograma jsonb not null default '[]',
  regras jsonb,
  modalidade text,
  whatsapp_grupo_url text,
  status text not null check (status in ('rascunho', 'publicado', 'inscricoes_encerradas', 'concluido', 'cancelado', 'arquivado')),
  criado_em timestamptz not null default now()
);
create index eventos_organizacao_id_idx on public.eventos (organizacao_id);
create index eventos_status_inicio_idx on public.eventos (status, inicio_em);

create table public.cupons (
  id text primary key,
  evento_id text not null references public.eventos (id) on delete cascade deferrable initially deferred,
  codigo text not null,
  desconto_percentual integer not null check (desconto_percentual between 1 and 100),
  valido_de timestamptz not null,
  valido_ate timestamptz not null,
  limite_usos integer not null check (limite_usos >= 0),
  usos integer not null default 0 check (usos >= 0),
  tipos_elegiveis jsonb not null default '[]',
  ativo boolean not null default true,
  unique (evento_id, codigo)
);

create table public.cortesias (
  id text primary key,
  evento_id text not null references public.eventos (id) on delete cascade deferrable initially deferred,
  nome_convidado text not null,
  email_convidado text not null,
  tipo_id text not null,
  exercito_id text,
  validade timestamptz not null,
  codigo text not null,
  status text not null check (status in ('pendente', 'resgatada', 'expirada', 'revogada')),
  criado_em timestamptz not null default now()
);
create index cortesias_evento_id_idx on public.cortesias (evento_id);

create table public.inscricoes (
  id text primary key,
  evento_id text not null references public.eventos (id) on delete cascade deferrable initially deferred,
  usuario_id uuid not null references public.usuarios (id) deferrable initially deferred,
  tipo_id text not null,
  lote_id text,
  exercito_id text not null,
  codigo text not null unique,
  token_entrada text unique,
  status text not null check (status in ('confirmada', 'cancelada', 'estornada')),
  origem text not null check (origem in ('plataforma', 'cortesia', 'organizador', 'admin')),
  valor_centavos integer not null check (valor_centavos >= 0),
  desconto_centavos integer not null default 0 check (desconto_centavos >= 0),
  cupom_id text references public.cupons (id) deferrable initially deferred,
  cortesia_id text references public.cortesias (id) deferrable initially deferred,
  criado_em timestamptz not null default now(),
  cancelado_em timestamptz,
  motivo_cancelamento text
);
create index inscricoes_evento_id_idx on public.inscricoes (evento_id);
create index inscricoes_usuario_id_idx on public.inscricoes (usuario_id);
create index inscricoes_cupom_id_idx on public.inscricoes (cupom_id);
create index inscricoes_cortesia_id_idx on public.inscricoes (cortesia_id);
-- Regra de negócio garantida também no banco: uma inscrição ativa por pessoa e evento.
create unique index inscricoes_uma_ativa_por_evento on public.inscricoes (evento_id, usuario_id)
  where status = 'confirmada';

create table public.movimentacoes (
  id text primary key,
  evento_id text not null references public.eventos (id) on delete cascade deferrable initially deferred,
  inscricao_id text references public.inscricoes (id) on delete cascade deferrable initially deferred,
  tipo text not null check (tipo in ('inscricao', 'desconto_cupom', 'ajuste', 'estorno')),
  valor_centavos integer not null,
  descricao text not null,
  criado_em timestamptz not null default now()
);
create index movimentacoes_evento_id_idx on public.movimentacoes (evento_id);
create index movimentacoes_inscricao_id_idx on public.movimentacoes (inscricao_id);

-- ===================== Engajamento =====================

create table public.missoes (
  id text primary key,
  evento_id text not null references public.eventos (id) on delete cascade deferrable initially deferred,
  titulo text not null,
  descricao text not null,
  imagem_url text,
  prazo timestamptz not null,
  publico text not null,
  tipo_entrega text not null check (tipo_entrega in ('confirmacao', 'texto', 'imagem')),
  exige_aprovacao boolean not null default false
);
create index missoes_evento_id_idx on public.missoes (evento_id);

create table public.entregas (
  id text primary key,
  missao_id text not null references public.missoes (id) on delete cascade deferrable initially deferred,
  usuario_id uuid not null references public.usuarios (id) deferrable initially deferred,
  status text not null check (status in ('disponivel', 'enviada', 'concluida', 'ajustes_solicitados', 'prazo_encerrado')),
  conteudo text,
  enviado_em timestamptz not null,
  avaliacao text
);
create index entregas_missao_id_idx on public.entregas (missao_id);
create index entregas_usuario_id_idx on public.entregas (usuario_id);

create table public.comunicados (
  id text primary key,
  evento_id text not null references public.eventos (id) on delete cascade deferrable initially deferred,
  autor_id uuid not null references public.usuarios (id) deferrable initially deferred,
  titulo text not null,
  corpo text not null,
  imagem_url text,
  fixado boolean not null default false,
  segmento_exercito_id text,
  criado_em timestamptz not null default now()
);
create index comunicados_evento_id_idx on public.comunicados (evento_id);
create index comunicados_autor_id_idx on public.comunicados (autor_id);

create table public.comentarios (
  id text primary key,
  comunicado_id text not null references public.comunicados (id) on delete cascade deferrable initially deferred,
  autor_id uuid not null references public.usuarios (id) deferrable initially deferred,
  corpo text not null,
  criado_em timestamptz not null default now()
);
create index comentarios_comunicado_id_idx on public.comentarios (comunicado_id);
create index comentarios_autor_id_idx on public.comentarios (autor_id);

-- ===================== Suporte e governança =====================

create table public.chamados (
  id text primary key,
  evento_id text references public.eventos (id) on delete set null deferrable initially deferred,
  solicitante_id uuid not null references public.usuarios (id) deferrable initially deferred,
  assunto text not null,
  categoria text not null,
  descricao text not null,
  status text not null check (status in ('aberto', 'em_atendimento', 'aguardando_participante', 'resolvido', 'fechado')),
  mensagens jsonb not null default '[]',
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index chamados_evento_id_idx on public.chamados (evento_id);
create index chamados_solicitante_id_idx on public.chamados (solicitante_id);

create table public.notificacoes (
  id text primary key,
  usuario_id uuid not null references public.usuarios (id) on delete cascade deferrable initially deferred,
  titulo text not null,
  corpo text not null,
  link text,
  lida boolean not null default false,
  criado_em timestamptz not null default now()
);
create index notificacoes_usuario_id_idx on public.notificacoes (usuario_id, criado_em desc);

-- Autor e entidade são texto livre: a trilha de auditoria sobrevive à remoção do alvo.
create table public.auditoria (
  id text primary key,
  autor_id text not null,
  acao text not null,
  entidade text not null,
  entidade_id text not null,
  justificativa text,
  criado_em timestamptz not null default now()
);
create index auditoria_criado_em_idx on public.auditoria (criado_em desc);

create table public.privacidade (
  id text primary key,
  usuario_id uuid not null references public.usuarios (id) on delete cascade deferrable initially deferred,
  tipo text not null check (tipo in ('acesso', 'correcao', 'exportacao', 'exclusao')),
  detalhes text not null,
  status text not null check (status in ('aberta', 'respondida')),
  resposta text,
  criado_em timestamptz not null default now()
);
create index privacidade_usuario_id_idx on public.privacidade (usuario_id);

-- ===================== Comunidade =====================

create table public.foruns (
  id text primary key,
  evento_id text not null references public.eventos (id) on delete cascade deferrable initially deferred,
  nome text not null,
  descricao text not null,
  icone text,
  regras text,
  ordem integer not null,
  publico text not null,
  publicacao text not null check (publicacao in ('membros', 'gestao')),
  respostas text not null check (respostas in ('membros', 'gestao')),
  status text not null check (status in ('ativo', 'arquivado')),
  criado_em timestamptz not null default now()
);
create index foruns_evento_id_idx on public.foruns (evento_id);

create table public.publicacoes (
  id text primary key,
  forum_id text not null references public.foruns (id) on delete cascade deferrable initially deferred,
  evento_id text not null references public.eventos (id) on delete cascade deferrable initially deferred,
  autor_id uuid not null references public.usuarios (id) deferrable initially deferred,
  texto text not null,
  imagens jsonb not null default '[]',
  fixada boolean not null default false,
  importante boolean not null default false,
  respostas_fechadas boolean not null default false,
  oculta boolean not null default false,
  motivo_ocultacao text,
  removida_pelo_autor boolean not null default false,
  editado_em timestamptz,
  criado_em timestamptz not null default now()
);
create index publicacoes_forum_id_idx on public.publicacoes (forum_id);
create index publicacoes_evento_id_idx on public.publicacoes (evento_id, criado_em desc);
create index publicacoes_autor_id_idx on public.publicacoes (autor_id);

create table public.respostas (
  id text primary key,
  publicacao_id text not null references public.publicacoes (id) on delete cascade deferrable initially deferred,
  autor_id uuid not null references public.usuarios (id) deferrable initially deferred,
  texto text not null,
  imagem jsonb,
  oculta boolean not null default false,
  motivo_ocultacao text,
  editado_em timestamptz,
  criado_em timestamptz not null default now()
);
create index respostas_publicacao_id_idx on public.respostas (publicacao_id);
create index respostas_autor_id_idx on public.respostas (autor_id);

create table public.curtidas (
  id text primary key,
  publicacao_id text not null references public.publicacoes (id) on delete cascade deferrable initially deferred,
  usuario_id uuid not null references public.usuarios (id) deferrable initially deferred,
  unique (publicacao_id, usuario_id)
);
create index curtidas_usuario_id_idx on public.curtidas (usuario_id);

create table public.denuncias (
  id text primary key,
  evento_id text not null references public.eventos (id) on delete cascade deferrable initially deferred,
  alvo text not null check (alvo in ('publicacao', 'resposta')),
  alvo_id text not null,
  denunciante_id uuid not null references public.usuarios (id) deferrable initially deferred,
  motivo text not null check (motivo in ('ofensa', 'spam', 'dados_pessoais', 'inadequado', 'outro')),
  descricao text,
  status text not null check (status in ('pendente', 'procedente', 'descartada')),
  criado_em timestamptz not null default now()
);
create index denuncias_evento_id_idx on public.denuncias (evento_id);
create index denuncias_denunciante_id_idx on public.denuncias (denunciante_id);

create table public.preferencias_forum (
  usuario_id uuid not null references public.usuarios (id) on delete cascade deferrable initially deferred,
  forum_id text not null references public.foruns (id) on delete cascade deferrable initially deferred,
  modo text not null check (modo in ('seguir', 'silenciar')),
  primary key (usuario_id, forum_id)
);
create index preferencias_forum_forum_id_idx on public.preferencias_forum (forum_id);

create table public.restricoes_comunidade (
  id text primary key,
  evento_id text not null references public.eventos (id) on delete cascade deferrable initially deferred,
  usuario_id uuid not null references public.usuarios (id) deferrable initially deferred,
  justificativa text not null,
  ativa boolean not null default true,
  criado_em timestamptz not null default now()
);
create index restricoes_comunidade_evento_id_idx on public.restricoes_comunidade (evento_id);
create index restricoes_comunidade_usuario_id_idx on public.restricoes_comunidade (usuario_id);

create table public.moderacao (
  id text primary key,
  evento_id text not null references public.eventos (id) on delete cascade deferrable initially deferred,
  autor_id text not null,
  acao text not null,
  alvo_id text not null,
  justificativa text,
  criado_em timestamptz not null default now()
);
create index moderacao_evento_id_idx on public.moderacao (evento_id);

create table public.visitas_comunidade (
  usuario_id uuid not null references public.usuarios (id) on delete cascade deferrable initially deferred,
  evento_id text not null references public.eventos (id) on delete cascade deferrable initially deferred,
  visto_em timestamptz not null,
  primary key (usuario_id, evento_id)
);
create index visitas_comunidade_evento_id_idx on public.visitas_comunidade (evento_id);

-- ===================== Página inicial e divulgação =====================

create table public.parceiros (
  id text primary key,
  nome text not null,
  tipo text not null check (tipo in ('patrocinador', 'apoiador', 'ambos')),
  descricao text,
  logo_url text,
  texto_alt text not null,
  links jsonb not null default '[]',
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create table public.secoes_inicio (
  id text primary key,
  titulo text not null,
  subtitulo text,
  tipo text not null check (tipo in ('destaques', 'regional', 'patrocinadores', 'apoiadores', 'banner')),
  abrangencia jsonb not null,
  ordem integer not null,
  status text not null check (status in ('rascunho', 'publicada', 'desativada')),
  agendamento jsonb not null default '{}',
  layout text not null check (layout in ('grade', 'carrossel', 'banner')),
  modo text not null check (modo in ('manual', 'automatico')),
  destaques jsonb not null default '[]',
  automatica jsonb,
  mostrar_esgotados boolean not null default false,
  parceiros jsonb not null default '[]',
  tamanho_logo text not null check (tamanho_logo in ('p', 'm', 'g')),
  mostrar_descricoes boolean not null default false,
  superficie_logo text not null check (superficie_logo in ('nenhuma', 'clara', 'escura')),
  banner jsonb,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

-- ===================== Check-in =====================

-- Base de referência do credenciamento (o "servidor" da portaria).
create table public.checkins (
  id text primary key,
  evento_id text not null references public.eventos (id) on delete cascade deferrable initially deferred,
  inscricao_id text not null references public.inscricoes (id) on delete cascade deferrable initially deferred,
  tipo text not null check (tipo in ('entrada', 'reversao')),
  revertido_id text,
  origem text not null check (origem in ('qr', 'codigo', 'manual')),
  motivo text,
  operador_id text not null,
  operador_nome text not null,
  dispositivo_id text not null,
  em timestamptz not null,
  sync text not null check (sync in ('pendente', 'sincronizado', 'conflito', 'falhou')),
  conflito text
);
create index checkins_evento_id_idx on public.checkins (evento_id);
create index checkins_inscricao_id_idx on public.checkins (inscricao_id);

-- ===================== Métricas (append-only, fora da base transacional) =====================

create table public.campanhas (
  id text primary key,
  evento_id text not null references public.eventos (id) on delete cascade,
  nome text not null,
  origem text not null check (origem in ('instagram', 'whatsapp', 'parceiro', 'lancamento', 'outro')),
  criado_em timestamptz not null default now()
);
create index campanhas_evento_id_idx on public.campanhas (evento_id);

-- Registros anônimos: somente ids aleatórios, nunca dados pessoais.
create table public.analytics_registros (
  id text primary key,
  tipo text not null check (tipo in ('exibicao', 'clique', 'visita', 'clique_inscrever', 'inscricao_iniciada', 'inscricao_confirmada', 'cortesia_resgatada', 'inclusao_administrativa')),
  evento_id text not null references public.eventos (id) on delete cascade,
  visitante_id text not null,
  sessao_id text not null,
  origem text not null check (origem in ('inicio', 'destaques', 'regional', 'busca', 'campanha', 'direto')),
  secao_id text,
  posicao integer,
  campanha_id text,
  fluxo_id text,
  inscricao_id text,
  em bigint not null
);
create index analytics_registros_evento_em_idx on public.analytics_registros (evento_id, em);

-- ===================== Controle de concorrência =====================

-- Versão global da base: cada lote de mudanças só é aplicado se ninguém gravou
-- desde a leitura (controle otimista). Em conflito, o servidor relê e repete.
create table public.controle_base (
  id smallint primary key default 1 check (id = 1),
  versao bigint not null default 0
);
insert into public.controle_base (id, versao) values (1, 0);

-- ===================== Segurança =====================

do $$
declare
  t text;
begin
  for t in
    select tablename from pg_catalog.pg_tables where schemaname = 'public'
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('grant select, insert, update, delete on public.%I to service_role', t);
  end loop;
end
$$;

-- ===================== Funções da base transacional =====================

-- Tabelas que compõem a BaseDados carregada pelo servidor (ordem irrelevante:
-- as FKs são adiadas até o commit).
create function public.tabelas_base()
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
    'moderacao', 'visitas_comunidade', 'parceiros', 'secoes_inicio', 'checkins'
  ]::text[];
$$;

-- Lê a base inteira em uma só ida ao banco: { versao, tabelas: { nome: [linhas] } }.
create function public.exportar_base()
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  v_tabelas jsonb := '{}'::jsonb;
  v_linhas jsonb;
  v_versao bigint;
  t text;
begin
  select versao into v_versao from public.controle_base where id = 1;
  foreach t in array public.tabelas_base() loop
    execute format('select coalesce(jsonb_agg(to_jsonb(x)), ''[]''::jsonb) from public.%I x', t)
      into v_linhas;
    v_tabelas := v_tabelas || jsonb_build_object(t, v_linhas);
  end loop;
  return jsonb_build_object('versao', v_versao, 'tabelas', v_tabelas);
end;
$$;

-- Aplica um lote { tabela: { gravar: [linhas], excluir: [chaves] } } numa única
-- transação, desde que a versão lida ainda seja a atual. Devolve a nova versão.
create function public.aplicar_mudancas(p_mudancas jsonb, p_versao bigint)
returns bigint
language plpgsql
set search_path = ''
as $$
declare
  v_nova bigint;
  t text;
  v_rel regclass;
  v_pk text[];
  v_cols text[];
  v_gravar jsonb;
  v_excluir jsonb;
begin
  update public.controle_base set versao = versao + 1
    where id = 1 and versao = p_versao
    returning versao into v_nova;
  if v_nova is null then
    raise exception 'conflito_versao' using errcode = '40001';
  end if;

  for t in select jsonb_object_keys(p_mudancas) loop
    if not (t = any (public.tabelas_base())) then
      raise exception 'tabela não permitida: %', t;
    end if;
    v_rel := format('public.%I', t)::regclass;

    select array_agg(a.attname::text order by array_position(i.indkey::int2[], a.attnum))
      into v_pk
      from pg_catalog.pg_index i
      join pg_catalog.pg_attribute a on a.attrelid = i.indrelid and a.attnum = any (i.indkey)
     where i.indrelid = v_rel and i.indisprimary;

    select array_agg(a.attname::text order by a.attnum)
      into v_cols
      from pg_catalog.pg_attribute a
     where a.attrelid = v_rel and a.attnum > 0 and not a.attisdropped
       and not (a.attname::text = any (v_pk));

    v_excluir := coalesce(p_mudancas -> t -> 'excluir', '[]'::jsonb);
    if jsonb_array_length(v_excluir) > 0 then
      execute format(
        'delete from %s d using jsonb_populate_recordset(null::%s, $1) x where %s',
        v_rel, v_rel,
        (select string_agg(format('d.%1$I = x.%1$I', c), ' and ') from unnest(v_pk) c)
      ) using v_excluir;
    end if;

    v_gravar := coalesce(p_mudancas -> t -> 'gravar', '[]'::jsonb);
    if jsonb_array_length(v_gravar) > 0 then
      execute format(
        'insert into %s select * from jsonb_populate_recordset(null::%s, $1) '
        'on conflict (%s) do update set (%s) = row(%s)',
        v_rel, v_rel,
        (select string_agg(format('%I', c), ', ') from unnest(v_pk) c),
        (select string_agg(format('%I', c), ', ') from unnest(v_cols) c),
        (select string_agg(format('excluded.%I', c), ', ') from unnest(v_cols) c)
      ) using v_gravar;
    end if;
  end loop;

  return v_nova;
end;
$$;

revoke all on function public.tabelas_base() from public, anon, authenticated;
revoke all on function public.exportar_base() from public, anon, authenticated;
revoke all on function public.aplicar_mudancas(jsonb, bigint) from public, anon, authenticated;
grant execute on function public.tabelas_base() to service_role;
grant execute on function public.exportar_base() to service_role;
grant execute on function public.aplicar_mudancas(jsonb, bigint) to service_role;

-- ===================== Storage =====================

-- Imagens e PDFs enviados (fotos, capas, logos, banners, imagens de posts, manuais).
-- Leitura pública por URL; upload somente pelo servidor (service_role).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('midia', 'midia', true, 10485760,
        array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'])
on conflict (id) do nothing;
