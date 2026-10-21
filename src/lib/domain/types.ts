import type { ModalidadeId, PreferenciaModalidades } from "@/lib/modalidades";
import type { RegistroCheckin } from "@/lib/checkin";
// Tipos de domínio da aplicação (persistidos no Supabase pelo servidor).

export type Perfil = "admin" | "participante" | "organizador";

export interface Usuario {
  id: string;
  perfil: Perfil;
  nomeCompleto: string;
  cpf: string; // somente dígitos
  dataNascimento: string; // AAAA-MM-DD (data civil)
  email: string; // normalizado (minúsculas)
  whatsapp: string; // somente dígitos
  endereco: {
    cep: string;
    logradouro: string;
    numero: string;
    complemento?: string | undefined;
    bairro: string;
    cidade: string;
    uf: string;
  };
  instagram?: string | undefined;
  squad?: string | undefined;
  fotoUrl?: string | undefined;
  nomeExibicao?: string | undefined; // usado na comunidade
  silencioNotificacoes?: { todas?: boolean; comunidade?: boolean; leiturasSuporte?: Record<string, string> | undefined } | undefined;
  /** Aparência escolhida pela conta; ausente = escuro. */
  tema?: "dark" | "light" | undefined;
  /** Modalidades favoritas declaradas pela conta (nunca expostas nominalmente). */
  preferenciasModalidade?: PreferenciaModalidades | undefined;
  autorizacaoResponsavel?: "pendente" | "aprovada" | "nao_aplicavel" | undefined;
  autorizacaoPromocional: boolean;
  aceiteTermosVersao: string;
  aceiteTermosEm: string;
  organizacaoId?: string | undefined; // quando organizador aprovado
  ativo: boolean;
  criadoEm: string;
}

export interface Organizacao {
  id: string;
  nome: string;
  cnpj?: string | undefined;
  instagram?: string | undefined;
  telefone: string;
  responsavelId: string;
  status: "ativa" | "suspensa";
  criadoEm: string;
  /** Conta conectada (Stripe Connect Express) que recebe o repasse das vendas. */
  recebimento?: RecebimentoOrganizacao | undefined;
}

/**
 * Situação da conta de recebimento, espelhada do Stripe (accounts.retrieve / account.updated):
 *  - pendente: cadastro iniciado, ainda faltam dados no Stripe;
 *  - em_analise: dados enviados, Stripe verificando;
 *  - ativa: pode receber transferências e sacar para a conta bancária;
 *  - restrita: o Stripe pediu mais informações ou bloqueou repasses.
 */
export type StatusRecebimento = "pendente" | "em_analise" | "ativa" | "restrita";

export interface RecebimentoOrganizacao {
  provedor: "stripe";
  contaId: string; // acct_...
  status: StatusRecebimento;
  /** Transferências habilitadas: as vendas já podem ser repassadas para a conta. */
  transferenciasAtivas: boolean;
  /** Saques para a conta bancária habilitados. */
  saquesAtivos: boolean;
  /** Pendências que o Stripe pede (requirements.currently_due), para orientar o organizador. */
  pendencias: string[];
  atualizadoEm: string;
}

export type StatusSolicitacao =
  | "pendente"
  | "em_analise"
  | "ajustes_solicitados"
  | "aprovada"
  | "rejeitada";

export interface SolicitacaoOrganizador {
  id: string;
  usuarioId: string;
  possuiCnpj: boolean;
  cnpj?: string | undefined;
  nomeOrganizacao: string;
  instagram?: string | undefined;
  telefone: string;
  status: StatusSolicitacao;
  observacaoAdmin?: string | undefined;
  criadoEm: string;
  atualizadoEm: string;
}

export type StatusEvento =
  | "rascunho"
  | "publicado"
  | "inscricoes_encerradas"
  | "concluido"
  | "cancelado"
  | "arquivado";

export interface Exercito {
  id: string;
  nome: string;
  descricao?: string | undefined;
  capacidade: number;
}

export interface TipoIngresso {
  id: string;
  nome: string;
  descricao?: string | undefined;
  observacoes?: string | undefined;
  beneficios?: string | undefined;
  precoBaseCentavos: number;
  quantidadeMaxima: number;
  arquivado?: boolean | undefined;
}

export interface Lote {
  id: string;
  nome: string;
  inicioVendas: string; // ISO
  fimVendas: string; // ISO
  status: "ativo" | "encerrado" | "arquivado";
  itens: Array<{
    tipoId: string;
    precoCentavos: number;
    quantidade: number;
  }>;
}

export interface AtividadeCronograma {
  id: string;
  data: string; // AAAA-MM-DD
  horario: string; // HH:MM
  titulo: string;
  descricao: string;
  local?: string | undefined;
  ordem: number;
}

export interface DocumentoRegras {
  titulo: string;
  versao: string;
  atualizadoEm: string;
  formato: "pdf" | "docx" | "html"; // html = demonstrativo renderizável
  conteudoHtml?: string | undefined; // usado no leitor interno demonstrativo
  nomeArquivo?: string | undefined;
  pdfDataUrl?: string | undefined; // PDF enviado pelo organizador (data URL, persistência local demo)
  arquivoUrl?: string | undefined; // DOCX enviado (sem leitor interno; oferecido para download)
}

/** Enquadramento de um recorte: zoom ≥ 1 e posição normalizada (-1..1) do centro. */
export interface Recorte {
  zoom: number;
  x: number;
  y: number;
}

/** Imagem principal: original + dois recortes (banner 21:9 e card 16:9) gerados a partir dela. */
export interface ImagemEvento {
  originalUrl: string;
  alt: string;
  banner: Recorte;
  card: Recorte;
  bannerUrl: string;
}

export interface Evento {
  id: string;
  organizacaoId: string;
  nome: string;
  descricaoResumida: string;
  enredo: string;
  inicioEm: string; // ISO com fuso
  fimEm: string;
  fuso: string;
  local: string;
  cep?: string | undefined;
  endereco: string;
  cidade: string;
  uf: string;
  capacidadeTotal: number;
  /** Imagem dos cards (recorte 16:9). */
  imagemUrl?: string | undefined;
  imagem?: ImagemEvento | undefined;
  exercitos: Exercito[];
  tipos: TipoIngresso[];
  lotes: Lote[];
  cronograma: AtividadeCronograma[];
  regras?: DocumentoRegras | undefined;
  /** Modalidade principal; ausente em eventos antigos ("Modalidade não informada"). */
  modalidade?: ModalidadeId | undefined;
  /** WhatsApp do organizador para dúvidas (dígitos com DDI). Público na página do evento. */
  whatsappContato?: string | undefined;
  /** Convite do grupo (chat.whatsapp.com). Só inscritos confirmados e a organização veem (visão). */
  whatsappGrupoUrl?: string | undefined;
  status: StatusEvento;
  criadoEm: string;
}

export type StatusInscricao =
  | "pendente" // vaga reservada aguardando o pagamento (Stripe)
  | "confirmada"
  | "cancelada"
  | "estornada";

/**
 * Pagamento online de uma inscrição (Stripe Checkout). Só existe em inscrições pagas
 * criadas com o Stripe configurado; cortesias e valores zerados não passam por aqui.
 *  - aguardando: sessão de checkout aberta, vaga reservada até `expiraEm`;
 *  - processando: pagamento assíncrono (ex.: boleto) enviado, aguardando compensação;
 *  - pago: confirmado pelo Stripe;
 *  - expirado / falhou / cancelado: reserva liberada sem cobrança (prazo, recusa ou desistência);
 *  - estorno_pendente: inscrição cancelada, reembolso ainda não confirmado pelo Stripe;
 *  - estornado: reembolso criado no Stripe.
 */
export type StatusPagamento = "aguardando" | "processando" | "pago" | "expirado" | "falhou" | "cancelado" | "estorno_pendente" | "estornado";

export interface PagamentoInscricao {
  provedor: "stripe";
  status: StatusPagamento;
  /** Valor cobrado (valor do ingresso menos descontos), em centavos. */
  valorCentavos: number;
  /** Fim da reserva da vaga enquanto o pagamento não é concluído. */
  expiraEm: string;
  sessaoId?: string | undefined; // Checkout Session (cs_...)
  intencaoId?: string | undefined; // PaymentIntent (pi_...)
  pagoEm?: string | undefined;
  reembolsoId?: string | undefined; // Refund (re_...)
  erro?: string | undefined; // última falha ao falar com o Stripe (ex.: estorno recusado)
  /** Conta da organização que recebe o repasse (cobrança com destino); ausente = fica na plataforma. */
  contaDestino?: string | undefined;
  /** Taxa da plataforma retida no repasse, em centavos. */
  taxaCentavos?: number | undefined;
  /** Taxa de serviço paga pelo comprador além do valor do ingresso, em centavos (fica com a plataforma). */
  taxaCompradorCentavos?: number | undefined;
  /** Contestação (chargeback) aberta pelo comprador no banco do cartão. */
  disputa?: DisputaPagamento | undefined;
}

export type StatusDisputa = "aberta" | "em_analise" | "ganha" | "perdida" | "encerrada";

export interface DisputaPagamento {
  status: StatusDisputa;
  /** Valor contestado, em centavos. */
  valorCentavos: number;
  /** Motivo informado pelo banco (código do Stripe, ex.: "fraudulent"). */
  motivo?: string | undefined;
  abertaEm: string;
  atualizadaEm: string;
}

export interface Inscricao {
  id: string;
  eventoId: string;
  usuarioId: string;
  tipoId: string;
  loteId?: string | undefined; // cortesias não têm lote
  exercitoId: string;
  codigo: string; // identificador opaco fictício
  tokenEntrada?: string | undefined; // token estável do QR Code de entrada (opaco)
  status: StatusInscricao;
  origem: "plataforma" | "cortesia" | "organizador" | "admin";
  valorCentavos: number; // valor original preservado
  descontoCentavos: number;
  cupomId?: string | undefined;
  cortesiaId?: string | undefined;
  voucherId?: string | undefined;
  pagamento?: PagamentoInscricao | undefined;
  criadoEm: string;
  canceladoEm?: string | undefined;
  motivoCancelamento?: string | undefined;
}

export interface Cupom {
  id: string;
  eventoId: string;
  codigo: string; // normalizado em maiúsculas
  descontoPercentual: number; // 1..100
  validoDe: string;
  validoAte: string | null; // null = sem data de término (opção explícita)
  limiteUsos: number | null; // null = sem limite de utilizações (opção explícita)
  usos: number;
  tiposElegiveis: string[];
  ativo: boolean;
}

export type StatusCortesia = "pendente" | "resgatada" | "expirada" | "revogada";

export interface Cortesia {
  id: string;
  eventoId: string;
  nomeConvidado: string;
  emailConvidado: string;
  tipoId: string;
  exercitoId?: string | undefined;
  validade: string;
  codigo: string;
  status: StatusCortesia;
  criadoEm: string;
}

/** "codigo": código secreto divulgado pela organização (acertou, ganhou; sem aprovação). */
export type TipoEntregaMissao = "confirmacao" | "texto" | "imagem" | "codigo";
export type StatusMissao = "disponivel" | "enviada" | "concluida" | "ajustes_solicitados" | "prazo_encerrado" | "recusada";

export interface Missao {
  id: string;
  eventoId: string;
  titulo: string;
  descricao: string;
  imagemUrl?: string | undefined;
  prazo: string;
  publico: "todos" | string; // "todos" ou exercitoId
  tipoEntrega: TipoEntregaMissao;
  exigeAprovacao: boolean;
  /** Pontos da entrega aprovada para o placar do exército (missões antigas: 0). */
  pontos?: number | undefined;
  /** Abre para entregas a partir deste instante (ausente = já aberta). */
  abreEm?: string | undefined;
  /** Rascunho não aparece para participantes (ausente = publicada). */
  rascunho?: boolean | undefined;
  /** Resposta da missão "código secreto", já normalizada. Nunca vai para participantes (visão). */
  codigoResposta?: string | undefined;
  /** Meta coletiva: com ao menos X% dos inscritos do exército concluindo, o exército ganha o bônus. */
  metaPercentual?: number | undefined;
  metaBonus?: number | undefined;
  /** Quando o lançamento foi avisado (notificação + post na comunidade): evita avisar duas vezes. */
  anunciadaEm?: string | undefined;
  criadoEm?: string | undefined;
}

export interface EntregaMissao {
  id: string;
  missaoId: string;
  usuarioId: string;
  status: StatusMissao;
  conteudo?: string | undefined;
  enviadoEm: string;
  avaliacao?: string | undefined;
  /** Foto da entrega (bucket público midia). */
  anexoUrl?: string | undefined;
  /** Exército de quem enviou, no momento do envio: os pontos ficam com ele. */
  exercitoId?: string | undefined;
  /** Pontos concedidos na aprovação. */
  pontos?: number | undefined;
  avaliadoPor?: string | undefined;
  avaliadoEm?: string | undefined;
  /** O participante autorizou a organização a destacar a entrega na comunidade do evento. */
  permiteDestaque?: boolean | undefined;
  destacadaEm?: string | undefined;
}

/** Prêmio da campanha de missões pré-evento, por colocação do exército no placar. */
export interface PremioMissoes {
  colocacao: number;
  descricao: string;
}

/** Placar congelado de um exército no encerramento da campanha. */
export interface ResultadoExercito {
  exercitoId: string;
  colocacao: number;
  /** Soma dos pontos individuais aprovados. */
  pontos: number;
  inscritos: number;
  /** pontos ÷ inscritos (o tamanho do exército não decide o placar). */
  media: number;
  /** Bônus das metas coletivas atingidas. */
  bonus: number;
  /** media + bonus: o que ordena o placar. */
  total: number;
  premio?: string | undefined;
}

/** Campanha de missões pré-evento de um evento: prêmios e, depois do encerramento, o resultado. */
export interface CampanhaMissoes {
  eventoId: string;
  premios: PremioMissoes[];
  encerradaEm?: string | undefined;
  encerradaPor?: string | undefined;
  resultado: ResultadoExercito[];
  atualizadoEm: string;
}

export interface Comunicado {
  id: string;
  eventoId: string;
  autorId: string;
  titulo: string;
  corpo: string;
  imagemUrl?: string | undefined;
  fixado: boolean;
  segmentoExercitoId?: string | undefined; // comunicado segmentado
  criadoEm: string;
}

export interface Comentario {
  id: string;
  comunicadoId: string;
  autorId: string;
  corpo: string;
  criadoEm: string;
}

export type StatusChamado =
  | "aberto"
  | "em_atendimento"
  | "aguardando_participante"
  | "resolvido"
  | "fechado";

export interface AnexoChamado {
  /** Caminho no bucket privado "documentos" (prefixo suporte/); acesso só por URL assinada. */
  caminho: string;
  nome: string;
  tipo: string;
  tamanho: number;
}

export interface MensagemChamado {
  id: string;
  autorId: string;
  corpo: string;
  criadoEm: string;
  /** "sistema" = evento de histórico (status/responsável), visualmente distinto. */
  tipo?: "mensagem" | "sistema" | undefined;
  /** Id gerado pelo navegador: reenvios não duplicam a mensagem. */
  clienteId?: string | undefined;
  anexo?: AnexoChamado | undefined;
  acao?: { tipo: "status" | "responsavel" | "vinculo" | "encaminhamento" | "retorno"; valor: string } | undefined;
  /** Audiência: "participante" (padrão, inclusive mensagens antigas) ou "interno" (administração ↔ organização). */
  canal?: "participante" | "interno" | undefined;
  /** Mensagens internas pertencem a um encaminhamento (id próprio, diferente do chamado). */
  encaminhamentoId?: string | undefined;
  /** Só no evento de sistema que cria o encaminhamento. */
  encaminhamento?: { organizacaoId: string; orientacao: string; anexos: AnexoCompartilhado[] } | undefined;
}

/** Anexo do participante que a administração escolheu compartilhar (sem caminho do arquivo). */
export interface AnexoCompartilhado { mensagemId: string; nome: string; tipo: string; tamanho: number }

export interface Chamado {
  id: string;
  eventoId?: string | undefined;
  solicitanteId: string;
  assunto: string;
  categoria: string;
  descricao: string;
  status: StatusChamado;
  mensagens: MensagemChamado[];
  criadoEm: string;
  atualizadoEm: string;
}

export interface Notificacao {
  id: string;
  usuarioId: string;
  titulo: string;
  corpo: string;
  link?: string | undefined;
  lida: boolean;
  criadoEm: string;
}

export type TipoMovimentacao =
  | "inscricao"
  | "desconto_cupom"
  | "ajuste"
  | "estorno";

export interface Movimentacao {
  id: string;
  eventoId: string;
  inscricaoId?: string | undefined;
  tipo: TipoMovimentacao;
  valorCentavos: number; // positivo = entrada, negativo = saída
  descricao: string;
  criadoEm: string;
}

export interface RegistroAuditoria {
  id: string;
  autorId: string;
  acao: string;
  entidade: string;
  entidadeId: string;
  justificativa?: string | undefined;
  criadoEm: string;
}

export interface SolicitacaoPrivacidade {
  id: string;
  usuarioId: string;
  tipo: "acesso" | "correcao" | "exportacao" | "exclusao";
  detalhes: string;
  status: "aberta" | "respondida";
  resposta?: string | undefined;
  criadoEm: string;
}

export interface BaseDados {
  versao: number;
  usuarios: Usuario[];
  organizacoes: Organizacao[];
  solicitacoes: SolicitacaoOrganizador[];
  eventos: Evento[];
  inscricoes: Inscricao[];
  cupons: Cupom[];
  cortesias: Cortesia[];
  missoes: Missao[];
  entregas: EntregaMissao[];
  campanhasMissoes: CampanhaMissoes[];
  comunicados: Comunicado[];
  comentarios: Comentario[];
  chamados: Chamado[];
  notificacoes: Notificacao[];
  movimentacoes: Movimentacao[];
  auditoria: RegistroAuditoria[];
  privacidade: SolicitacaoPrivacidade[];
  foruns: Forum[];
  publicacoes: Publicacao[];
  respostas: Resposta[];
  curtidas: Curtida[];
  denuncias: Denuncia[];
  preferenciasForum: PreferenciaForum[];
  restricoesComunidade: RestricaoComunidade[];
  moderacao: RegistroModeracao[];
  visitasComunidade: Record<string, string>; // `${usuarioId}:${eventoId}` -> ISO
  parceiros: Parceiro[];
  secoesInicio: SecaoInicial[];
  /** Campanhas de impulsionamento concedidas pela administração. */
  impulsionamentos: Impulsionamento[];
  /** Base de referência do credenciamento (registros já aceitos pelo servidor). */
  checkins: RegistroCheckin[];
  // ===== Perfil do operador e gamificação =====
  perfisOperador: PerfilOperador[];
  equipamentos: Equipamento[];
  fotosPerfil: FotoGaleria[];
  operacoesExternas: OperacaoExterna[];
  insignias: Insignia[];
  concessoesInsignia: ConcessaoInsignia[];
  campanhasRecompensa: CampanhaRecompensa[];
  vouchers: Voucher[];
  correcoesParticipacao: CorrecaoParticipacao[];
  /** Configurações da plataforma editadas pela administração (registro único "plataforma"). */
  configuracoes: ConfiguracaoPlataforma[];
}

export interface ConfiguracaoPlataforma {
  id: "plataforma";
  /** Taxa retida nas vendas repassadas às organizações (Stripe Connect), em % (ex.: 8.5). */
  taxaPlataformaPercentual: number;
  /** Taxa de serviço somada ao ingresso e paga pelo comprador, em % (vazio = 0). */
  taxaCompradorPercentual?: number | undefined;
  atualizadoEm: string;
  atualizadoPor: string;
}

// ===== Perfil do operador =====
export type VisibilidadeBloco = "eu" | "autenticados";
export interface PrivacidadePerfil {
  historico: VisibilidadeBloco;
  mapa: VisibilidadeBloco;
  insignias: VisibilidadeBloco;
  equipamentos: VisibilidadeBloco;
  fotos: VisibilidadeBloco;
}
/** Perfil social: só o que a pessoa decidiu mostrar (separado dos dados da conta). */
export interface PerfilOperador {
  usuarioId: string;
  callsign?: string | undefined;
  bio?: string | undefined;
  squad?: string | undefined;
  instagram?: string | undefined;
  capaUrl?: string | undefined;
  insigniaDestaque?: string | undefined;
  privacidade: PrivacidadePerfil;
  /** Eventos ocultados do perfil social (continuam valendo para a progressão privada). */
  operacoesOcultas: string[];
  introVista: boolean;
  atualizadoEm: string;
}
export type TipoEquipamento = "spring" | "hpa" | "aeg" | "gbbr";
/** Metadados da nota fiscal; o arquivo fica num armazenamento privado separado. */
export interface MetaNotaFiscal {
  nome: string;
  tipo: string;
  tamanho: number;
  enviadaEm: string;
}
export interface Equipamento {
  id: string;
  usuarioId: string;
  marca: string;
  tipo: TipoEquipamento;
  modelo: string;
  apelido?: string | undefined;
  observacoes?: string | undefined;
  fotos: string[];
  nota?: MetaNotaFiscal | undefined;
  visivel: boolean;
  criadoEm: string;
  atualizadoEm: string;
}
/**
 * Operação de que o operador participou FORA da plataforma, registrada por ele mesmo, com foto.
 * Aparece no mapa e no perfil como "Registrada pelo operador" e nunca conta para insígnias,
 * recompensas ou participação (que exigem inscrição e presença confirmadas aqui).
 */
export interface OperacaoExterna {
  id: string;
  usuarioId: string;
  nome: string;
  /** Data do evento (AAAA-MM-DD). */
  data: string;
  cidade: string;
  uf: string;
  organizacao?: string | undefined;
  modalidade?: string | undefined;
  /** Foto obrigatória (bucket público midia). */
  fotoUrl: string;
  fotoAlt?: string | undefined;
  descricao?: string | undefined;
  /** Aparece para os outros (respeitando a privacidade do bloco "mapa"). */
  visivel: boolean;
  criadoEm: string;
  atualizadoEm: string;
}

export interface FotoGaleria {
  id: string;
  usuarioId: string;
  url: string;
  legenda?: string | undefined;
  alt?: string | undefined;
  visivel: boolean;
  criadoEm: string;
}

// ===== Insígnias e recompensas =====
export type TipoCriterio = "operacoes" | "estados" | "modalidades" | "missoes";
export interface CriterioInsignia {
  tipo: TipoCriterio;
  meta: number;
}
export interface Insignia {
  id: string;
  nome: string;
  descricao: string;
  icone: string; // emoji
  criterio: CriterioInsignia;
  /** Desativada = não concede novas (as já concedidas permanecem). */
  ativa: boolean;
  versao: number;
  criadoEm: string;
  atualizadoEm: string;
}
export interface ConcessaoInsignia {
  id: string; // `${usuarioId}:${insigniaId}`
  usuarioId: string;
  insigniaId: string;
  versaoRegra: number;
  criterio: CriterioInsignia; // regra vigente no momento da concessão
  conquistadaEm: string;
  revogadaEm?: string | undefined;
  motivoRevogacao?: string | undefined;
}
export type TipoBeneficio = "percentual" | "fixo" | "gratuito";
export interface CampanhaRecompensa {
  id: string;
  nome: string;
  descricao: string;
  insigniaId: string;
  organizacaoId: string;
  tipo: TipoBeneficio;
  valor: number; // % (1..100) ou centavos; ignorado em "gratuito"
  eventosElegiveis: string[];
  tiposElegiveis: string[]; // nomes de tipo de ingresso; vazio = todos
  maximo: number;
  limitePorParticipante: number;
  inicioEm: string;
  conquistarAte: string;
  resgatarAte: string;
  regras: string;
  aceitaAnteriores: boolean;
  ativa: boolean;
  versao: number;
  autorizacao?: string | undefined; // referência da oferta autorizada (quando criada pela administração)
  criadoPor: string;
  criadoEm: string;
}
/** Condições do benefício congeladas na concessão (mudanças na campanha não alteram vouchers já emitidos). */
export interface BeneficioVoucher {
  nome: string;
  organizacaoId: string;
  tipo: TipoBeneficio;
  valor: number;
  eventosElegiveis: string[];
  tiposElegiveis: string[];
  resgatarAte: string;
  regras: string;
}
export type StatusVoucher = "disponivel" | "utilizada" | "expirada" | "revogada";
export interface Voucher {
  id: string;
  campanhaId: string;
  campanhaVersao: number;
  usuarioId: string;
  concessaoId: string;
  beneficio: BeneficioVoucher;
  codigo: string;
  status: StatusVoucher;
  concedidoEm: string;
  inscricaoId?: string | undefined;
  usadoEm?: string | undefined;
  motivo?: string | undefined;
  /** Uso já feito com participação depois invalidada: análise manual. */
  ocorrencia?: string | undefined;
}
export interface CorrecaoParticipacao {
  id: string;
  usuarioId: string;
  eventoId: string;
  tipo: "invalidar" | "validar";
  justificativa: string;
  autorId: string;
  criadoEm: string;
}

// ===== Comunidade: fóruns com feed social =====
export type PermissaoForum = "membros" | "gestao";

export interface Forum {
  id: string;
  eventoId: string;
  nome: string;
  descricao: string;
  icone?: string | undefined; // emoji opcional
  regras?: string | undefined;
  ordem: number;
  publico: "todos" | string; // "todos" ou exercitoId (nunca exibido a participantes)
  publicacao: PermissaoForum;
  respostas: PermissaoForum;
  status: "ativo" | "arquivado";
  criadoEm: string;
}

export interface ImagemPost {
  url: string;
  alt?: string | undefined;
}

export interface Publicacao {
  id: string;
  forumId: string;
  eventoId: string;
  autorId: string;
  texto: string;
  imagens: ImagemPost[];
  fixada: boolean;
  importante: boolean;
  respostasFechadas: boolean;
  oculta: boolean;
  motivoOcultacao?: string | undefined;
  removidaPeloAutor: boolean;
  editadoEm?: string | undefined;
  criadoEm: string;
}

export interface Resposta {
  id: string;
  publicacaoId: string;
  autorId: string;
  texto: string;
  imagem?: ImagemPost | undefined;
  oculta: boolean;
  motivoOcultacao?: string | undefined;
  editadoEm?: string | undefined;
  criadoEm: string;
}

export interface Curtida {
  id: string;
  publicacaoId: string;
  usuarioId: string;
}

export type MotivoDenuncia = "ofensa" | "spam" | "dados_pessoais" | "inadequado" | "outro";

export interface Denuncia {
  id: string;
  eventoId: string;
  alvo: "publicacao" | "resposta";
  alvoId: string;
  denuncianteId: string;
  motivo: MotivoDenuncia;
  descricao?: string | undefined;
  status: "pendente" | "procedente" | "descartada";
  criadoEm: string;
}

export interface PreferenciaForum {
  usuarioId: string;
  forumId: string;
  modo: "seguir" | "silenciar";
}

export interface RestricaoComunidade {
  id: string;
  eventoId: string;
  usuarioId: string;
  justificativa: string;
  ativa: boolean;
  criadoEm: string;
}

export interface RegistroModeracao {
  id: string;
  eventoId: string;
  autorId: string;
  acao: string;
  alvoId: string;
  justificativa?: string | undefined;
  criadoEm: string;
}

// ===== Página inicial e divulgação =====
export type RegiaoBR = "Norte" | "Nordeste" | "Centro-Oeste" | "Sudeste" | "Sul";
export type EscopoGeo = "nacional" | "regiao" | "estado" | "cidade";
/** Segmentação geográfica (seção ou filtro do visitante). */
export interface Abrangencia {
  escopo: EscopoGeo;
  regiao?: RegiaoBR | undefined;
  uf?: string | undefined;
  cidade?: string | undefined;
}
/** Janela de exibição opcional (ISO). */
export interface Agendamento {
  inicioEm?: string | undefined;
  fimEm?: string | undefined;
}
export type TipoLinkParceiro = "site" | "instagram" | "whatsapp" | "externo" | "outro";
export interface LinkParceiro {
  id: string;
  tipo: TipoLinkParceiro;
  url?: string | undefined; // site/instagram/externo/outro
  rotulo?: string | undefined; // obrigatório para "outro"
  telefone?: string | undefined; // whatsapp, com código do país
  mensagem?: string | undefined; // whatsapp, mensagem inicial opcional
  principal?: boolean | undefined;
}
export type TipoParceiro = "patrocinador" | "apoiador" | "ambos";
export interface Parceiro {
  id: string;
  nome: string;
  tipo: TipoParceiro;
  descricao?: string | undefined;
  logoUrl?: string | undefined;
  textoAlt: string;
  links: LinkParceiro[];
  ativo: boolean;
  criadoEm: string;
  atualizadoEm: string;
}
export type TipoSecao = "destaques" | "regional" | "patrocinadores" | "apoiadores" | "banner";
export type LayoutSecao = "grade" | "carrossel" | "banner";
export type StatusSecao = "rascunho" | "publicada" | "desativada";
/** Configuração de destaque: referencia o evento pelo id. */
export interface DestaqueEvento {
  id: string;
  eventoId: string;
  posicao: number;
  imagemPromocional?: string | undefined;
  selo?: string | undefined;
  chamada?: string | undefined;
  agendamento: Agendamento;
}
export interface ItemParceiroSecao {
  parceiroId: string;
  posicao: number;
}
export interface SelecaoAutomatica {
  abrangencia: Abrangencia;
  periodoDias?: number | undefined; // próximos N dias
  maximo: number;
  incluirEsgotados: boolean;
  ordenacao: "data" | "recentes";
}
export type DestinoBanner =
  | { tipo: "evento"; valor: string }
  | { tipo: "secao"; valor: string }
  | { tipo: "parceiro"; valor: string }
  | { tipo: "externo"; valor: string };
export interface ConfigBanner {
  imagemDesktop?: string | undefined;
  imagemCelular?: string | undefined;
  textoAlt: string;
  chamada?: string | undefined;
  textoBotao?: string | undefined;
  destino?: DestinoBanner | undefined;
}
export interface SecaoInicial {
  id: string;
  titulo: string;
  subtitulo?: string | undefined;
  tipo: TipoSecao;
  abrangencia: Abrangencia;
  ordem: number;
  status: StatusSecao;
  agendamento: Agendamento;
  layout: LayoutSecao;
  modo: "manual" | "automatico";
  destaques: DestaqueEvento[];
  automatica?: SelecaoAutomatica | undefined;
  mostrarEsgotados: boolean;
  parceiros: ItemParceiroSecao[];
  tamanhoLogo: "p" | "m" | "g";
  mostrarDescricoes: boolean;
  superficieLogo: "nenhuma" | "clara" | "escura";
  banner?: ConfigBanner | undefined;
  criadoEm: string;
  atualizadoEm: string;
}

// ===== Impulsionamento de operações =====
export type ObjetivoImpulsionamento = "divulgacao" | "inscricoes";
export type PrioridadeImpulsionamento = "normal" | "alta";
/** Estado gravado; "agendado", "encerrado" e "suspenso" também são derivados na leitura. */
export type StatusImpulsionamento = "rascunho" | "ativo" | "pausado" | "encerrado";
/** Posição de divulgação: id de uma seção de eventos da página inicial ou o bloco da listagem. */
export const POSICAO_LISTAGEM = "listagem";
export interface Impulsionamento {
  id: string;
  eventoId: string;
  nome: string;
  objetivo: ObjetivoImpulsionamento;
  posicoes: string[];
  abrangencia: Abrangencia;
  inicioEm: string;
  fimEm: string;
  fuso: string;
  prioridade: PrioridadeImpulsionamento;
  ordem: number;
  imagemPromocional?: string | undefined;
  chamada?: string | undefined;
  status: StatusImpulsionamento;
  criadoPor: string;
  criadoEm: string;
  atualizadoEm: string;
}
