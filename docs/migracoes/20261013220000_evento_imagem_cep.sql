-- Editor de eventos em etapas: imagem principal com recortes (banner 21:9 / card 16:9) e CEP.
-- Até ser aplicada, o banco ignora esses campos (jsonb_populate_recordset descarta chaves
-- desconhecidas): o recorte do card continua salvo em imagem_url.
alter table public.eventos add column if not exists imagem jsonb;
alter table public.eventos add column if not exists cep text;
