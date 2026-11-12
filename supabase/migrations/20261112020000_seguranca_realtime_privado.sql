-- Correções de segurança (análise de 2026-11-12):
--  1. Sinal de versão em canal PRIVADO. No canal público, qualquer pessoa com a chave
--     publicável podia enviar uma versão falsa e fazer todos os navegadores abertos buscarem a
--     visão de novo (rajada contra o servidor). Agora só o banco envia (realtime.send com
--     private = true) e anon/authenticated só podem LER o tópico "base" (nenhuma policy de insert).
--  2. Funções que o navegador nunca usa deixam de ser executáveis por anon/authenticated:
--     pg_net (net.http_*) e a função de event trigger public.rls_auto_enable().
-- Não altera dados.
begin;

create or replace function public.notify_base_version()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.version is distinct from old.version
     and to_regprocedure('realtime.send(jsonb, text, text, boolean)') is not null then
    begin
      perform realtime.send(jsonb_build_object('version', new.version), 'versao', 'base', true);
    exception when others then
      raise warning 'Realtime: falha ao avisar a versão %: %', new.version, sqlerrm;
    end;
  end if;
  return null;
end;
$$;
revoke all on function public.notify_base_version() from public, anon, authenticated;

-- Leitura do tópico privado "base" (só Broadcast). Sem policy de insert: ninguém além do
-- banco publica nesse canal.
do $$
begin
  if to_regclass('realtime.messages') is not null then
    execute 'drop policy if exists "sinal de versao: leitura" on realtime.messages';
    execute $p$
      create policy "sinal de versao: leitura" on realtime.messages
        for select to anon, authenticated
        using (realtime.topic() = 'base' and extension = 'broadcast')
    $p$;
  end if;
end
$$;

-- Funções fora do uso do navegador.
do $$
begin
  if to_regnamespace('net') is not null then
    execute 'revoke execute on all functions in schema net from anon, authenticated';
  end if;
  if to_regprocedure('public.rls_auto_enable()') is not null then
    execute 'revoke execute on function public.rls_auto_enable() from public, anon, authenticated';
  end if;
exception when others then
  raise warning 'Revogação de funções: %', sqlerrm;
end
$$;

commit;
