-- Remove as colunas do PIX manual (comprovante + aprovação), substituído pelo Stripe
-- Checkout. Aprovado pelo responsável em 2026-10-19, com as colunas conferidas vazias.
-- inscricoes.pagamento (dados do Stripe) NÃO é tocada.
-- A guarda aborta a migration se alguma coluna tiver recebido dado: nada se perde em silêncio.
-- Em banco novo as colunas nunca existiram (a migration que as criava saiu da pasta);
-- o "if exists" torna esta migration inofensiva ali.
begin;

do $$
declare
  n bigint := 0;
begin
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'eventos' and column_name = 'pagamento') then
    execute 'select count(*) from public.eventos where pagamento is not null' into n;
  end if;
  if n = 0 and exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'inscricoes' and column_name = 'reserva_ate') then
    execute 'select count(*) from public.inscricoes where reserva_ate is not null or comprovante is not null or decidido_por is not null or decidido_em is not null' into n;
  end if;
  if n > 0 then
    raise exception 'Colunas do PIX manual têm % registro(s) com dados; remoção cancelada.', n using errcode = 'MS422';
  end if;
end $$;

alter table public.eventos drop column if exists pagamento;
alter table public.inscricoes drop column if exists reserva_ate;
alter table public.inscricoes drop column if exists comprovante;
alter table public.inscricoes drop column if exists decidido_por;
alter table public.inscricoes drop column if exists decidido_em;

notify pgrst, 'reload schema';
commit;
