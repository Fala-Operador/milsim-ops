-- As colunas novas de missões aceitam vazio. O servidor grava o registro inteiro
-- (insert ... select * from jsonb_populate_recordset): um campo ausente vira NULL e o
-- padrão da coluna não é aplicado, então NOT NULL quebraria gravações de registros antigos
-- ou de uma versão do site anterior a estas colunas. O código trata vazio como 0/false.
begin;
alter table public.missions alter column points drop not null;
alter table public.missions alter column draft drop not null;
alter table public.mission_submissions alter column allow_highlight drop not null;
commit;
