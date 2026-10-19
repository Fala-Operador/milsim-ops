-- Venda de ingressos com Stripe Checkout: inscrição "pendente" (vaga reservada aguardando
-- pagamento) e os dados do pagamento em jsonb (status, valor, prazo, ids do Stripe).
-- Aplicar ANTES de configurar STRIPE_SECRET_KEY: sem a chave nenhuma inscrição pendente é
-- criada, então o código novo funciona com o banco antigo.
-- Só muda o esquema (nenhum dado), por isso não precisa incrementar controle_base.versao.
begin;

alter table public.inscricoes add column if not exists pagamento jsonb;

alter table public.inscricoes drop constraint if exists inscricoes_status_check;
alter table public.inscricoes add constraint inscricoes_status_check
  check (status in ('pendente', 'confirmada', 'cancelada', 'estornada'));

-- O índice inscricoes_uma_ativa_por_evento (where status = 'confirmada') continua igual:
-- reservas pendentes não contam como inscrição ativa; a regra de uma reserva aberta por
-- pessoa e evento fica em src/services/inscricoes.ts.

notify pgrst, 'reload schema';
commit;
