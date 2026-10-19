-- Conflito de versão sem retentativa infinita.
--
-- Problema: aplicar_mudancas sinalizava conflito de versão com SQLSTATE 40001
-- (serialization_failure). O PostgREST repete automaticamente transações que falham com
-- 40001 — sem limite. Como a versão lida nunca volta a valer, cada conflito virava um
-- loop eterno (~1.700 tentativas/s) prendendo uma conexão do pool; com ~10 conflitos o
-- pool esgotava e toda a API passava a dar timeout ("Timed out acquiring connection").
--
-- Correção: código próprio da aplicação (MS409), que o PostgREST devolve na hora como
-- erro comum. O servidor (src/server/unidade.server.ts) reconhece MS409, relê a base e
-- tenta de novo com espera crescente — com limite de tentativas.
-- CREATE OR REPLACE preserva os grants existentes (execute só para service_role).
begin;
CREATE OR REPLACE FUNCTION public.aplicar_mudancas(p_mudancas jsonb, p_versao bigint)
 RETURNS bigint
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
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
    raise exception 'conflito_versao' using errcode = 'MS409';
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
$function$

;
commit;
