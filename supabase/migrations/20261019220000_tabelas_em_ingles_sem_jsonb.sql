-- Tabelas e colunas em inglês, e os campos jsonb em tabelas próprias.
--
-- Pedido do Isaac em 2026-10-19: (1) traduzir todas as tabelas e colunas de pt-BR para
-- inglês; (2) cada campo jsonb (listas e objetos aninhados) vira uma tabela própria, ligada
-- ao registro pai por chave estrangeira. Os nomes saem de src/lib/esquemaBanco.ts, que o
-- servidor usa para montar a BaseDados (src/lib/persistencia.ts).
--
-- Preserva os dados: tabelas e colunas são renomeadas (ALTER ... RENAME, sem recriar) e o
-- conteúdo de cada jsonb é copiado para as tabelas novas antes de a coluna sair.
--   * Listas viram uma linha por item, na ordem original (coluna position).
--   * Objetos viram uma linha 1:1 com a chave do pai; objetos pequenos dentro deles
--     (recortes da imagem, anexo e ação das mensagens, destino do banner...) viram colunas.
--   * Os valores enumerados (status etc.) continuam como estão: são dados, não nomes.
-- Guarda: se algum jsonb tiver uma chave que o mapeamento não conhece, a migration aborta
-- (MS422) antes de remover qualquer coluna, e nada se perde em silêncio. Tudo numa transação.
--
-- As funções da base também mudam de nome: tabelas_base → base_tables,
-- exportar_base → export_base (devolve {version, tables}), aplicar_mudancas → apply_changes
-- (p_changes, p_version). O conflito de versão continua MS409.
begin;

-- ===================== 1. Tabelas =====================
alter table public.usuarios rename to users;
alter table public.organizacoes rename to organizations;
alter table public.solicitacoes rename to organizer_requests;
alter table public.eventos rename to events;
alter table public.inscricoes rename to registrations;
alter table public.cupons rename to coupons;
alter table public.cortesias rename to complimentary_tickets;
alter table public.missoes rename to missions;
alter table public.entregas rename to mission_submissions;
alter table public.comunicados rename to announcements;
alter table public.comentarios rename to announcement_comments;
alter table public.chamados rename to support_tickets;
alter table public.notificacoes rename to notifications;
alter table public.movimentacoes rename to financial_transactions;
alter table public.auditoria rename to audit_logs;
alter table public.privacidade rename to privacy_requests;
alter table public.foruns rename to forums;
alter table public.publicacoes rename to forum_posts;
alter table public.respostas rename to forum_replies;
alter table public.curtidas rename to forum_post_likes;
alter table public.denuncias rename to community_reports;
alter table public.preferencias_forum rename to forum_preferences;
alter table public.restricoes_comunidade rename to community_restrictions;
alter table public.moderacao rename to moderation_logs;
alter table public.parceiros rename to partners;
alter table public.secoes_inicio rename to home_sections;
alter table public.impulsionamentos rename to event_boosts;
alter table public.checkins rename to check_ins;
alter table public.perfis_operador rename to operator_profiles;
alter table public.equipamentos rename to equipment;
alter table public.fotos_perfil rename to profile_photos;
alter table public.insignias rename to badges;
alter table public.concessoes_insignia rename to badge_awards;
alter table public.campanhas_recompensa rename to reward_campaigns;
alter table public.correcoes_participacao rename to attendance_corrections;
alter table public.configuracoes_plataforma rename to platform_settings;
alter table public.visitas_comunidade rename to community_visits;
alter table public.campanhas rename to marketing_campaigns;
alter table public.analytics_registros rename to analytics_events;
alter table public.documentos_privados rename to private_documents;
alter table public.controle_base rename to base_control;

-- ===================== 2. Colunas =====================
alter table public.users rename column perfil to role;
alter table public.users rename column nome_completo to full_name;
alter table public.users rename column data_nascimento to birth_date;
alter table public.users rename column foto_url to photo_url;
alter table public.users rename column nome_exibicao to display_name;
alter table public.users rename column tema to theme;
alter table public.users rename column autorizacao_responsavel to guardian_authorization;
alter table public.users rename column autorizacao_promocional to marketing_consent;
alter table public.users rename column aceite_termos_versao to terms_version;
alter table public.users rename column aceite_termos_em to terms_accepted_at;
alter table public.users rename column organizacao_id to organization_id;
alter table public.users rename column ativo to active;
alter table public.users rename column criado_em to created_at;
alter table public.organizations rename column nome to name;
alter table public.organizations rename column telefone to phone;
alter table public.organizations rename column responsavel_id to owner_id;
alter table public.organizations rename column criado_em to created_at;
alter table public.organizer_requests rename column usuario_id to user_id;
alter table public.organizer_requests rename column possui_cnpj to has_cnpj;
alter table public.organizer_requests rename column nome_organizacao to organization_name;
alter table public.organizer_requests rename column telefone to phone;
alter table public.organizer_requests rename column observacao_admin to admin_note;
alter table public.organizer_requests rename column criado_em to created_at;
alter table public.organizer_requests rename column atualizado_em to updated_at;
alter table public.events rename column organizacao_id to organization_id;
alter table public.events rename column nome to name;
alter table public.events rename column descricao_resumida to summary;
alter table public.events rename column enredo to storyline;
alter table public.events rename column inicio_em to starts_at;
alter table public.events rename column fim_em to ends_at;
alter table public.events rename column fuso to time_zone;
alter table public.events rename column local to venue;
alter table public.events rename column cep to postal_code;
alter table public.events rename column endereco to address;
alter table public.events rename column cidade to city;
alter table public.events rename column uf to state;
alter table public.events rename column capacidade_total to total_capacity;
alter table public.events rename column imagem_url to image_url;
alter table public.events rename column modalidade to modality;
alter table public.events rename column whatsapp_contato to whatsapp_contact;
alter table public.events rename column whatsapp_grupo_url to whatsapp_group_url;
alter table public.events rename column criado_em to created_at;
alter table public.registrations rename column evento_id to event_id;
alter table public.registrations rename column usuario_id to user_id;
alter table public.registrations rename column tipo_id to ticket_type_id;
alter table public.registrations rename column lote_id to batch_id;
alter table public.registrations rename column exercito_id to faction_id;
alter table public.registrations rename column codigo to code;
alter table public.registrations rename column token_entrada to entry_token;
alter table public.registrations rename column origem to source;
alter table public.registrations rename column valor_centavos to amount_cents;
alter table public.registrations rename column desconto_centavos to discount_cents;
alter table public.registrations rename column cupom_id to coupon_id;
alter table public.registrations rename column cortesia_id to complimentary_ticket_id;
alter table public.registrations rename column criado_em to created_at;
alter table public.registrations rename column cancelado_em to cancelled_at;
alter table public.registrations rename column motivo_cancelamento to cancellation_reason;
alter table public.coupons rename column evento_id to event_id;
alter table public.coupons rename column codigo to code;
alter table public.coupons rename column desconto_percentual to discount_percent;
alter table public.coupons rename column valido_de to valid_from;
alter table public.coupons rename column valido_ate to valid_until;
alter table public.coupons rename column limite_usos to usage_limit;
alter table public.coupons rename column usos to uses;
alter table public.coupons rename column ativo to active;
alter table public.complimentary_tickets rename column evento_id to event_id;
alter table public.complimentary_tickets rename column nome_convidado to guest_name;
alter table public.complimentary_tickets rename column email_convidado to guest_email;
alter table public.complimentary_tickets rename column tipo_id to ticket_type_id;
alter table public.complimentary_tickets rename column exercito_id to faction_id;
alter table public.complimentary_tickets rename column validade to expires_at;
alter table public.complimentary_tickets rename column codigo to code;
alter table public.complimentary_tickets rename column criado_em to created_at;
alter table public.missions rename column evento_id to event_id;
alter table public.missions rename column titulo to title;
alter table public.missions rename column descricao to description;
alter table public.missions rename column imagem_url to image_url;
alter table public.missions rename column prazo to deadline;
alter table public.missions rename column publico to audience;
alter table public.missions rename column tipo_entrega to submission_type;
alter table public.missions rename column exige_aprovacao to requires_approval;
alter table public.mission_submissions rename column missao_id to mission_id;
alter table public.mission_submissions rename column usuario_id to user_id;
alter table public.mission_submissions rename column conteudo to content;
alter table public.mission_submissions rename column enviado_em to submitted_at;
alter table public.mission_submissions rename column avaliacao to review;
alter table public.announcements rename column evento_id to event_id;
alter table public.announcements rename column autor_id to author_id;
alter table public.announcements rename column titulo to title;
alter table public.announcements rename column corpo to body;
alter table public.announcements rename column imagem_url to image_url;
alter table public.announcements rename column fixado to pinned;
alter table public.announcements rename column segmento_exercito_id to target_faction_id;
alter table public.announcements rename column criado_em to created_at;
alter table public.announcement_comments rename column comunicado_id to announcement_id;
alter table public.announcement_comments rename column autor_id to author_id;
alter table public.announcement_comments rename column corpo to body;
alter table public.announcement_comments rename column criado_em to created_at;
alter table public.support_tickets rename column evento_id to event_id;
alter table public.support_tickets rename column solicitante_id to requester_id;
alter table public.support_tickets rename column assunto to subject;
alter table public.support_tickets rename column categoria to category;
alter table public.support_tickets rename column descricao to description;
alter table public.support_tickets rename column criado_em to created_at;
alter table public.support_tickets rename column atualizado_em to updated_at;
alter table public.notifications rename column usuario_id to user_id;
alter table public.notifications rename column titulo to title;
alter table public.notifications rename column corpo to body;
alter table public.notifications rename column lida to read;
alter table public.notifications rename column criado_em to created_at;
alter table public.financial_transactions rename column evento_id to event_id;
alter table public.financial_transactions rename column inscricao_id to registration_id;
alter table public.financial_transactions rename column tipo to type;
alter table public.financial_transactions rename column valor_centavos to amount_cents;
alter table public.financial_transactions rename column descricao to description;
alter table public.financial_transactions rename column criado_em to created_at;
alter table public.audit_logs rename column autor_id to author_id;
alter table public.audit_logs rename column acao to action;
alter table public.audit_logs rename column entidade to entity;
alter table public.audit_logs rename column entidade_id to entity_id;
alter table public.audit_logs rename column justificativa to justification;
alter table public.audit_logs rename column criado_em to created_at;
alter table public.privacy_requests rename column usuario_id to user_id;
alter table public.privacy_requests rename column tipo to type;
alter table public.privacy_requests rename column detalhes to details;
alter table public.privacy_requests rename column resposta to response;
alter table public.privacy_requests rename column criado_em to created_at;
alter table public.forums rename column evento_id to event_id;
alter table public.forums rename column nome to name;
alter table public.forums rename column descricao to description;
alter table public.forums rename column icone to icon;
alter table public.forums rename column regras to rules;
alter table public.forums rename column ordem to sort_order;
alter table public.forums rename column publico to audience;
alter table public.forums rename column publicacao to post_permission;
alter table public.forums rename column respostas to reply_permission;
alter table public.forums rename column criado_em to created_at;
alter table public.forum_posts rename column evento_id to event_id;
alter table public.forum_posts rename column autor_id to author_id;
alter table public.forum_posts rename column texto to text;
alter table public.forum_posts rename column fixada to pinned;
alter table public.forum_posts rename column importante to important;
alter table public.forum_posts rename column respostas_fechadas to replies_closed;
alter table public.forum_posts rename column oculta to hidden;
alter table public.forum_posts rename column motivo_ocultacao to hidden_reason;
alter table public.forum_posts rename column removida_pelo_autor to removed_by_author;
alter table public.forum_posts rename column editado_em to edited_at;
alter table public.forum_posts rename column criado_em to created_at;
alter table public.forum_replies rename column publicacao_id to post_id;
alter table public.forum_replies rename column autor_id to author_id;
alter table public.forum_replies rename column texto to text;
alter table public.forum_replies rename column oculta to hidden;
alter table public.forum_replies rename column motivo_ocultacao to hidden_reason;
alter table public.forum_replies rename column editado_em to edited_at;
alter table public.forum_replies rename column criado_em to created_at;
alter table public.forum_post_likes rename column publicacao_id to post_id;
alter table public.forum_post_likes rename column usuario_id to user_id;
alter table public.community_reports rename column evento_id to event_id;
alter table public.community_reports rename column alvo to target_type;
alter table public.community_reports rename column alvo_id to target_id;
alter table public.community_reports rename column denunciante_id to reporter_id;
alter table public.community_reports rename column motivo to reason;
alter table public.community_reports rename column descricao to description;
alter table public.community_reports rename column criado_em to created_at;
alter table public.forum_preferences rename column usuario_id to user_id;
alter table public.forum_preferences rename column modo to mode;
alter table public.community_restrictions rename column evento_id to event_id;
alter table public.community_restrictions rename column usuario_id to user_id;
alter table public.community_restrictions rename column justificativa to justification;
alter table public.community_restrictions rename column ativa to active;
alter table public.community_restrictions rename column criado_em to created_at;
alter table public.moderation_logs rename column evento_id to event_id;
alter table public.moderation_logs rename column autor_id to author_id;
alter table public.moderation_logs rename column acao to action;
alter table public.moderation_logs rename column alvo_id to target_id;
alter table public.moderation_logs rename column justificativa to justification;
alter table public.moderation_logs rename column criado_em to created_at;
alter table public.partners rename column nome to name;
alter table public.partners rename column tipo to type;
alter table public.partners rename column descricao to description;
alter table public.partners rename column texto_alt to alt_text;
alter table public.partners rename column ativo to active;
alter table public.partners rename column criado_em to created_at;
alter table public.partners rename column atualizado_em to updated_at;
alter table public.home_sections rename column titulo to title;
alter table public.home_sections rename column subtitulo to subtitle;
alter table public.home_sections rename column tipo to type;
alter table public.home_sections rename column ordem to sort_order;
alter table public.home_sections rename column modo to mode;
alter table public.home_sections rename column mostrar_esgotados to show_sold_out;
alter table public.home_sections rename column tamanho_logo to logo_size;
alter table public.home_sections rename column mostrar_descricoes to show_descriptions;
alter table public.home_sections rename column superficie_logo to logo_surface;
alter table public.home_sections rename column criado_em to created_at;
alter table public.home_sections rename column atualizado_em to updated_at;
alter table public.event_boosts rename column evento_id to event_id;
alter table public.event_boosts rename column nome to name;
alter table public.event_boosts rename column objetivo to goal;
alter table public.event_boosts rename column inicio_em to starts_at;
alter table public.event_boosts rename column fim_em to ends_at;
alter table public.event_boosts rename column fuso to time_zone;
alter table public.event_boosts rename column prioridade to priority;
alter table public.event_boosts rename column ordem to sort_order;
alter table public.event_boosts rename column imagem_promocional to promo_image_url;
alter table public.event_boosts rename column chamada to headline;
alter table public.event_boosts rename column criado_por to created_by;
alter table public.event_boosts rename column criado_em to created_at;
alter table public.event_boosts rename column atualizado_em to updated_at;
alter table public.check_ins rename column evento_id to event_id;
alter table public.check_ins rename column inscricao_id to registration_id;
alter table public.check_ins rename column tipo to type;
alter table public.check_ins rename column revertido_id to reverted_id;
alter table public.check_ins rename column origem to source;
alter table public.check_ins rename column motivo to reason;
alter table public.check_ins rename column operador_id to operator_id;
alter table public.check_ins rename column operador_nome to operator_name;
alter table public.check_ins rename column dispositivo_id to device_id;
alter table public.check_ins rename column em to occurred_at;
alter table public.check_ins rename column sync to sync_status;
alter table public.check_ins rename column conflito to conflict;
alter table public.operator_profiles rename column usuario_id to user_id;
alter table public.operator_profiles rename column capa_url to cover_url;
alter table public.operator_profiles rename column insignia_destaque to featured_badge_id;
alter table public.operator_profiles rename column intro_vista to intro_seen;
alter table public.operator_profiles rename column atualizado_em to updated_at;
alter table public.equipment rename column usuario_id to user_id;
alter table public.equipment rename column marca to brand;
alter table public.equipment rename column tipo to type;
alter table public.equipment rename column modelo to model;
alter table public.equipment rename column apelido to nickname;
alter table public.equipment rename column observacoes to notes;
alter table public.equipment rename column visivel to visible;
alter table public.equipment rename column criado_em to created_at;
alter table public.equipment rename column atualizado_em to updated_at;
alter table public.profile_photos rename column usuario_id to user_id;
alter table public.profile_photos rename column legenda to caption;
alter table public.profile_photos rename column visivel to visible;
alter table public.profile_photos rename column criado_em to created_at;
alter table public.badges rename column nome to name;
alter table public.badges rename column descricao to description;
alter table public.badges rename column icone to icon;
alter table public.badges rename column ativa to active;
alter table public.badges rename column versao to version;
alter table public.badges rename column criado_em to created_at;
alter table public.badges rename column atualizado_em to updated_at;
alter table public.badge_awards rename column usuario_id to user_id;
alter table public.badge_awards rename column insignia_id to badge_id;
alter table public.badge_awards rename column versao_regra to rule_version;
alter table public.badge_awards rename column conquistada_em to earned_at;
alter table public.badge_awards rename column revogada_em to revoked_at;
alter table public.badge_awards rename column motivo_revogacao to revocation_reason;
alter table public.reward_campaigns rename column nome to name;
alter table public.reward_campaigns rename column descricao to description;
alter table public.reward_campaigns rename column insignia_id to badge_id;
alter table public.reward_campaigns rename column organizacao_id to organization_id;
alter table public.reward_campaigns rename column tipo to type;
alter table public.reward_campaigns rename column valor to value;
alter table public.reward_campaigns rename column maximo to max_vouchers;
alter table public.reward_campaigns rename column limite_por_participante to limit_per_participant;
alter table public.reward_campaigns rename column inicio_em to starts_at;
alter table public.reward_campaigns rename column conquistar_ate to earn_until;
alter table public.reward_campaigns rename column resgatar_ate to redeem_until;
alter table public.reward_campaigns rename column regras to rules;
alter table public.reward_campaigns rename column aceita_anteriores to accepts_previous;
alter table public.reward_campaigns rename column ativa to active;
alter table public.reward_campaigns rename column versao to version;
alter table public.reward_campaigns rename column autorizacao to authorization_ref;
alter table public.reward_campaigns rename column criado_por to created_by;
alter table public.reward_campaigns rename column criado_em to created_at;
alter table public.vouchers rename column campanha_id to campaign_id;
alter table public.vouchers rename column campanha_versao to campaign_version;
alter table public.vouchers rename column usuario_id to user_id;
alter table public.vouchers rename column concessao_id to award_id;
alter table public.vouchers rename column codigo to code;
alter table public.vouchers rename column concedido_em to granted_at;
alter table public.vouchers rename column inscricao_id to registration_id;
alter table public.vouchers rename column usado_em to used_at;
alter table public.vouchers rename column motivo to reason;
alter table public.vouchers rename column ocorrencia to incident;
alter table public.attendance_corrections rename column usuario_id to user_id;
alter table public.attendance_corrections rename column evento_id to event_id;
alter table public.attendance_corrections rename column tipo to type;
alter table public.attendance_corrections rename column justificativa to justification;
alter table public.attendance_corrections rename column autor_id to author_id;
alter table public.attendance_corrections rename column criado_em to created_at;
alter table public.platform_settings rename column taxa_plataforma_percentual to platform_fee_percent;
alter table public.platform_settings rename column atualizado_em to updated_at;
alter table public.platform_settings rename column atualizado_por to updated_by;
alter table public.community_visits rename column usuario_id to user_id;
alter table public.community_visits rename column evento_id to event_id;
alter table public.community_visits rename column visto_em to seen_at;
alter table public.marketing_campaigns rename column evento_id to event_id;
alter table public.marketing_campaigns rename column nome to name;
alter table public.marketing_campaigns rename column origem to source;
alter table public.marketing_campaigns rename column criado_em to created_at;
alter table public.analytics_events rename column tipo to type;
alter table public.analytics_events rename column evento_id to event_id;
alter table public.analytics_events rename column visitante_id to visitor_id;
alter table public.analytics_events rename column sessao_id to session_id;
alter table public.analytics_events rename column origem to source;
alter table public.analytics_events rename column secao_id to section_id;
alter table public.analytics_events rename column posicao to position;
alter table public.analytics_events rename column campanha_id to campaign_id;
alter table public.analytics_events rename column fluxo_id to flow_id;
alter table public.analytics_events rename column inscricao_id to registration_id;
alter table public.analytics_events rename column em to occurred_at_ms;
alter table public.private_documents rename column usuario_id to user_id;
alter table public.private_documents rename column equipamento_id to equipment_id;
alter table public.private_documents rename column caminho to path;
alter table public.private_documents rename column nome to name;
alter table public.private_documents rename column tipo to type;
alter table public.private_documents rename column tamanho to size;
alter table public.private_documents rename column enviado_em to uploaded_at;
alter table public.base_control rename column versao to version;

-- ===================== 3. Guarda: chaves desconhecidas nos jsonb =====================
do $$
declare
  v_desconhecidas text;
begin
  select string_agg(c, '; ') into v_desconhecidas from (
  select string_agg(distinct 'usuarios.endereco.' || k, ', ') from public.users p, jsonb_object_keys(case when jsonb_typeof(p.endereco) = 'object' then p.endereco else '{}' end) k where jsonb_typeof(p.endereco) = 'object' and k <> all (array['cep', 'logradouro', 'numero', 'complemento', 'bairro', 'cidade', 'uf'])
  union all
  select string_agg(distinct 'usuarios.silencio_notificacoes.' || k, ', ') from public.users p, jsonb_object_keys(case when jsonb_typeof(p.silencio_notificacoes) = 'object' then p.silencio_notificacoes else '{}' end) k where jsonb_typeof(p.silencio_notificacoes) = 'object' and k <> all (array['todas', 'comunidade', 'leiturasSuporte'])
  union all
  select string_agg(distinct 'usuarios.preferencias_modalidade.' || k, ', ') from public.users p, jsonb_object_keys(case when jsonb_typeof(p.preferencias_modalidade) = 'object' then p.preferencias_modalidade else '{}' end) k where jsonb_typeof(p.preferencias_modalidade) = 'object' and k <> all (array['estado', 'atualizadoEm', 'modalidades'])
  union all
  select string_agg(distinct 'organizacoes.recebimento.' || k, ', ') from public.organizations p, jsonb_object_keys(case when jsonb_typeof(p.recebimento) = 'object' then p.recebimento else '{}' end) k where jsonb_typeof(p.recebimento) = 'object' and k <> all (array['provedor', 'contaId', 'status', 'transferenciasAtivas', 'saquesAtivos', 'atualizadoEm', 'pendencias'])
  union all
  select string_agg(distinct 'eventos.imagem.banner.' || k, ', ') from public.events p, jsonb_object_keys(case when jsonb_typeof(p.imagem->'banner') = 'object' then p.imagem->'banner' else '{}' end) k where jsonb_typeof(p.imagem) = 'object' and k <> all (array['zoom', 'x', 'y'])
  union all
  select string_agg(distinct 'eventos.imagem.card.' || k, ', ') from public.events p, jsonb_object_keys(case when jsonb_typeof(p.imagem->'card') = 'object' then p.imagem->'card' else '{}' end) k where jsonb_typeof(p.imagem) = 'object' and k <> all (array['zoom', 'x', 'y'])
  union all
  select string_agg(distinct 'eventos.imagem.' || k, ', ') from public.events p, jsonb_object_keys(case when jsonb_typeof(p.imagem) = 'object' then p.imagem else '{}' end) k where jsonb_typeof(p.imagem) = 'object' and k <> all (array['originalUrl', 'alt', 'banner', 'card', 'bannerUrl'])
  union all
  select string_agg(distinct 'eventos.exercitos[].' || k, ', ') from public.events p, jsonb_array_elements(case when jsonb_typeof(p.exercitos) = 'array' then p.exercitos else '[]' end) with ordinality x9(v, n), jsonb_object_keys(case when jsonb_typeof(x9.v) = 'object' then x9.v else '{}' end) k where k <> all (array['id', 'nome', 'descricao', 'capacidade'])
  union all
  select string_agg(distinct 'eventos.tipos[].' || k, ', ') from public.events p, jsonb_array_elements(case when jsonb_typeof(p.tipos) = 'array' then p.tipos else '[]' end) with ordinality x10(v, n), jsonb_object_keys(case when jsonb_typeof(x10.v) = 'object' then x10.v else '{}' end) k where k <> all (array['id', 'nome', 'descricao', 'observacoes', 'beneficios', 'precoBaseCentavos', 'quantidadeMaxima', 'arquivado'])
  union all
  select string_agg(distinct 'eventos.lotes[].' || k, ', ') from public.events p, jsonb_array_elements(case when jsonb_typeof(p.lotes) = 'array' then p.lotes else '[]' end) with ordinality x11(v, n), jsonb_object_keys(case when jsonb_typeof(x11.v) = 'object' then x11.v else '{}' end) k where k <> all (array['id', 'nome', 'inicioVendas', 'fimVendas', 'status', 'itens'])
  union all
  select string_agg(distinct 'eventos.lotes[].itens[].' || k, ', ') from public.events p, jsonb_array_elements(case when jsonb_typeof(p.lotes) = 'array' then p.lotes else '[]' end) with ordinality x11(v, n), jsonb_array_elements(case when jsonb_typeof(x11.v->'itens') = 'array' then x11.v->'itens' else '[]' end) with ordinality x12(v, n), jsonb_object_keys(case when jsonb_typeof(x12.v) = 'object' then x12.v else '{}' end) k where k <> all (array['tipoId', 'precoCentavos', 'quantidade'])
  union all
  select string_agg(distinct 'eventos.cronograma[].' || k, ', ') from public.events p, jsonb_array_elements(case when jsonb_typeof(p.cronograma) = 'array' then p.cronograma else '[]' end) with ordinality x13(v, n), jsonb_object_keys(case when jsonb_typeof(x13.v) = 'object' then x13.v else '{}' end) k where k <> all (array['id', 'data', 'horario', 'titulo', 'descricao', 'local', 'ordem'])
  union all
  select string_agg(distinct 'eventos.regras.' || k, ', ') from public.events p, jsonb_object_keys(case when jsonb_typeof(p.regras) = 'object' then p.regras else '{}' end) k where jsonb_typeof(p.regras) = 'object' and k <> all (array['titulo', 'versao', 'atualizadoEm', 'formato', 'conteudoHtml', 'nomeArquivo', 'pdfDataUrl', 'arquivoUrl'])
  union all
  select string_agg(distinct 'inscricoes.pagamento.' || k, ', ') from public.registrations p, jsonb_object_keys(case when jsonb_typeof(p.pagamento) = 'object' then p.pagamento else '{}' end) k where jsonb_typeof(p.pagamento) = 'object' and k <> all (array['provedor', 'status', 'valorCentavos', 'expiraEm', 'sessaoId', 'intencaoId', 'pagoEm', 'reembolsoId', 'erro', 'contaDestino', 'taxaCentavos', 'disputa'])
  union all
  select string_agg(distinct 'inscricoes.pagamento.disputa.' || k, ', ') from public.registrations p, jsonb_object_keys(case when jsonb_typeof(p.pagamento->'disputa') = 'object' then p.pagamento->'disputa' else '{}' end) k where jsonb_typeof(p.pagamento) = 'object' and jsonb_typeof(p.pagamento->'disputa') = 'object' and k <> all (array['status', 'valorCentavos', 'motivo', 'abertaEm', 'atualizadaEm'])
  union all
  select string_agg(distinct 'chamados.mensagens[].anexo.' || k, ', ') from public.support_tickets p, jsonb_array_elements(case when jsonb_typeof(p.mensagens) = 'array' then p.mensagens else '[]' end) with ordinality x18(v, n), jsonb_object_keys(case when jsonb_typeof(x18.v->'anexo') = 'object' then x18.v->'anexo' else '{}' end) k where k <> all (array['caminho', 'nome', 'tipo', 'tamanho'])
  union all
  select string_agg(distinct 'chamados.mensagens[].acao.' || k, ', ') from public.support_tickets p, jsonb_array_elements(case when jsonb_typeof(p.mensagens) = 'array' then p.mensagens else '[]' end) with ordinality x18(v, n), jsonb_object_keys(case when jsonb_typeof(x18.v->'acao') = 'object' then x18.v->'acao' else '{}' end) k where k <> all (array['tipo', 'valor'])
  union all
  select string_agg(distinct 'chamados.mensagens[].encaminhamento.' || k, ', ') from public.support_tickets p, jsonb_array_elements(case when jsonb_typeof(p.mensagens) = 'array' then p.mensagens else '[]' end) with ordinality x18(v, n), jsonb_object_keys(case when jsonb_typeof(x18.v->'encaminhamento') = 'object' then x18.v->'encaminhamento' else '{}' end) k where k <> all (array['organizacaoId', 'orientacao', 'anexos'])
  union all
  select string_agg(distinct 'chamados.mensagens[].' || k, ', ') from public.support_tickets p, jsonb_array_elements(case when jsonb_typeof(p.mensagens) = 'array' then p.mensagens else '[]' end) with ordinality x18(v, n), jsonb_object_keys(case when jsonb_typeof(x18.v) = 'object' then x18.v else '{}' end) k where k <> all (array['id', 'autorId', 'corpo', 'criadoEm', 'tipo', 'clienteId', 'anexo', 'acao', 'canal', 'encaminhamentoId', 'encaminhamento'])
  union all
  select string_agg(distinct 'chamados.mensagens[].encaminhamento.anexos[].' || k, ', ') from public.support_tickets p, jsonb_array_elements(case when jsonb_typeof(p.mensagens) = 'array' then p.mensagens else '[]' end) with ordinality x18(v, n), jsonb_array_elements(case when jsonb_typeof(x18.v->'encaminhamento'->'anexos') = 'array' then x18.v->'encaminhamento'->'anexos' else '[]' end) with ordinality x19(v, n), jsonb_object_keys(case when jsonb_typeof(x19.v) = 'object' then x19.v else '{}' end) k where k <> all (array['mensagemId', 'nome', 'tipo', 'tamanho'])
  union all
  select string_agg(distinct 'publicacoes.imagens[].' || k, ', ') from public.forum_posts p, jsonb_array_elements(case when jsonb_typeof(p.imagens) = 'array' then p.imagens else '[]' end) with ordinality x20(v, n), jsonb_object_keys(case when jsonb_typeof(x20.v) = 'object' then x20.v else '{}' end) k where k <> all (array['url', 'alt'])
  union all
  select string_agg(distinct 'respostas.imagem.' || k, ', ') from public.forum_replies p, jsonb_object_keys(case when jsonb_typeof(p.imagem) = 'object' then p.imagem else '{}' end) k where jsonb_typeof(p.imagem) = 'object' and k <> all (array['url', 'alt'])
  union all
  select string_agg(distinct 'parceiros.links[].' || k, ', ') from public.partners p, jsonb_array_elements(case when jsonb_typeof(p.links) = 'array' then p.links else '[]' end) with ordinality x22(v, n), jsonb_object_keys(case when jsonb_typeof(x22.v) = 'object' then x22.v else '{}' end) k where k <> all (array['id', 'tipo', 'url', 'rotulo', 'telefone', 'mensagem', 'principal'])
  union all
  select string_agg(distinct 'secoes_inicio.abrangencia.' || k, ', ') from public.home_sections p, jsonb_object_keys(case when jsonb_typeof(p.abrangencia) = 'object' then p.abrangencia else '{}' end) k where jsonb_typeof(p.abrangencia) = 'object' and k <> all (array['escopo', 'regiao', 'uf', 'cidade'])
  union all
  select string_agg(distinct 'secoes_inicio.agendamento.' || k, ', ') from public.home_sections p, jsonb_object_keys(case when jsonb_typeof(p.agendamento) = 'object' then p.agendamento else '{}' end) k where jsonb_typeof(p.agendamento) = 'object' and k <> all (array['inicioEm', 'fimEm'])
  union all
  select string_agg(distinct 'secoes_inicio.destaques[].agendamento.' || k, ', ') from public.home_sections p, jsonb_array_elements(case when jsonb_typeof(p.destaques) = 'array' then p.destaques else '[]' end) with ordinality x25(v, n), jsonb_object_keys(case when jsonb_typeof(x25.v->'agendamento') = 'object' then x25.v->'agendamento' else '{}' end) k where k <> all (array['inicioEm', 'fimEm'])
  union all
  select string_agg(distinct 'secoes_inicio.destaques[].' || k, ', ') from public.home_sections p, jsonb_array_elements(case when jsonb_typeof(p.destaques) = 'array' then p.destaques else '[]' end) with ordinality x25(v, n), jsonb_object_keys(case when jsonb_typeof(x25.v) = 'object' then x25.v else '{}' end) k where k <> all (array['id', 'eventoId', 'posicao', 'imagemPromocional', 'selo', 'chamada', 'agendamento'])
  union all
  select string_agg(distinct 'secoes_inicio.automatica.abrangencia.' || k, ', ') from public.home_sections p, jsonb_object_keys(case when jsonb_typeof(p.automatica->'abrangencia') = 'object' then p.automatica->'abrangencia' else '{}' end) k where jsonb_typeof(p.automatica) = 'object' and k <> all (array['escopo', 'regiao', 'uf', 'cidade'])
  union all
  select string_agg(distinct 'secoes_inicio.automatica.' || k, ', ') from public.home_sections p, jsonb_object_keys(case when jsonb_typeof(p.automatica) = 'object' then p.automatica else '{}' end) k where jsonb_typeof(p.automatica) = 'object' and k <> all (array['abrangencia', 'periodoDias', 'maximo', 'incluirEsgotados', 'ordenacao'])
  union all
  select string_agg(distinct 'secoes_inicio.parceiros[].' || k, ', ') from public.home_sections p, jsonb_array_elements(case when jsonb_typeof(p.parceiros) = 'array' then p.parceiros else '[]' end) with ordinality x27(v, n), jsonb_object_keys(case when jsonb_typeof(x27.v) = 'object' then x27.v else '{}' end) k where k <> all (array['parceiroId', 'posicao'])
  union all
  select string_agg(distinct 'secoes_inicio.banner.destino.' || k, ', ') from public.home_sections p, jsonb_object_keys(case when jsonb_typeof(p.banner->'destino') = 'object' then p.banner->'destino' else '{}' end) k where jsonb_typeof(p.banner) = 'object' and k <> all (array['tipo', 'valor'])
  union all
  select string_agg(distinct 'secoes_inicio.banner.' || k, ', ') from public.home_sections p, jsonb_object_keys(case when jsonb_typeof(p.banner) = 'object' then p.banner else '{}' end) k where jsonb_typeof(p.banner) = 'object' and k <> all (array['imagemDesktop', 'imagemCelular', 'textoAlt', 'chamada', 'textoBotao', 'destino'])
  union all
  select string_agg(distinct 'impulsionamentos.abrangencia.' || k, ', ') from public.event_boosts p, jsonb_object_keys(case when jsonb_typeof(p.abrangencia) = 'object' then p.abrangencia else '{}' end) k where jsonb_typeof(p.abrangencia) = 'object' and k <> all (array['escopo', 'regiao', 'uf', 'cidade'])
  union all
  select string_agg(distinct 'perfis_operador.privacidade.' || k, ', ') from public.operator_profiles p, jsonb_object_keys(case when jsonb_typeof(p.privacidade) = 'object' then p.privacidade else '{}' end) k where jsonb_typeof(p.privacidade) = 'object' and k <> all (array['historico', 'mapa', 'insignias', 'equipamentos', 'fotos'])
  union all
  select string_agg(distinct 'equipamentos.nota.' || k, ', ') from public.equipment p, jsonb_object_keys(case when jsonb_typeof(p.nota) = 'object' then p.nota else '{}' end) k where jsonb_typeof(p.nota) = 'object' and k <> all (array['nome', 'tipo', 'tamanho', 'enviadaEm'])
  union all
  select string_agg(distinct 'insignias.criterio.' || k, ', ') from public.badges p, jsonb_object_keys(case when jsonb_typeof(p.criterio) = 'object' then p.criterio else '{}' end) k where jsonb_typeof(p.criterio) = 'object' and k <> all (array['tipo', 'meta'])
  union all
  select string_agg(distinct 'concessoes_insignia.criterio.' || k, ', ') from public.badge_awards p, jsonb_object_keys(case when jsonb_typeof(p.criterio) = 'object' then p.criterio else '{}' end) k where jsonb_typeof(p.criterio) = 'object' and k <> all (array['tipo', 'meta'])
  union all
  select string_agg(distinct 'vouchers.beneficio.' || k, ', ') from public.vouchers p, jsonb_object_keys(case when jsonb_typeof(p.beneficio) = 'object' then p.beneficio else '{}' end) k where jsonb_typeof(p.beneficio) = 'object' and k <> all (array['nome', 'organizacaoId', 'tipo', 'valor', 'eventosElegiveis', 'tiposElegiveis', 'resgatarAte', 'regras'])
  ) g(c);
  if v_desconhecidas is not null then
    raise exception 'Campos jsonb sem coluna de destino: %; migration cancelada.', v_desconhecidas using errcode = 'MS422';
  end if;
end $$;

-- ===================== 4. Tabelas novas (antes jsonb) =====================
-- Chave primária = chave do pai (+ position nas listas); as FKs são adiadas até o commit,
-- como nas demais tabelas, para apply_changes gravar o lote em qualquer ordem.
create table public.user_addresses (
  user_id uuid not null,
  postal_code text,
  street text,
  number text,
  complement text,
  district text,
  city text,
  state text,
  primary key (user_id),
  foreign key (user_id) references public.users (id) on delete cascade deferrable initially deferred
);

create table public.user_notification_settings (
  user_id uuid not null,
  mute_all boolean,
  mute_community boolean,
  primary key (user_id),
  foreign key (user_id) references public.users (id) on delete cascade deferrable initially deferred
);

create table public.user_support_reads (
  user_id uuid not null,
  ticket_id text not null,
  read_at timestamptz,
  primary key (user_id, ticket_id),
  foreign key (user_id) references public.user_notification_settings (user_id) on delete cascade deferrable initially deferred
);

create table public.user_modality_preferences (
  user_id uuid not null,
  state text,
  updated_at timestamptz,
  primary key (user_id),
  foreign key (user_id) references public.users (id) on delete cascade deferrable initially deferred
);

create table public.user_preferred_modalities (
  user_id uuid not null,
  position integer not null,
  modality text,
  primary key (user_id, position),
  foreign key (user_id) references public.user_modality_preferences (user_id) on delete cascade deferrable initially deferred
);

create table public.organization_payout_accounts (
  organization_id text not null,
  provider text,
  account_id text,
  status text,
  transfers_enabled boolean,
  payouts_enabled boolean,
  updated_at timestamptz,
  primary key (organization_id),
  foreign key (organization_id) references public.organizations (id) on delete cascade deferrable initially deferred
);

create table public.organization_payout_requirements (
  organization_id text not null,
  position integer not null,
  requirement text,
  primary key (organization_id, position),
  foreign key (organization_id) references public.organization_payout_accounts (organization_id) on delete cascade deferrable initially deferred
);

create table public.event_images (
  event_id text not null,
  original_url text,
  alt text,
  banner_zoom double precision,
  banner_x double precision,
  banner_y double precision,
  card_zoom double precision,
  card_x double precision,
  card_y double precision,
  banner_url text,
  primary key (event_id),
  foreign key (event_id) references public.events (id) on delete cascade deferrable initially deferred
);

create table public.event_factions (
  event_id text not null,
  position integer not null,
  id text,
  name text,
  description text,
  capacity integer,
  primary key (event_id, position),
  foreign key (event_id) references public.events (id) on delete cascade deferrable initially deferred
);

create table public.event_ticket_types (
  event_id text not null,
  position integer not null,
  id text,
  name text,
  description text,
  notes text,
  benefits text,
  base_price_cents integer,
  max_quantity integer,
  archived boolean,
  primary key (event_id, position),
  foreign key (event_id) references public.events (id) on delete cascade deferrable initially deferred
);

create table public.event_ticket_batches (
  event_id text not null,
  position integer not null,
  id text,
  name text,
  sales_start_at timestamptz,
  sales_end_at timestamptz,
  status text,
  primary key (event_id, position),
  foreign key (event_id) references public.events (id) on delete cascade deferrable initially deferred
);

create table public.event_ticket_batch_items (
  event_id text not null,
  batch_position integer not null,
  position integer not null,
  ticket_type_id text,
  price_cents integer,
  quantity integer,
  primary key (event_id, batch_position, position),
  foreign key (event_id, batch_position) references public.event_ticket_batches (event_id, position) on delete cascade deferrable initially deferred
);

create table public.event_schedule_items (
  event_id text not null,
  position integer not null,
  id text,
  date date,
  time text,
  title text,
  description text,
  location text,
  sort_order integer,
  primary key (event_id, position),
  foreign key (event_id) references public.events (id) on delete cascade deferrable initially deferred
);

create table public.event_rules_documents (
  event_id text not null,
  title text,
  version text,
  updated_at timestamptz,
  format text,
  content_html text,
  file_name text,
  pdf_data_url text,
  file_url text,
  primary key (event_id),
  foreign key (event_id) references public.events (id) on delete cascade deferrable initially deferred
);

create table public.registration_payments (
  registration_id text not null,
  provider text,
  status text,
  amount_cents integer,
  expires_at timestamptz,
  checkout_session_id text,
  payment_intent_id text,
  paid_at timestamptz,
  refund_id text,
  error text,
  destination_account_id text,
  fee_cents integer,
  primary key (registration_id),
  foreign key (registration_id) references public.registrations (id) on delete cascade deferrable initially deferred
);

create table public.registration_payment_disputes (
  registration_id text not null,
  status text,
  amount_cents integer,
  reason text,
  opened_at timestamptz,
  updated_at timestamptz,
  primary key (registration_id),
  foreign key (registration_id) references public.registration_payments (registration_id) on delete cascade deferrable initially deferred
);

create table public.coupon_eligible_ticket_types (
  coupon_id text not null,
  position integer not null,
  ticket_type_id text,
  primary key (coupon_id, position),
  foreign key (coupon_id) references public.coupons (id) on delete cascade deferrable initially deferred
);

create table public.support_ticket_messages (
  ticket_id text not null,
  position integer not null,
  id text,
  author_id text,
  body text,
  created_at timestamptz,
  type text,
  client_id text,
  attachment_path text,
  attachment_name text,
  attachment_type text,
  attachment_size bigint,
  action_type text,
  action_value text,
  channel text,
  forwarding_id text,
  forward_organization_id text,
  forward_instructions text,
  primary key (ticket_id, position),
  foreign key (ticket_id) references public.support_tickets (id) on delete cascade deferrable initially deferred
);

create table public.support_message_shared_attachments (
  ticket_id text not null,
  message_position integer not null,
  position integer not null,
  source_message_id text,
  name text,
  type text,
  size bigint,
  primary key (ticket_id, message_position, position),
  foreign key (ticket_id, message_position) references public.support_ticket_messages (ticket_id, position) on delete cascade deferrable initially deferred
);

create table public.forum_post_images (
  post_id text not null,
  position integer not null,
  url text,
  alt text,
  primary key (post_id, position),
  foreign key (post_id) references public.forum_posts (id) on delete cascade deferrable initially deferred
);

create table public.forum_reply_images (
  reply_id text not null,
  url text,
  alt text,
  primary key (reply_id),
  foreign key (reply_id) references public.forum_replies (id) on delete cascade deferrable initially deferred
);

create table public.partner_links (
  partner_id text not null,
  position integer not null,
  id text,
  type text,
  url text,
  label text,
  phone text,
  message text,
  is_primary boolean,
  primary key (partner_id, position),
  foreign key (partner_id) references public.partners (id) on delete cascade deferrable initially deferred
);

create table public.home_section_geo_scopes (
  section_id text not null,
  scope text,
  region text,
  state text,
  city text,
  primary key (section_id),
  foreign key (section_id) references public.home_sections (id) on delete cascade deferrable initially deferred
);

create table public.home_section_schedules (
  section_id text not null,
  starts_at timestamptz,
  ends_at timestamptz,
  primary key (section_id),
  foreign key (section_id) references public.home_sections (id) on delete cascade deferrable initially deferred
);

create table public.home_section_highlights (
  section_id text not null,
  position integer not null,
  id text,
  event_id text,
  slot integer,
  promo_image_url text,
  badge text,
  headline text,
  starts_at timestamptz,
  ends_at timestamptz,
  primary key (section_id, position),
  foreign key (section_id) references public.home_sections (id) on delete cascade deferrable initially deferred
);

create table public.home_section_auto_selections (
  section_id text not null,
  scope text,
  region text,
  state text,
  city text,
  period_days integer,
  max_items integer,
  include_sold_out boolean,
  sort_by text,
  primary key (section_id),
  foreign key (section_id) references public.home_sections (id) on delete cascade deferrable initially deferred
);

create table public.home_section_partners (
  section_id text not null,
  position integer not null,
  partner_id text,
  slot integer,
  primary key (section_id, position),
  foreign key (section_id) references public.home_sections (id) on delete cascade deferrable initially deferred
);

create table public.home_section_banners (
  section_id text not null,
  desktop_image_url text,
  mobile_image_url text,
  alt_text text,
  headline text,
  button_text text,
  target_type text,
  target_value text,
  primary key (section_id),
  foreign key (section_id) references public.home_sections (id) on delete cascade deferrable initially deferred
);

create table public.event_boost_placements (
  boost_id text not null,
  position integer not null,
  placement text,
  primary key (boost_id, position),
  foreign key (boost_id) references public.event_boosts (id) on delete cascade deferrable initially deferred
);

create table public.event_boost_geo_scopes (
  boost_id text not null,
  scope text,
  region text,
  state text,
  city text,
  primary key (boost_id),
  foreign key (boost_id) references public.event_boosts (id) on delete cascade deferrable initially deferred
);

create table public.operator_profile_privacy (
  user_id uuid not null,
  history text,
  map text,
  badges text,
  equipment text,
  photos text,
  primary key (user_id),
  foreign key (user_id) references public.operator_profiles (user_id) on delete cascade deferrable initially deferred
);

create table public.operator_profile_hidden_events (
  user_id uuid not null,
  position integer not null,
  event_id text,
  primary key (user_id, position),
  foreign key (user_id) references public.operator_profiles (user_id) on delete cascade deferrable initially deferred
);

create table public.equipment_photos (
  equipment_id text not null,
  position integer not null,
  url text,
  primary key (equipment_id, position),
  foreign key (equipment_id) references public.equipment (id) on delete cascade deferrable initially deferred
);

create table public.equipment_invoices (
  equipment_id text not null,
  name text,
  type text,
  size bigint,
  uploaded_at timestamptz,
  primary key (equipment_id),
  foreign key (equipment_id) references public.equipment (id) on delete cascade deferrable initially deferred
);

create table public.badge_criteria (
  badge_id text not null,
  type text,
  target integer,
  primary key (badge_id),
  foreign key (badge_id) references public.badges (id) on delete cascade deferrable initially deferred
);

create table public.badge_award_criteria (
  award_id text not null,
  type text,
  target integer,
  primary key (award_id),
  foreign key (award_id) references public.badge_awards (id) on delete cascade deferrable initially deferred
);

create table public.reward_campaign_eligible_events (
  campaign_id text not null,
  position integer not null,
  event_id text,
  primary key (campaign_id, position),
  foreign key (campaign_id) references public.reward_campaigns (id) on delete cascade deferrable initially deferred
);

create table public.reward_campaign_eligible_ticket_types (
  campaign_id text not null,
  position integer not null,
  ticket_type_name text,
  primary key (campaign_id, position),
  foreign key (campaign_id) references public.reward_campaigns (id) on delete cascade deferrable initially deferred
);

create table public.voucher_benefits (
  voucher_id text not null,
  name text,
  organization_id text,
  type text,
  value integer,
  redeem_until timestamptz,
  rules text,
  primary key (voucher_id),
  foreign key (voucher_id) references public.vouchers (id) on delete cascade deferrable initially deferred
);

create table public.voucher_benefit_eligible_events (
  voucher_id text not null,
  position integer not null,
  event_id text,
  primary key (voucher_id, position),
  foreign key (voucher_id) references public.voucher_benefits (voucher_id) on delete cascade deferrable initially deferred
);

create table public.voucher_benefit_eligible_ticket_types (
  voucher_id text not null,
  position integer not null,
  ticket_type_name text,
  primary key (voucher_id, position),
  foreign key (voucher_id) references public.voucher_benefits (voucher_id) on delete cascade deferrable initially deferred
);

-- ===================== 5. Cópia do conteúdo dos jsonb =====================
insert into public.user_addresses (user_id, postal_code, street, number, complement, district, city, state)
select p.id, p.endereco->>'cep', p.endereco->>'logradouro', p.endereco->>'numero', p.endereco->>'complemento', p.endereco->>'bairro', p.endereco->>'cidade', p.endereco->>'uf'
from public.users p
where jsonb_typeof(p.endereco) = 'object';

insert into public.user_notification_settings (user_id, mute_all, mute_community)
select p.id, nullif(p.silencio_notificacoes->>'todas', '')::boolean, nullif(p.silencio_notificacoes->>'comunidade', '')::boolean
from public.users p
where jsonb_typeof(p.silencio_notificacoes) = 'object';

insert into public.user_support_reads (user_id, ticket_id, read_at)
select p.id, x3.k, nullif(x3.v, '')::timestamptz
from public.users p, jsonb_each_text(case when jsonb_typeof(p.silencio_notificacoes->'leiturasSuporte') = 'object' then p.silencio_notificacoes->'leiturasSuporte' else '{}' end) x3(k, v)
where jsonb_typeof(p.silencio_notificacoes) = 'object';

insert into public.user_modality_preferences (user_id, state, updated_at)
select p.id, p.preferencias_modalidade->>'estado', nullif(p.preferencias_modalidade->>'atualizadoEm', '')::timestamptz
from public.users p
where jsonb_typeof(p.preferencias_modalidade) = 'object';

insert into public.user_preferred_modalities (user_id, position, modality)
select p.id, (x5.n - 1)::integer, x5.v #>> '{}'
from public.users p, jsonb_array_elements(case when jsonb_typeof(p.preferencias_modalidade->'modalidades') = 'array' then p.preferencias_modalidade->'modalidades' else '[]' end) with ordinality x5(v, n)
where jsonb_typeof(p.preferencias_modalidade) = 'object';

insert into public.organization_payout_accounts (organization_id, provider, account_id, status, transfers_enabled, payouts_enabled, updated_at)
select p.id, p.recebimento->>'provedor', p.recebimento->>'contaId', p.recebimento->>'status', nullif(p.recebimento->>'transferenciasAtivas', '')::boolean, nullif(p.recebimento->>'saquesAtivos', '')::boolean, nullif(p.recebimento->>'atualizadoEm', '')::timestamptz
from public.organizations p
where jsonb_typeof(p.recebimento) = 'object';

insert into public.organization_payout_requirements (organization_id, position, requirement)
select p.id, (x7.n - 1)::integer, x7.v #>> '{}'
from public.organizations p, jsonb_array_elements(case when jsonb_typeof(p.recebimento->'pendencias') = 'array' then p.recebimento->'pendencias' else '[]' end) with ordinality x7(v, n)
where jsonb_typeof(p.recebimento) = 'object';

insert into public.event_images (event_id, original_url, alt, banner_zoom, banner_x, banner_y, card_zoom, card_x, card_y, banner_url)
select p.id, p.imagem->>'originalUrl', p.imagem->>'alt', nullif(p.imagem->'banner'->>'zoom', '')::double precision, nullif(p.imagem->'banner'->>'x', '')::double precision, nullif(p.imagem->'banner'->>'y', '')::double precision, nullif(p.imagem->'card'->>'zoom', '')::double precision, nullif(p.imagem->'card'->>'x', '')::double precision, nullif(p.imagem->'card'->>'y', '')::double precision, p.imagem->>'bannerUrl'
from public.events p
where jsonb_typeof(p.imagem) = 'object';

insert into public.event_factions (event_id, position, id, name, description, capacity)
select p.id, (x9.n - 1)::integer, x9.v->>'id', x9.v->>'nome', x9.v->>'descricao', nullif(x9.v->>'capacidade', '')::numeric::integer
from public.events p, jsonb_array_elements(case when jsonb_typeof(p.exercitos) = 'array' then p.exercitos else '[]' end) with ordinality x9(v, n);

insert into public.event_ticket_types (event_id, position, id, name, description, notes, benefits, base_price_cents, max_quantity, archived)
select p.id, (x10.n - 1)::integer, x10.v->>'id', x10.v->>'nome', x10.v->>'descricao', x10.v->>'observacoes', x10.v->>'beneficios', nullif(x10.v->>'precoBaseCentavos', '')::numeric::integer, nullif(x10.v->>'quantidadeMaxima', '')::numeric::integer, nullif(x10.v->>'arquivado', '')::boolean
from public.events p, jsonb_array_elements(case when jsonb_typeof(p.tipos) = 'array' then p.tipos else '[]' end) with ordinality x10(v, n);

insert into public.event_ticket_batches (event_id, position, id, name, sales_start_at, sales_end_at, status)
select p.id, (x11.n - 1)::integer, x11.v->>'id', x11.v->>'nome', nullif(x11.v->>'inicioVendas', '')::timestamptz, nullif(x11.v->>'fimVendas', '')::timestamptz, x11.v->>'status'
from public.events p, jsonb_array_elements(case when jsonb_typeof(p.lotes) = 'array' then p.lotes else '[]' end) with ordinality x11(v, n);

insert into public.event_ticket_batch_items (event_id, batch_position, position, ticket_type_id, price_cents, quantity)
select p.id, (x11.n - 1)::integer, (x12.n - 1)::integer, x12.v->>'tipoId', nullif(x12.v->>'precoCentavos', '')::numeric::integer, nullif(x12.v->>'quantidade', '')::numeric::integer
from public.events p, jsonb_array_elements(case when jsonb_typeof(p.lotes) = 'array' then p.lotes else '[]' end) with ordinality x11(v, n), jsonb_array_elements(case when jsonb_typeof(x11.v->'itens') = 'array' then x11.v->'itens' else '[]' end) with ordinality x12(v, n);

insert into public.event_schedule_items (event_id, position, id, date, time, title, description, location, sort_order)
select p.id, (x13.n - 1)::integer, x13.v->>'id', nullif(x13.v->>'data', '')::date, x13.v->>'horario', x13.v->>'titulo', x13.v->>'descricao', x13.v->>'local', nullif(x13.v->>'ordem', '')::numeric::integer
from public.events p, jsonb_array_elements(case when jsonb_typeof(p.cronograma) = 'array' then p.cronograma else '[]' end) with ordinality x13(v, n);

insert into public.event_rules_documents (event_id, title, version, updated_at, format, content_html, file_name, pdf_data_url, file_url)
select p.id, p.regras->>'titulo', p.regras->>'versao', nullif(p.regras->>'atualizadoEm', '')::timestamptz, p.regras->>'formato', p.regras->>'conteudoHtml', p.regras->>'nomeArquivo', p.regras->>'pdfDataUrl', p.regras->>'arquivoUrl'
from public.events p
where jsonb_typeof(p.regras) = 'object';

insert into public.registration_payments (registration_id, provider, status, amount_cents, expires_at, checkout_session_id, payment_intent_id, paid_at, refund_id, error, destination_account_id, fee_cents)
select p.id, p.pagamento->>'provedor', p.pagamento->>'status', nullif(p.pagamento->>'valorCentavos', '')::numeric::integer, nullif(p.pagamento->>'expiraEm', '')::timestamptz, p.pagamento->>'sessaoId', p.pagamento->>'intencaoId', nullif(p.pagamento->>'pagoEm', '')::timestamptz, p.pagamento->>'reembolsoId', p.pagamento->>'erro', p.pagamento->>'contaDestino', nullif(p.pagamento->>'taxaCentavos', '')::numeric::integer
from public.registrations p
where jsonb_typeof(p.pagamento) = 'object';

insert into public.registration_payment_disputes (registration_id, status, amount_cents, reason, opened_at, updated_at)
select p.id, p.pagamento->'disputa'->>'status', nullif(p.pagamento->'disputa'->>'valorCentavos', '')::numeric::integer, p.pagamento->'disputa'->>'motivo', nullif(p.pagamento->'disputa'->>'abertaEm', '')::timestamptz, nullif(p.pagamento->'disputa'->>'atualizadaEm', '')::timestamptz
from public.registrations p
where jsonb_typeof(p.pagamento) = 'object' and jsonb_typeof(p.pagamento->'disputa') = 'object';

insert into public.coupon_eligible_ticket_types (coupon_id, position, ticket_type_id)
select p.id, (x17.n - 1)::integer, x17.v #>> '{}'
from public.coupons p, jsonb_array_elements(case when jsonb_typeof(p.tipos_elegiveis) = 'array' then p.tipos_elegiveis else '[]' end) with ordinality x17(v, n);

insert into public.support_ticket_messages (ticket_id, position, id, author_id, body, created_at, type, client_id, attachment_path, attachment_name, attachment_type, attachment_size, action_type, action_value, channel, forwarding_id, forward_organization_id, forward_instructions)
select p.id, (x18.n - 1)::integer, x18.v->>'id', x18.v->>'autorId', x18.v->>'corpo', nullif(x18.v->>'criadoEm', '')::timestamptz, x18.v->>'tipo', x18.v->>'clienteId', x18.v->'anexo'->>'caminho', x18.v->'anexo'->>'nome', x18.v->'anexo'->>'tipo', nullif(x18.v->'anexo'->>'tamanho', '')::numeric::bigint, x18.v->'acao'->>'tipo', x18.v->'acao'->>'valor', x18.v->>'canal', x18.v->>'encaminhamentoId', x18.v->'encaminhamento'->>'organizacaoId', x18.v->'encaminhamento'->>'orientacao'
from public.support_tickets p, jsonb_array_elements(case when jsonb_typeof(p.mensagens) = 'array' then p.mensagens else '[]' end) with ordinality x18(v, n);

insert into public.support_message_shared_attachments (ticket_id, message_position, position, source_message_id, name, type, size)
select p.id, (x18.n - 1)::integer, (x19.n - 1)::integer, x19.v->>'mensagemId', x19.v->>'nome', x19.v->>'tipo', nullif(x19.v->>'tamanho', '')::numeric::bigint
from public.support_tickets p, jsonb_array_elements(case when jsonb_typeof(p.mensagens) = 'array' then p.mensagens else '[]' end) with ordinality x18(v, n), jsonb_array_elements(case when jsonb_typeof(x18.v->'encaminhamento'->'anexos') = 'array' then x18.v->'encaminhamento'->'anexos' else '[]' end) with ordinality x19(v, n);

insert into public.forum_post_images (post_id, position, url, alt)
select p.id, (x20.n - 1)::integer, x20.v->>'url', x20.v->>'alt'
from public.forum_posts p, jsonb_array_elements(case when jsonb_typeof(p.imagens) = 'array' then p.imagens else '[]' end) with ordinality x20(v, n);

insert into public.forum_reply_images (reply_id, url, alt)
select p.id, p.imagem->>'url', p.imagem->>'alt'
from public.forum_replies p
where jsonb_typeof(p.imagem) = 'object';

insert into public.partner_links (partner_id, position, id, type, url, label, phone, message, is_primary)
select p.id, (x22.n - 1)::integer, x22.v->>'id', x22.v->>'tipo', x22.v->>'url', x22.v->>'rotulo', x22.v->>'telefone', x22.v->>'mensagem', nullif(x22.v->>'principal', '')::boolean
from public.partners p, jsonb_array_elements(case when jsonb_typeof(p.links) = 'array' then p.links else '[]' end) with ordinality x22(v, n);

insert into public.home_section_geo_scopes (section_id, scope, region, state, city)
select p.id, p.abrangencia->>'escopo', p.abrangencia->>'regiao', p.abrangencia->>'uf', p.abrangencia->>'cidade'
from public.home_sections p
where jsonb_typeof(p.abrangencia) = 'object';

insert into public.home_section_schedules (section_id, starts_at, ends_at)
select p.id, nullif(p.agendamento->>'inicioEm', '')::timestamptz, nullif(p.agendamento->>'fimEm', '')::timestamptz
from public.home_sections p
where jsonb_typeof(p.agendamento) = 'object';

insert into public.home_section_highlights (section_id, position, id, event_id, slot, promo_image_url, badge, headline, starts_at, ends_at)
select p.id, (x25.n - 1)::integer, x25.v->>'id', x25.v->>'eventoId', nullif(x25.v->>'posicao', '')::numeric::integer, x25.v->>'imagemPromocional', x25.v->>'selo', x25.v->>'chamada', nullif(x25.v->'agendamento'->>'inicioEm', '')::timestamptz, nullif(x25.v->'agendamento'->>'fimEm', '')::timestamptz
from public.home_sections p, jsonb_array_elements(case when jsonb_typeof(p.destaques) = 'array' then p.destaques else '[]' end) with ordinality x25(v, n);

insert into public.home_section_auto_selections (section_id, scope, region, state, city, period_days, max_items, include_sold_out, sort_by)
select p.id, p.automatica->'abrangencia'->>'escopo', p.automatica->'abrangencia'->>'regiao', p.automatica->'abrangencia'->>'uf', p.automatica->'abrangencia'->>'cidade', nullif(p.automatica->>'periodoDias', '')::numeric::integer, nullif(p.automatica->>'maximo', '')::numeric::integer, nullif(p.automatica->>'incluirEsgotados', '')::boolean, p.automatica->>'ordenacao'
from public.home_sections p
where jsonb_typeof(p.automatica) = 'object';

insert into public.home_section_partners (section_id, position, partner_id, slot)
select p.id, (x27.n - 1)::integer, x27.v->>'parceiroId', nullif(x27.v->>'posicao', '')::numeric::integer
from public.home_sections p, jsonb_array_elements(case when jsonb_typeof(p.parceiros) = 'array' then p.parceiros else '[]' end) with ordinality x27(v, n);

insert into public.home_section_banners (section_id, desktop_image_url, mobile_image_url, alt_text, headline, button_text, target_type, target_value)
select p.id, p.banner->>'imagemDesktop', p.banner->>'imagemCelular', p.banner->>'textoAlt', p.banner->>'chamada', p.banner->>'textoBotao', p.banner->'destino'->>'tipo', p.banner->'destino'->>'valor'
from public.home_sections p
where jsonb_typeof(p.banner) = 'object';

insert into public.event_boost_placements (boost_id, position, placement)
select p.id, (x29.n - 1)::integer, x29.v #>> '{}'
from public.event_boosts p, jsonb_array_elements(case when jsonb_typeof(p.posicoes) = 'array' then p.posicoes else '[]' end) with ordinality x29(v, n);

insert into public.event_boost_geo_scopes (boost_id, scope, region, state, city)
select p.id, p.abrangencia->>'escopo', p.abrangencia->>'regiao', p.abrangencia->>'uf', p.abrangencia->>'cidade'
from public.event_boosts p
where jsonb_typeof(p.abrangencia) = 'object';

insert into public.operator_profile_privacy (user_id, history, map, badges, equipment, photos)
select p.user_id, p.privacidade->>'historico', p.privacidade->>'mapa', p.privacidade->>'insignias', p.privacidade->>'equipamentos', p.privacidade->>'fotos'
from public.operator_profiles p
where jsonb_typeof(p.privacidade) = 'object';

insert into public.operator_profile_hidden_events (user_id, position, event_id)
select p.user_id, (x32.n - 1)::integer, x32.v #>> '{}'
from public.operator_profiles p, jsonb_array_elements(case when jsonb_typeof(p.operacoes_ocultas) = 'array' then p.operacoes_ocultas else '[]' end) with ordinality x32(v, n);

insert into public.equipment_photos (equipment_id, position, url)
select p.id, (x33.n - 1)::integer, x33.v #>> '{}'
from public.equipment p, jsonb_array_elements(case when jsonb_typeof(p.fotos) = 'array' then p.fotos else '[]' end) with ordinality x33(v, n);

insert into public.equipment_invoices (equipment_id, name, type, size, uploaded_at)
select p.id, p.nota->>'nome', p.nota->>'tipo', nullif(p.nota->>'tamanho', '')::numeric::bigint, nullif(p.nota->>'enviadaEm', '')::timestamptz
from public.equipment p
where jsonb_typeof(p.nota) = 'object';

insert into public.badge_criteria (badge_id, type, target)
select p.id, p.criterio->>'tipo', nullif(p.criterio->>'meta', '')::numeric::integer
from public.badges p
where jsonb_typeof(p.criterio) = 'object';

insert into public.badge_award_criteria (award_id, type, target)
select p.id, p.criterio->>'tipo', nullif(p.criterio->>'meta', '')::numeric::integer
from public.badge_awards p
where jsonb_typeof(p.criterio) = 'object';

insert into public.reward_campaign_eligible_events (campaign_id, position, event_id)
select p.id, (x37.n - 1)::integer, x37.v #>> '{}'
from public.reward_campaigns p, jsonb_array_elements(case when jsonb_typeof(p.eventos_elegiveis) = 'array' then p.eventos_elegiveis else '[]' end) with ordinality x37(v, n);

insert into public.reward_campaign_eligible_ticket_types (campaign_id, position, ticket_type_name)
select p.id, (x38.n - 1)::integer, x38.v #>> '{}'
from public.reward_campaigns p, jsonb_array_elements(case when jsonb_typeof(p.tipos_elegiveis) = 'array' then p.tipos_elegiveis else '[]' end) with ordinality x38(v, n);

insert into public.voucher_benefits (voucher_id, name, organization_id, type, value, redeem_until, rules)
select p.id, p.beneficio->>'nome', p.beneficio->>'organizacaoId', p.beneficio->>'tipo', nullif(p.beneficio->>'valor', '')::numeric::integer, nullif(p.beneficio->>'resgatarAte', '')::timestamptz, p.beneficio->>'regras'
from public.vouchers p
where jsonb_typeof(p.beneficio) = 'object';

insert into public.voucher_benefit_eligible_events (voucher_id, position, event_id)
select p.id, (x40.n - 1)::integer, x40.v #>> '{}'
from public.vouchers p, jsonb_array_elements(case when jsonb_typeof(p.beneficio->'eventosElegiveis') = 'array' then p.beneficio->'eventosElegiveis' else '[]' end) with ordinality x40(v, n)
where jsonb_typeof(p.beneficio) = 'object';

insert into public.voucher_benefit_eligible_ticket_types (voucher_id, position, ticket_type_name)
select p.id, (x41.n - 1)::integer, x41.v #>> '{}'
from public.vouchers p, jsonb_array_elements(case when jsonb_typeof(p.beneficio->'tiposElegiveis') = 'array' then p.beneficio->'tiposElegiveis' else '[]' end) with ordinality x41(v, n)
where jsonb_typeof(p.beneficio) = 'object';

-- Confere as chaves estrangeiras agora: o ALTER TABLE abaixo não roda com checagens pendentes.
set constraints all immediate;

-- ===================== 6. Colunas jsonb copiadas =====================
alter table public.users drop column endereco;
alter table public.users drop column silencio_notificacoes;
alter table public.users drop column preferencias_modalidade;
alter table public.organizations drop column recebimento;
alter table public.events drop column imagem;
alter table public.events drop column exercitos;
alter table public.events drop column tipos;
alter table public.events drop column lotes;
alter table public.events drop column cronograma;
alter table public.events drop column regras;
alter table public.registrations drop column pagamento;
alter table public.coupons drop column tipos_elegiveis;
alter table public.support_tickets drop column mensagens;
alter table public.forum_posts drop column imagens;
alter table public.forum_replies drop column imagem;
alter table public.partners drop column links;
alter table public.home_sections drop column abrangencia;
alter table public.home_sections drop column agendamento;
alter table public.home_sections drop column destaques;
alter table public.home_sections drop column automatica;
alter table public.home_sections drop column parceiros;
alter table public.home_sections drop column banner;
alter table public.event_boosts drop column posicoes;
alter table public.event_boosts drop column abrangencia;
alter table public.operator_profiles drop column privacidade;
alter table public.operator_profiles drop column operacoes_ocultas;
alter table public.equipment drop column fotos;
alter table public.equipment drop column nota;
alter table public.badges drop column criterio;
alter table public.badge_awards drop column criterio;
alter table public.reward_campaigns drop column eventos_elegiveis;
alter table public.reward_campaigns drop column tipos_elegiveis;
alter table public.vouchers drop column beneficio;

-- ===================== 7. Funções da base =====================
drop function public.aplicar_mudancas(jsonb, bigint);
drop function public.exportar_base();
drop function public.tabelas_base();

-- Tabelas que compõem a BaseDados carregada pelo servidor (ordem irrelevante: as FKs são
-- adiadas até o commit). Espelha TABELAS_BANCO em src/lib/persistencia.ts (há teste).
create function public.base_tables()
returns text[]
language sql
immutable
set search_path = ''
as $$
  select array[
    'users', 'user_addresses', 'user_notification_settings', 'user_support_reads',
    'user_modality_preferences', 'user_preferred_modalities', 'organizations',
    'organization_payout_accounts', 'organization_payout_requirements', 'organizer_requests', 'events',
    'event_images', 'event_factions', 'event_ticket_types', 'event_ticket_batches',
    'event_ticket_batch_items', 'event_schedule_items', 'event_rules_documents', 'registrations',
    'registration_payments', 'registration_payment_disputes', 'coupons',
    'coupon_eligible_ticket_types', 'complimentary_tickets', 'missions', 'mission_submissions',
    'announcements', 'announcement_comments', 'support_tickets', 'support_ticket_messages',
    'support_message_shared_attachments', 'notifications', 'financial_transactions', 'audit_logs',
    'privacy_requests', 'forums', 'forum_posts', 'forum_post_images', 'forum_replies',
    'forum_reply_images', 'forum_post_likes', 'community_reports', 'forum_preferences',
    'community_restrictions', 'moderation_logs', 'partners', 'partner_links', 'home_sections',
    'home_section_geo_scopes', 'home_section_schedules', 'home_section_highlights',
    'home_section_auto_selections', 'home_section_partners', 'home_section_banners', 'event_boosts',
    'event_boost_placements', 'event_boost_geo_scopes', 'check_ins', 'operator_profiles',
    'operator_profile_privacy', 'operator_profile_hidden_events', 'equipment', 'equipment_photos',
    'equipment_invoices', 'profile_photos', 'badges', 'badge_criteria', 'badge_awards',
    'badge_award_criteria', 'reward_campaigns', 'reward_campaign_eligible_events',
    'reward_campaign_eligible_ticket_types', 'vouchers', 'voucher_benefits',
    'voucher_benefit_eligible_events', 'voucher_benefit_eligible_ticket_types',
    'attendance_corrections', 'platform_settings', 'community_visits'
  ]::text[];
$$;

-- Lê a base inteira em uma só ida ao banco: { version, tables: { nome: [linhas] } }.
create function public.export_base()
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  v_tables jsonb := '{}'::jsonb;
  v_rows jsonb;
  v_version bigint;
  t text;
begin
  select version into v_version from public.base_control where id = 1;
  foreach t in array public.base_tables() loop
    execute format('select coalesce(jsonb_agg(to_jsonb(x)), ''[]''::jsonb) from public.%I x', t)
      into v_rows;
    v_tables := v_tables || jsonb_build_object(t, v_rows);
  end loop;
  return jsonb_build_object('version', v_version, 'tables', v_tables);
end;
$$;

-- Aplica um lote { tabela: { gravar: [linhas], excluir: [chaves] } } numa única transação,
-- desde que a versão lida ainda seja a atual. Devolve a nova versão. Conflito = MS409 (nunca
-- 40001: o PostgREST repete 40001 sem limite).
create function public.apply_changes(p_changes jsonb, p_version bigint)
returns bigint
language plpgsql
set search_path = ''
as $$
declare
  v_new bigint;
  t text;
  v_rel regclass;
  v_pk text[];
  v_cols text[];
  v_upsert jsonb;
  v_delete jsonb;
begin
  update public.base_control set version = version + 1
    where id = 1 and version = p_version
    returning version into v_new;
  if v_new is null then
    raise exception 'version_conflict' using errcode = 'MS409';
  end if;

  for t in select jsonb_object_keys(p_changes) loop
    if not (t = any (public.base_tables())) then
      raise exception 'table not allowed: %', t;
    end if;
    v_rel := format('public.%I', t)::regclass;

    select array_agg(a.attname::text order by array_position(i.indkey::int2[], a.attnum))
      into v_pk
      from pg_catalog.pg_index i
      join pg_catalog.pg_attribute a on a.attrelid = i.indrelid and a.attnum = any (i.indkey)
     where i.indrelid = v_rel and i.indisprimary;

    select array_agg(a.attname::text order by a.attnum)
      into v_cols
      from pg_catalog.pg_attribute a
     where a.attrelid = v_rel and a.attnum > 0 and not a.attisdropped
       and not (a.attname::text = any (v_pk));

    v_delete := coalesce(p_changes -> t -> 'excluir', '[]'::jsonb);
    if jsonb_array_length(v_delete) > 0 then
      execute format(
        'delete from %s d using jsonb_populate_recordset(null::%s, $1) x where %s',
        v_rel, v_rel,
        (select string_agg(format('d.%1$I = x.%1$I', c), ' and ') from unnest(v_pk) c)
      ) using v_delete;
    end if;

    v_upsert := coalesce(p_changes -> t -> 'gravar', '[]'::jsonb);
    if jsonb_array_length(v_upsert) > 0 then
      if v_cols is null then
        -- Tabela só com colunas de chave: basta inserir o que faltar.
        execute format(
          'insert into %s select * from jsonb_populate_recordset(null::%s, $1) on conflict do nothing',
          v_rel, v_rel
        ) using v_upsert;
      else
        execute format(
          'insert into %s select * from jsonb_populate_recordset(null::%s, $1) '
          'on conflict (%s) do update set (%s) = row(%s)',
          v_rel, v_rel,
          (select string_agg(format('%I', c), ', ') from unnest(v_pk) c),
          (select string_agg(format('%I', c), ', ') from unnest(v_cols) c),
          (select string_agg(format('excluded.%I', c), ', ') from unnest(v_cols) c)
        ) using v_upsert;
      end if;
    end if;
  end loop;

  return v_new;
end;
$$;

revoke all on function public.base_tables() from public, anon, authenticated;
revoke all on function public.export_base() from public, anon, authenticated;
revoke all on function public.apply_changes(jsonb, bigint) from public, anon, authenticated;
grant execute on function public.base_tables() to service_role;
grant execute on function public.export_base() to service_role;
grant execute on function public.apply_changes(jsonb, bigint) to service_role;

-- ===================== 8. Segurança (tabelas novas incluídas) =====================
do $$
declare
  t text;
begin
  for t in select tablename from pg_catalog.pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('grant select, insert, update, delete on public.%I to service_role', t);
  end loop;
end
$$;

-- O servidor guarda a última exportação da base; a nova versão força a releitura.
update public.base_control set version = version + 1 where id = 1;

notify pgrst, 'reload schema';
commit;
