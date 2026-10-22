-- Taxa de serviço do comprador por organização: cada organização define a sua no Financeiro,
-- e o valor é repassado a ela junto com a venda (antes era um percentual único da plataforma).
-- organizations.buyer_fee_percent aceita vazio (tratado como 0): o servidor grava o registro
-- inteiro (jsonb_populate_recordset), e uma versão do site anterior a esta coluna manda NULL.
-- platform_settings.buyer_fee_percent deixa de ser lida pelo site; fica no banco sem uso.
begin;
alter table public.organizations
  add column if not exists buyer_fee_percent numeric(5, 2)
    check (buyer_fee_percent is null or (buyer_fee_percent >= 0 and buyer_fee_percent <= 50));

-- Mantém o que os compradores já pagavam: cada organização começa com a taxa global atual.
update public.organizations o
   set buyer_fee_percent = s.buyer_fee_percent
  from public.platform_settings s
 where s.id = 'plataforma' and s.buyer_fee_percent > 0 and o.buyer_fee_percent is null;
commit;
