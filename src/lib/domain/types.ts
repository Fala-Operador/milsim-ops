// Tipos de domínio da aplicação (base 100% mockada).

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
  silencioNotificacoes?: { todas?: boolean; comunidade?: boolean } | undefined;
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
  endereco: string;
  cidade: string;
  uf: string;
  capacidadeTotal: number;
  imagemUrl?: string | undefined;
  exercitos: Exercito[];
  tipos: TipoIngresso[];
  lotes: Lote[];
  cronograma: AtividadeCronograma[];
  regras?: DocumentoRegras | undefined;
  whatsappGrupoUrl?: string | undefined;
  status: StatusEvento;
  criadoEm: string;
}

export type StatusInscricao =
  | "confirmada"
  | "cancelada"
  | "estornada";

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
  validoAte: string;
  limiteUsos: number;
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

export type TipoEntregaMissao = "confirmacao" | "texto" | "imagem";
export type StatusMissao = "disponivel" | "enviada" | "concluida" | "ajustes_solicitados" | "prazo_encerrado";

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
}

export interface EntregaMissao {
  id: string;
  missaoId: string;
  usuarioId: string;
  status: StatusMissao;
  conteudo?: string | undefined;
  enviadoEm: string;
  avaliacao?: string | undefined;
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

export interface MensagemChamado {
  id: string;
  autorId: string;
  corpo: string;
  criadoEm: string;
}

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
  comunicados: Comunicado[];
  comentarios: Comentario[];
  chamados: Chamado[];
  notificacoes: Notificacao[];
  movimentacoes: Movimentacao[];
  auditoria: RegistroAuditoria[];
  privacidade: SolicitacaoPrivacidade[];
  credenciais: Record<string, string>; // email -> hash demonstrativo
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
