// Esquema do banco (nomes em inglês) ↔ campos dos tipos de domínio (camelCase em português).
// Fonte única dos nomes de tabelas e colunas usados por src/lib/persistencia.ts: cada
// coleção da BaseDados vira uma tabela, cada campo escalar uma coluna, e cada lista ou
// objeto aninhado (antes jsonb) uma tabela filha ligada ao registro pai por chave estrangeira.
// As migrations em supabase/migrations/ seguem exatamente estes nomes.

/** Campo escalar: nome da coluna. */
export type Coluna = string;

/** Lista → tabela filha com uma linha por item, na ordem (coluna `position`). */
export interface Lista {
  tipo: "lista";
  tabela: string;
  /** Colunas da chave estrangeira para o pai, na ordem da chave primária do pai. */
  pai: string[];
  /** Itens objeto (campos → colunas) ou escalares (nome da coluna do valor). */
  itens: Campos | Coluna;
}

/** Objeto 1:1 → tabela filha com no máximo uma linha por pai (ausente = sem linha). */
export interface Objeto {
  tipo: "objeto";
  tabela: string;
  pai: string[];
  campos: Campos;
}

/** Mapa chave → valor → tabela filha com uma linha por chave. */
export interface Mapa {
  tipo: "mapa";
  tabela: string;
  pai: string[];
  chave: Coluna;
  valor: Coluna;
}

/**
 * Objeto pequeno dentro de uma tabela filha, gravado como colunas da própria linha.
 * `presenca`: coluna obrigatória que indica se o objeto opcional existe; sem ela o objeto
 * é obrigatório e sempre volta (ainda que vazio).
 */
export interface Embutido {
  tipo: "embutido";
  campos: Campos;
  presenca?: Coluna | undefined;
}

export type Campo = Coluna | Lista | Objeto | Mapa | Embutido;
export type Campos = Record<string, Campo>;

export interface Tabela {
  tabela: string;
  /** Campos (camelCase) que formam a chave primária. */
  chave: string[];
  campos: Campos;
}

const lista = (tabela: string, pai: string[], itens: Campos | Coluna): Lista => ({ tipo: "lista", tabela, pai, itens });
const objeto = (tabela: string, pai: string[], campos: Campos): Objeto => ({ tipo: "objeto", tabela, pai, campos });
const mapa = (tabela: string, pai: string[], chave: Coluna, valor: Coluna): Mapa => ({ tipo: "mapa", tabela, pai, chave, valor });
const embutido = (campos: Campos, presenca?: Coluna): Embutido => ({ tipo: "embutido", campos, presenca });

const abrangencia: Campos = { escopo: "scope", regiao: "region", uf: "state", cidade: "city" };
const recorte = (p: string): Campos => ({ zoom: `${p}_zoom`, x: `${p}_x`, y: `${p}_y` });

// ===== Coleções da base transacional =====

export const ESQUEMA = {
  usuarios: {
    tabela: "users", chave: ["id"],
    campos: {
      id: "id", perfil: "role", nomeCompleto: "full_name", cpf: "cpf", dataNascimento: "birth_date",
      email: "email", whatsapp: "whatsapp",
      endereco: objeto("user_addresses", ["user_id"], {
        cep: "postal_code", logradouro: "street", numero: "number", complemento: "complement",
        bairro: "district", cidade: "city", uf: "state",
      }),
      instagram: "instagram", squad: "squad", fotoUrl: "photo_url", nomeExibicao: "display_name",
      silencioNotificacoes: objeto("user_notification_settings", ["user_id"], {
        todas: "mute_all", comunidade: "mute_community",
        leiturasSuporte: mapa("user_support_reads", ["user_id"], "ticket_id", "read_at"),
      }),
      tema: "theme",
      preferenciasModalidade: objeto("user_modality_preferences", ["user_id"], {
        estado: "state", atualizadoEm: "updated_at",
        modalidades: lista("user_preferred_modalities", ["user_id"], "modality"),
      }),
      autorizacaoResponsavel: "guardian_authorization", autorizacaoPromocional: "marketing_consent",
      aceiteTermosVersao: "terms_version", aceiteTermosEm: "terms_accepted_at",
      organizacaoId: "organization_id", ativo: "active", criadoEm: "created_at",
    },
  },
  organizacoes: {
    tabela: "organizations", chave: ["id"],
    campos: {
      id: "id", nome: "name", cnpj: "cnpj", instagram: "instagram", telefone: "phone",
      responsavelId: "owner_id", status: "status", criadoEm: "created_at",
      recebimento: objeto("organization_payout_accounts", ["organization_id"], {
        provedor: "provider", contaId: "account_id", status: "status", transferenciasAtivas: "transfers_enabled",
        saquesAtivos: "payouts_enabled", atualizadoEm: "updated_at",
        pendencias: lista("organization_payout_requirements", ["organization_id"], "requirement"),
      }),
    },
  },
  solicitacoes: {
    tabela: "organizer_requests", chave: ["id"],
    campos: {
      id: "id", usuarioId: "user_id", possuiCnpj: "has_cnpj", cnpj: "cnpj", nomeOrganizacao: "organization_name",
      instagram: "instagram", telefone: "phone", status: "status", observacaoAdmin: "admin_note",
      criadoEm: "created_at", atualizadoEm: "updated_at",
    },
  },
  eventos: {
    tabela: "events", chave: ["id"],
    campos: {
      id: "id", organizacaoId: "organization_id", nome: "name", descricaoResumida: "summary", enredo: "storyline",
      inicioEm: "starts_at", fimEm: "ends_at", fuso: "time_zone", local: "venue", cep: "postal_code",
      endereco: "address", cidade: "city", uf: "state", capacidadeTotal: "total_capacity", imagemUrl: "image_url",
      imagem: objeto("event_images", ["event_id"], {
        originalUrl: "original_url", alt: "alt", banner: embutido(recorte("banner")), card: embutido(recorte("card")),
        bannerUrl: "banner_url",
      }),
      exercitos: lista("event_factions", ["event_id"], { id: "id", nome: "name", descricao: "description", capacidade: "capacity" }),
      tipos: lista("event_ticket_types", ["event_id"], {
        id: "id", nome: "name", descricao: "description", observacoes: "notes", beneficios: "benefits",
        precoBaseCentavos: "base_price_cents", quantidadeMaxima: "max_quantity", arquivado: "archived",
      }),
      lotes: lista("event_ticket_batches", ["event_id"], {
        id: "id", nome: "name", inicioVendas: "sales_start_at", fimVendas: "sales_end_at", status: "status",
        itens: lista("event_ticket_batch_items", ["event_id", "batch_position"], {
          tipoId: "ticket_type_id", precoCentavos: "price_cents", quantidade: "quantity",
        }),
      }),
      cronograma: lista("event_schedule_items", ["event_id"], {
        id: "id", data: "date", horario: "time", titulo: "title", descricao: "description", local: "location",
        ordem: "sort_order",
      }),
      regras: objeto("event_rules_documents", ["event_id"], {
        titulo: "title", versao: "version", atualizadoEm: "updated_at", formato: "format", conteudoHtml: "content_html",
        nomeArquivo: "file_name", pdfDataUrl: "pdf_data_url", arquivoUrl: "file_url",
      }),
      modalidade: "modality", whatsappContato: "whatsapp_contact", whatsappGrupoUrl: "whatsapp_group_url",
      status: "status", criadoEm: "created_at",
    },
  },
  inscricoes: {
    tabela: "registrations", chave: ["id"],
    campos: {
      id: "id", eventoId: "event_id", usuarioId: "user_id", tipoId: "ticket_type_id", loteId: "batch_id",
      exercitoId: "faction_id", codigo: "code", tokenEntrada: "entry_token", status: "status", origem: "source",
      valorCentavos: "amount_cents", descontoCentavos: "discount_cents", cupomId: "coupon_id",
      cortesiaId: "complimentary_ticket_id", voucherId: "voucher_id",
      pagamento: objeto("registration_payments", ["registration_id"], {
        provedor: "provider", status: "status", valorCentavos: "amount_cents", expiraEm: "expires_at",
        sessaoId: "checkout_session_id", intencaoId: "payment_intent_id", pagoEm: "paid_at", reembolsoId: "refund_id",
        erro: "error", contaDestino: "destination_account_id", taxaCentavos: "fee_cents",
        disputa: objeto("registration_payment_disputes", ["registration_id"], {
          status: "status", valorCentavos: "amount_cents", motivo: "reason", abertaEm: "opened_at", atualizadaEm: "updated_at",
        }),
      }),
      criadoEm: "created_at", canceladoEm: "cancelled_at", motivoCancelamento: "cancellation_reason",
    },
  },
  cupons: {
    tabela: "coupons", chave: ["id"],
    campos: {
      id: "id", eventoId: "event_id", codigo: "code", descontoPercentual: "discount_percent", validoDe: "valid_from",
      validoAte: "valid_until", limiteUsos: "usage_limit", usos: "uses",
      tiposElegiveis: lista("coupon_eligible_ticket_types", ["coupon_id"], "ticket_type_id"),
      ativo: "active",
    },
  },
  cortesias: {
    tabela: "complimentary_tickets", chave: ["id"],
    campos: {
      id: "id", eventoId: "event_id", nomeConvidado: "guest_name", emailConvidado: "guest_email", tipoId: "ticket_type_id",
      exercitoId: "faction_id", validade: "expires_at", codigo: "code", status: "status", criadoEm: "created_at",
    },
  },
  missoes: {
    tabela: "missions", chave: ["id"],
    campos: {
      id: "id", eventoId: "event_id", titulo: "title", descricao: "description", imagemUrl: "image_url",
      prazo: "deadline", publico: "audience", tipoEntrega: "submission_type", exigeAprovacao: "requires_approval",
    },
  },
  entregas: {
    tabela: "mission_submissions", chave: ["id"],
    campos: {
      id: "id", missaoId: "mission_id", usuarioId: "user_id", status: "status", conteudo: "content",
      enviadoEm: "submitted_at", avaliacao: "review",
    },
  },
  comunicados: {
    tabela: "announcements", chave: ["id"],
    campos: {
      id: "id", eventoId: "event_id", autorId: "author_id", titulo: "title", corpo: "body", imagemUrl: "image_url",
      fixado: "pinned", segmentoExercitoId: "target_faction_id", criadoEm: "created_at",
    },
  },
  comentarios: {
    tabela: "announcement_comments", chave: ["id"],
    campos: { id: "id", comunicadoId: "announcement_id", autorId: "author_id", corpo: "body", criadoEm: "created_at" },
  },
  chamados: {
    tabela: "support_tickets", chave: ["id"],
    campos: {
      id: "id", eventoId: "event_id", solicitanteId: "requester_id", assunto: "subject", categoria: "category",
      descricao: "description", status: "status",
      mensagens: lista("support_ticket_messages", ["ticket_id"], {
        id: "id", autorId: "author_id", corpo: "body", criadoEm: "created_at", tipo: "type", clienteId: "client_id",
        anexo: embutido({ caminho: "attachment_path", nome: "attachment_name", tipo: "attachment_type", tamanho: "attachment_size" }, "attachment_path"),
        acao: embutido({ tipo: "action_type", valor: "action_value" }, "action_type"),
        canal: "channel", encaminhamentoId: "forwarding_id",
        encaminhamento: embutido({
          organizacaoId: "forward_organization_id", orientacao: "forward_instructions",
          anexos: lista("support_message_shared_attachments", ["ticket_id", "message_position"], {
            mensagemId: "source_message_id", nome: "name", tipo: "type", tamanho: "size",
          }),
        }, "forward_organization_id"),
      }),
      criadoEm: "created_at", atualizadoEm: "updated_at",
    },
  },
  notificacoes: {
    tabela: "notifications", chave: ["id"],
    campos: { id: "id", usuarioId: "user_id", titulo: "title", corpo: "body", link: "link", lida: "read", criadoEm: "created_at" },
  },
  movimentacoes: {
    tabela: "financial_transactions", chave: ["id"],
    campos: {
      id: "id", eventoId: "event_id", inscricaoId: "registration_id", tipo: "type", valorCentavos: "amount_cents",
      descricao: "description", criadoEm: "created_at",
    },
  },
  auditoria: {
    tabela: "audit_logs", chave: ["id"],
    campos: {
      id: "id", autorId: "author_id", acao: "action", entidade: "entity", entidadeId: "entity_id",
      justificativa: "justification", criadoEm: "created_at",
    },
  },
  privacidade: {
    tabela: "privacy_requests", chave: ["id"],
    campos: {
      id: "id", usuarioId: "user_id", tipo: "type", detalhes: "details", status: "status", resposta: "response",
      criadoEm: "created_at",
    },
  },
  foruns: {
    tabela: "forums", chave: ["id"],
    campos: {
      id: "id", eventoId: "event_id", nome: "name", descricao: "description", icone: "icon", regras: "rules",
      ordem: "sort_order", publico: "audience", publicacao: "post_permission", respostas: "reply_permission",
      status: "status", criadoEm: "created_at",
    },
  },
  publicacoes: {
    tabela: "forum_posts", chave: ["id"],
    campos: {
      id: "id", forumId: "forum_id", eventoId: "event_id", autorId: "author_id", texto: "text",
      imagens: lista("forum_post_images", ["post_id"], { url: "url", alt: "alt" }),
      fixada: "pinned", importante: "important", respostasFechadas: "replies_closed", oculta: "hidden",
      motivoOcultacao: "hidden_reason", removidaPeloAutor: "removed_by_author", editadoEm: "edited_at",
      criadoEm: "created_at",
    },
  },
  respostas: {
    tabela: "forum_replies", chave: ["id"],
    campos: {
      id: "id", publicacaoId: "post_id", autorId: "author_id", texto: "text",
      imagem: objeto("forum_reply_images", ["reply_id"], { url: "url", alt: "alt" }),
      oculta: "hidden", motivoOcultacao: "hidden_reason", editadoEm: "edited_at", criadoEm: "created_at",
    },
  },
  curtidas: {
    tabela: "forum_post_likes", chave: ["id"],
    campos: { id: "id", publicacaoId: "post_id", usuarioId: "user_id" },
  },
  denuncias: {
    tabela: "community_reports", chave: ["id"],
    campos: {
      id: "id", eventoId: "event_id", alvo: "target_type", alvoId: "target_id", denuncianteId: "reporter_id",
      motivo: "reason", descricao: "description", status: "status", criadoEm: "created_at",
    },
  },
  preferenciasForum: {
    tabela: "forum_preferences", chave: ["usuarioId", "forumId"],
    campos: { usuarioId: "user_id", forumId: "forum_id", modo: "mode" },
  },
  restricoesComunidade: {
    tabela: "community_restrictions", chave: ["id"],
    campos: {
      id: "id", eventoId: "event_id", usuarioId: "user_id", justificativa: "justification", ativa: "active",
      criadoEm: "created_at",
    },
  },
  moderacao: {
    tabela: "moderation_logs", chave: ["id"],
    campos: {
      id: "id", eventoId: "event_id", autorId: "author_id", acao: "action", alvoId: "target_id",
      justificativa: "justification", criadoEm: "created_at",
    },
  },
  parceiros: {
    tabela: "partners", chave: ["id"],
    campos: {
      id: "id", nome: "name", tipo: "type", descricao: "description", logoUrl: "logo_url", textoAlt: "alt_text",
      links: lista("partner_links", ["partner_id"], {
        id: "id", tipo: "type", url: "url", rotulo: "label", telefone: "phone", mensagem: "message", principal: "is_primary",
      }),
      ativo: "active", criadoEm: "created_at", atualizadoEm: "updated_at",
    },
  },
  secoesInicio: {
    tabela: "home_sections", chave: ["id"],
    campos: {
      id: "id", titulo: "title", subtitulo: "subtitle", tipo: "type",
      abrangencia: objeto("home_section_geo_scopes", ["section_id"], abrangencia),
      ordem: "sort_order", status: "status",
      agendamento: objeto("home_section_schedules", ["section_id"], { inicioEm: "starts_at", fimEm: "ends_at" }),
      layout: "layout", modo: "mode",
      destaques: lista("home_section_highlights", ["section_id"], {
        id: "id", eventoId: "event_id", posicao: "slot", imagemPromocional: "promo_image_url", selo: "badge",
        chamada: "headline", agendamento: embutido({ inicioEm: "starts_at", fimEm: "ends_at" }),
      }),
      automatica: objeto("home_section_auto_selections", ["section_id"], {
        abrangencia: embutido(abrangencia), periodoDias: "period_days", maximo: "max_items",
        incluirEsgotados: "include_sold_out", ordenacao: "sort_by",
      }),
      mostrarEsgotados: "show_sold_out",
      parceiros: lista("home_section_partners", ["section_id"], { parceiroId: "partner_id", posicao: "slot" }),
      tamanhoLogo: "logo_size", mostrarDescricoes: "show_descriptions", superficieLogo: "logo_surface",
      banner: objeto("home_section_banners", ["section_id"], {
        imagemDesktop: "desktop_image_url", imagemCelular: "mobile_image_url", textoAlt: "alt_text", chamada: "headline",
        textoBotao: "button_text", destino: embutido({ tipo: "target_type", valor: "target_value" }, "target_type"),
      }),
      criadoEm: "created_at", atualizadoEm: "updated_at",
    },
  },
  impulsionamentos: {
    tabela: "event_boosts", chave: ["id"],
    campos: {
      id: "id", eventoId: "event_id", nome: "name", objetivo: "goal",
      posicoes: lista("event_boost_placements", ["boost_id"], "placement"),
      abrangencia: objeto("event_boost_geo_scopes", ["boost_id"], abrangencia),
      inicioEm: "starts_at", fimEm: "ends_at", fuso: "time_zone", prioridade: "priority", ordem: "sort_order",
      imagemPromocional: "promo_image_url", chamada: "headline", status: "status", criadoPor: "created_by",
      criadoEm: "created_at", atualizadoEm: "updated_at",
    },
  },
  checkins: {
    tabela: "check_ins", chave: ["id"],
    campos: {
      id: "id", eventoId: "event_id", inscricaoId: "registration_id", tipo: "type", revertidoId: "reverted_id",
      origem: "source", motivo: "reason", operadorId: "operator_id", operadorNome: "operator_name",
      dispositivoId: "device_id", em: "occurred_at", sync: "sync_status", conflito: "conflict",
    },
  },
  perfisOperador: {
    tabela: "operator_profiles", chave: ["usuarioId"],
    campos: {
      usuarioId: "user_id", callsign: "callsign", bio: "bio", squad: "squad", instagram: "instagram",
      capaUrl: "cover_url", insigniaDestaque: "featured_badge_id",
      privacidade: objeto("operator_profile_privacy", ["user_id"], {
        historico: "history", mapa: "map", insignias: "badges", equipamentos: "equipment", fotos: "photos",
      }),
      operacoesOcultas: lista("operator_profile_hidden_events", ["user_id"], "event_id"),
      introVista: "intro_seen", atualizadoEm: "updated_at",
    },
  },
  equipamentos: {
    tabela: "equipment", chave: ["id"],
    campos: {
      id: "id", usuarioId: "user_id", marca: "brand", tipo: "type", modelo: "model", apelido: "nickname",
      observacoes: "notes", fotos: lista("equipment_photos", ["equipment_id"], "url"),
      nota: objeto("equipment_invoices", ["equipment_id"], { nome: "name", tipo: "type", tamanho: "size", enviadaEm: "uploaded_at" }),
      visivel: "visible", criadoEm: "created_at", atualizadoEm: "updated_at",
    },
  },
  fotosPerfil: {
    tabela: "profile_photos", chave: ["id"],
    campos: {
      id: "id", usuarioId: "user_id", url: "url", legenda: "caption", alt: "alt", visivel: "visible", criadoEm: "created_at",
    },
  },
  insignias: {
    tabela: "badges", chave: ["id"],
    campos: {
      id: "id", nome: "name", descricao: "description", icone: "icon",
      criterio: objeto("badge_criteria", ["badge_id"], { tipo: "type", meta: "target" }),
      ativa: "active", versao: "version", criadoEm: "created_at", atualizadoEm: "updated_at",
    },
  },
  concessoesInsignia: {
    tabela: "badge_awards", chave: ["id"],
    campos: {
      id: "id", usuarioId: "user_id", insigniaId: "badge_id", versaoRegra: "rule_version",
      criterio: objeto("badge_award_criteria", ["award_id"], { tipo: "type", meta: "target" }),
      conquistadaEm: "earned_at", revogadaEm: "revoked_at", motivoRevogacao: "revocation_reason",
    },
  },
  campanhasRecompensa: {
    tabela: "reward_campaigns", chave: ["id"],
    campos: {
      id: "id", nome: "name", descricao: "description", insigniaId: "badge_id", organizacaoId: "organization_id",
      tipo: "type", valor: "value",
      eventosElegiveis: lista("reward_campaign_eligible_events", ["campaign_id"], "event_id"),
      tiposElegiveis: lista("reward_campaign_eligible_ticket_types", ["campaign_id"], "ticket_type_name"),
      maximo: "max_vouchers", limitePorParticipante: "limit_per_participant", inicioEm: "starts_at",
      conquistarAte: "earn_until", resgatarAte: "redeem_until", regras: "rules", aceitaAnteriores: "accepts_previous",
      ativa: "active", versao: "version", autorizacao: "authorization_ref", criadoPor: "created_by", criadoEm: "created_at",
    },
  },
  vouchers: {
    tabela: "vouchers", chave: ["id"],
    campos: {
      id: "id", campanhaId: "campaign_id", campanhaVersao: "campaign_version", usuarioId: "user_id",
      concessaoId: "award_id",
      beneficio: objeto("voucher_benefits", ["voucher_id"], {
        nome: "name", organizacaoId: "organization_id", tipo: "type", valor: "value",
        eventosElegiveis: lista("voucher_benefit_eligible_events", ["voucher_id"], "event_id"),
        tiposElegiveis: lista("voucher_benefit_eligible_ticket_types", ["voucher_id"], "ticket_type_name"),
        resgatarAte: "redeem_until", regras: "rules",
      }),
      codigo: "code", status: "status", concedidoEm: "granted_at", inscricaoId: "registration_id", usadoEm: "used_at",
      motivo: "reason", ocorrencia: "incident",
    },
  },
  correcoesParticipacao: {
    tabela: "attendance_corrections", chave: ["id"],
    campos: {
      id: "id", usuarioId: "user_id", eventoId: "event_id", tipo: "type", justificativa: "justification",
      autorId: "author_id", criadoEm: "created_at",
    },
  },
  configuracoes: {
    tabela: "platform_settings", chave: ["id"],
    campos: { id: "id", taxaPlataformaPercentual: "platform_fee_percent", atualizadoEm: "updated_at", atualizadoPor: "updated_by" },
  },
} satisfies Record<string, Tabela>;

/** Visitas à comunidade (mapa `${usuarioId}:${eventoId}` → data na BaseDados). */
export const VISITAS_COMUNIDADE: Tabela = {
  tabela: "community_visits", chave: ["usuarioId", "eventoId"],
  campos: { usuarioId: "user_id", eventoId: "event_id", vistoEm: "seen_at" },
};

// ===== Tabelas fora da base transacional (lidas e gravadas direto pelo servidor) =====

export const CAMPANHAS_METRICAS: Tabela = {
  tabela: "marketing_campaigns", chave: ["id"],
  campos: { id: "id", eventoId: "event_id", nome: "name", origem: "source", criadoEm: "created_at" },
};

export const REGISTROS_METRICAS: Tabela = {
  tabela: "analytics_events", chave: ["id"],
  campos: {
    id: "id", tipo: "type", eventoId: "event_id", visitanteId: "visitor_id", sessaoId: "session_id", origem: "source",
    secaoId: "section_id", posicao: "position", campanhaId: "campaign_id", fluxoId: "flow_id",
    inscricaoId: "registration_id", em: "occurred_at_ms",
  },
};
