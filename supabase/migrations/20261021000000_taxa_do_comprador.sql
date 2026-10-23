-- Taxa de serviço paga pelo comprador, somada ao valor do ingresso no checkout (padrão 0%).
-- platform_settings.buyer_fee_percent: percentual definido pela administração.
-- registration_payments.buyer_fee_cents: valor cobrado do comprador na reserva.
-- As colunas aceitam vazio: o servidor grava o registro inteiro (jsonb_populate_recordset),
-- então um campo ausente (versão do site anterior a estas colunas) vira NULL, tratado como 0.
begin;
alter table public.platform_settings
  add column if not exists buyer_fee_percent numeric(5, 2)
    check (buyer_fee_percent is null or (buyer_fee_percent >= 0 and buyer_fee_percent <= 50));
alter table public.registration_payments
  add column if not exists buyer_fee_cents integer
    check (buyer_fee_cents is null or buyer_fee_cents >= 0);
commit;
