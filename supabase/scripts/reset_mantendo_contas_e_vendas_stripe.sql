-- Reset dos dados de teste do banco (decisão do Isaac em 19/10/2026), rodado pela ação
-- manual .github/workflows/reset-banco.yml, que salva um backup antes.
--
-- MANTÉM
--   contas: usuarios (e auth.users), privacidade, perfis_operador, equipamentos, fotos_perfil,
--     documentos_privados
--   organizações, com a conta Stripe Connect vinculada (organizacoes.recebimento)
--   configuração do site: configuracoes_plataforma (taxa), secoes_inicio, parceiros,
--     insignias, campanhas_recompensa
--   vendas Stripe: eventos com inscrição paga pelo Stripe, essas inscrições, as movimentações,
--     check-ins e cupons delas, e os vouchers que elas usaram
-- APAGA todo o resto (demais eventos e inscrições, cortesias, comunidade, suporte,
--   notificações, auditoria, missões, comunicados, impulsionamentos, métricas e conquistas
--   calculadas, que voltam a ser geradas pelo recálculo da progressão).
--
-- Nada é apagado no Stripe nem no Storage. Tudo numa transação: qualquer erro desfaz tudo.
begin;

create temp table _inscricoes_stripe on commit drop as
  select id, evento_id, cupom_id, voucher_id
  from public.inscricoes
  where pagamento is not null
    and (pagamento->>'intencaoId' is not null
         or pagamento->>'status' in ('pago', 'processando', 'estorno_pendente', 'estornado'));

create temp table _eventos_stripe on commit drop as
  select distinct evento_id as id from _inscricoes_stripe;

-- Dentro dos eventos mantidos, só as inscrições pagas e o que pertence a elas.
delete from public.checkins where inscricao_id not in (select id from _inscricoes_stripe);
delete from public.movimentacoes where inscricao_id is null or inscricao_id not in (select id from _inscricoes_stripe);
delete from public.inscricoes where id not in (select id from _inscricoes_stripe);
delete from public.cortesias;
delete from public.cupons where evento_id not in (select id from _eventos_stripe);

-- Os demais eventos (as tabelas filhas caem junto por on delete cascade).
delete from public.eventos where id not in (select id from _eventos_stripe);

-- Dados de teste sem relação com as vendas.
delete from public.solicitacoes;
delete from public.entregas;
delete from public.missoes;
delete from public.comentarios;
delete from public.comunicados;
delete from public.chamados;
delete from public.notificacoes;
delete from public.auditoria;
delete from public.curtidas;
delete from public.respostas;
delete from public.denuncias;
delete from public.publicacoes;
delete from public.preferencias_forum;
delete from public.restricoes_comunidade;
delete from public.moderacao;
delete from public.foruns;
delete from public.visitas_comunidade;
delete from public.impulsionamentos;
delete from public.analytics_registros;
delete from public.campanhas;
delete from public.concessoes_insignia;
delete from public.correcoes_participacao;
delete from public.vouchers where id not in (select voucher_id from _inscricoes_stripe where voucher_id is not null);

-- O servidor guarda a última exportação da base; a nova versão força a releitura.
update public.controle_base set versao = versao + 1 where id = 1;

-- Conferência no log da ação.
select
  (select count(*) from public.usuarios) as usuarios,
  (select count(*) from public.organizacoes) as organizacoes,
  (select count(*) from public.eventos) as eventos_mantidos,
  (select count(*) from public.inscricoes) as inscricoes_stripe_mantidas;

commit;
