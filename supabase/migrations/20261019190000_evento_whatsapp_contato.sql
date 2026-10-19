-- WhatsApp do organizador por evento (dígitos com DDI), mostrado na página pública do
-- evento como "Falar com o organizador no WhatsApp". Aditiva: coluna nova e opcional.
-- O link do grupo já existe (eventos.whatsapp_grupo_url); quem pode vê-lo é decidido na
-- visão do servidor (src/lib/visao.ts), não aqui.
-- Só muda o esquema (nenhum dado), por isso não precisa incrementar controle_base.versao.
begin;

alter table public.eventos add column if not exists whatsapp_contato text
  check (whatsapp_contato is null or whatsapp_contato ~ '^[0-9]{12,15}$');

notify pgrst, 'reload schema';
commit;
