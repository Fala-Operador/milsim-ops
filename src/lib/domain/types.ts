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
    complemento?: string;
    bairro: string;
    cidade: string;
    uf: string;
  };
  instagram?: string;
  squad?: string;
  fotoUrl?: string;
  autorizacaoResponsavel?: "pendente" | "aprovada" | "nao_aplicavel";
  autorizacaoPromocional: boolean;
  aceiteTermosVersao: string;
  aceiteTermosEm: string;
  organizacaoId?: string; // quando organizador aprovado
  ativo: boolean;
  criadoEm: string;
}

export interface Organizacao {
  id: string;
  nome: string;
  cnpj?: string;
  instagram?: string;
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
  cnpj?: string;
  nomeOrganizacao: string;
  instagram?: string;
  telefone: string;
  status: StatusSolicitacao;
  observacaoAdmin?: string;
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
  descricao?: string;
  capacidade: number;
}

export interface TipoIngresso {
  id: string;
  nome: string;
  descricao?: string;
  observacoes?: string;
  beneficios?: string;
  precoBaseCentavos: number;
  quantidadeMaxima: number;
  arquivado?: boolean;
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
  local?: string;
  ordem: number;
}

export interface DocumentoRegras {
  titulo: string;
  versao: string;
  atualizadoEm: string;
  formato: "pdf" | "docx" | "html"; // html = demonstrativo renderizável
  conteudoHtml?: string; // usado no leitor interno demonstrativo
  nomeArquivo?: string;
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
  imagemUrl?: string;
  exercitos: Exercito[];
  tipos: TipoIngresso[];
  lotes: Lote[];
  cronograma: AtividadeCronograma[];
  regras?: DocumentoRegras;
  whatsappGrupoUrl?: string;
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
  loteId?: string; // cortesias não têm lote
  exercitoId: string;
  codigo: string; // identificador opaco fictício
  status: StatusInscricao;
  origem: "plataforma" | "cortesia" | "organizador" | "admin";
  valorCentavos: number; // valor original preservado
  descontoCentavos: number;
  cupomId?: string;
  cortesiaId?: string;
  criadoEm: string;
  canceladoEm?: string;
  motivoCancelamento?: string;
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
  exercitoId?: string;
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
  imagemUrl?: string;
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
  conteudo?: string;
  enviadoEm: string;
  avaliacao?: string;
}

export interface Comunicado {
  id: string;
  eventoId: string;
  autorId: string;
  titulo: string;
  corpo: string;
  imagemUrl?: string;
  fixado: boolean;
  segmentoExercitoId?: string; // comunicado segmentado
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
  eventoId?: string;
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
  link?: string;
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
  inscricaoId?: string;
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
  justificativa?: string;
  criadoEm: string;
}

export interface SolicitacaoPrivacidade {
  id: string;
  usuarioId: string;
  tipo: "acesso" | "correcao" | "exportacao" | "exclusao";
  detalhes: string;
  status: "aberta" | "respondida";
  resposta?: string;
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
}
