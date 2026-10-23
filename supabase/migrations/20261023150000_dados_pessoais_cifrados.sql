-- Dados pessoais cifrados (AES-256-GCM no servidor, src/server/cifraDados.ts; colunas em
-- COLUNAS_CIFRADAS de src/lib/esquemaBanco.ts). O banco passa a guardar só texto cifrado
-- nessas colunas, então nada em SQL pode depender do valor delas:
--  - users.birth_date vira text (a data cifrada não é mais do tipo date);
--  - saem as restrições unique/check dessas colunas (CPF e e-mail únicos passam para os
--    índices cegos cpf_hash/email_hash; formatos e limites continuam validados no servidor,
--    src/lib/fichaEmergencia.ts e src/services/auth.ts).
-- Não altera nenhum dado: as linhas existentes continuam em texto puro até o servidor, já
-- com PERSONAL_DATA_ENCRYPTION_KEY, regravá-las cifradas (na primeira leitura após o deploy).
begin;

alter table public.users alter column birth_date type text using to_char(birth_date, 'YYYY-MM-DD');

alter table public.users add column if not exists cpf_hash text;
alter table public.users add column if not exists email_hash text;
create unique index if not exists users_cpf_hash_key on public.users (cpf_hash);
create unique index if not exists users_email_hash_key on public.users (email_hash);

-- Restrições unique/check que tocam alguma coluna cifrada (nomes variam entre bancos antigos
-- e novos, por isso a busca no catálogo). As de chave primária/estrangeira não tocam essas colunas.
do $$
declare
  r record;
begin
  for r in
    select c.conrelid::regclass as tabela, c.conname
      from pg_catalog.pg_constraint c
      join (values
        ('users', array['full_name', 'cpf', 'birth_date', 'email', 'whatsapp']),
        ('user_addresses', array['postal_code', 'street', 'number', 'complement', 'district', 'city', 'state']),
        ('user_emergency_records', array['blood_type', 'allergies', 'contact_name', 'contact_phone']),
        ('organizations', array['cnpj', 'phone']),
        ('organizer_requests', array['cnpj', 'phone']),
        ('complimentary_tickets', array['guest_name', 'guest_email'])
      ) as cifradas(tabela, colunas) on c.conrelid = format('public.%I', cifradas.tabela)::regclass
     where c.contype in ('u', 'c')
       and exists (
         select 1 from pg_catalog.pg_attribute a
          where a.attrelid = c.conrelid and a.attnum = any (c.conkey) and a.attname::text = any (cifradas.colunas)
       )
  loop
    execute format('alter table %s drop constraint %I', r.tabela, r.conname);
  end loop;
end
$$;

-- Índices comuns sobre essas colunas também não servem mais.
do $$
declare
  r record;
begin
  for r in
    select i.indexrelid::regclass as indice
      from pg_catalog.pg_index i
      join pg_catalog.pg_class t on t.oid = i.indrelid
      join pg_catalog.pg_namespace n on n.oid = t.relnamespace and n.nspname = 'public'
     where not i.indisprimary
       and not exists (select 1 from pg_catalog.pg_constraint c where c.conindid = i.indexrelid)
       and exists (
         select 1 from pg_catalog.pg_attribute a
          where a.attrelid = i.indrelid and a.attnum = any (i.indkey)
            and (t.relname, a.attname::text) in (
              ('users', 'full_name'), ('users', 'cpf'), ('users', 'birth_date'), ('users', 'email'), ('users', 'whatsapp'),
              ('organizations', 'cnpj'), ('organizer_requests', 'cnpj'),
              ('complimentary_tickets', 'guest_email'), ('complimentary_tickets', 'guest_name')
            )
       )
  loop
    execute format('drop index %s', r.indice);
  end loop;
end
$$;

-- O servidor guarda a última exportação da base; a nova versão força a releitura.
update public.base_control set version = version + 1 where id = 1;

notify pgrst, 'reload schema';
commit;
