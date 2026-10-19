-- O PIX manual (comprovante + aprovação pela organização) foi substituído pelo Stripe
-- Checkout, que já aceita PIX. A migration 20261014220000_pagamento_pix chegou a ser
-- aplicada à mão neste projeto, mas saiu da pasta: o `db push` a recusava (data anterior
-- à última aplicada) e, com --include-all, ela tiraria "pendente" dos status permitidos.
--
-- Aqui só o índice volta ao que o fluxo do Stripe espera (uma inscrição CONFIRMADA por
-- pessoa e evento; a regra das reservas pendentes fica em src/services/inscricoes.ts).
-- Em banco novo o índice já é este; recriá-lo é inofensivo.
--
-- As colunas que aquela migration criou (eventos.pagamento, inscricoes.reserva_ate,
-- comprovante, decidido_por, decidido_em) ficam, vazias e sem uso: removê-las é
-- destrutivo e depende de aprovação.
begin;

drop index if exists public.inscricoes_uma_ativa_por_evento;
create unique index inscricoes_uma_ativa_por_evento on public.inscricoes (evento_id, usuario_id)
  where status = 'confirmada';

notify pgrst, 'reload schema';
commit;
