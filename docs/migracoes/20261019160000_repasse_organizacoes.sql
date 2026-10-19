-- Repasse das vendas às organizações (Stripe Connect Express): situação da conta de
-- recebimento de cada organização em jsonb (contaId acct_..., status, transferências, saques).
-- Aplicar junto com 20261019150000_pagamentos_stripe.sql. Até lá o banco descarta o campo
-- (jsonb_populate_recordset ignora chaves desconhecidas) e as vendas ficam na plataforma.
-- Só muda o esquema (nenhum dado), por isso não precisa incrementar controle_base.versao.
begin;
alter table public.organizacoes add column if not exists recebimento jsonb;
notify pgrst, 'reload schema';
commit;
