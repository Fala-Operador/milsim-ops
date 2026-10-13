-- Cupons: "sem limite de utilizações" e "sem data de término" passam a ser opções
-- explícitas (null), em vez de valores ambíguos como zero.
-- Aplicar com psql no banco do projeto.
alter table public.cupons alter column limite_usos drop not null;
alter table public.cupons alter column valido_ate drop not null;
alter table public.cupons drop constraint if exists cupons_limite_usos_check;
alter table public.cupons add constraint cupons_limite_usos_check check (limite_usos is null or limite_usos >= 1);
