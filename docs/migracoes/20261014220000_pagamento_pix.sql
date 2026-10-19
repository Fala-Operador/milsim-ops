-- Pagamento por PIX manual com comprovante (aditiva: não remove dados nem colunas).
--
-- Inscrição paga em evento com PIX configurado vira reserva ("aguardando_pagamento",
-- válida até reserva_ate) → participante envia comprovante ("em_analise") → organização
-- aprova ("confirmada") ou recusa ("recusada"); sem comprovante no prazo: "expirada".
-- O comprovante fica no bucket privado `documentos` (comprovantes/{usuario}/{inscricao}/…);
-- a coluna guarda só o caminho e os metadados.

alter table public.eventos add column if not exists pagamento jsonb;

alter table public.inscricoes add column if not exists reserva_ate timestamptz;
alter table public.inscricoes add column if not exists comprovante jsonb;
alter table public.inscricoes add column if not exists decidido_por text;
alter table public.inscricoes add column if not exists decidido_em timestamptz;

alter table public.inscricoes drop constraint if exists inscricoes_status_check;
alter table public.inscricoes add constraint inscricoes_status_check check (status in (
  'confirmada', 'cancelada', 'estornada', 'aguardando_pagamento', 'em_analise', 'recusada', 'expirada'
));

-- Uma inscrição que ocupa vaga por pessoa e evento: inclui as reservas pendentes.
-- (Reserva vencida ainda não varrida continua "aguardando_pagamento"; o serviço a expira
-- na mesma transação antes de criar outra.)
drop index if exists public.inscricoes_uma_ativa_por_evento;
create unique index inscricoes_uma_ativa_por_evento on public.inscricoes (evento_id, usuario_id)
  where status in ('confirmada', 'aguardando_pagamento', 'em_analise');

update public.controle_base set versao = versao + 1 where id = 1;
notify pgrst, 'reload schema';
