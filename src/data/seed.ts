// Base demonstrativa fictícia. Nenhum dado pessoal real.
import type { BaseDados } from "@/lib/domain/types";
import { aplicarSeedComunidade, type BaseSemComunidade } from "@/data/seedComunidade";
import { aplicarSeedDivulgacao } from "@/data/seedDivulgacao";

import { VERSAO_TERMOS } from "@/data/termos";
import { gerarTokenEntrada } from "@/lib/checkin";
import { VERSAO_FORMATO as VERSAO_BASE } from "@/lib/persistencia";

/** Senhas das contas demonstrativas (usadas só pelo script de seed do Supabase Auth). */
export const SENHAS_DEMO: Record<string, string> = {
  "admin@admin": "admin@123",
  "usuario@teste.com.br": "user@123",
  "organizador@teste.com.br": "organizador@123",
};

const agora = new Date();
const iso = (d: Date) => d.toISOString();
const dias = (n: number) => {
  const d = new Date(agora);
  d.setDate(d.getDate() + n);
  return d;
};

export function criarBaseInicial(): BaseDados {
  const base = aplicarSeedDivulgacao(aplicarSeedComunidade(criarBaseLegada()));
  completarInscritosFicticios(base);
  // Todo ingresso confirmado tem token de QR (gerado na confirmação, em produção).
  for (const i of base.inscricoes) if (i.status === "confirmada" && !i.tokenEntrada) i.tokenEntrada = gerarTokenEntrada();
  return base;
}

/** Cria perfis fictícios para inscrições de lotação (todo inscrito precisa existir no banco). */
function completarInscritosFicticios(base: BaseDados): void {
  const existentes = new Set(base.usuarios.map((u) => u.id));
  let n = 0;
  for (const id of new Set(base.inscricoes.map((i) => i.usuarioId))) {
    if (existentes.has(id)) continue;
    n += 1;
    base.usuarios.push({
      id,
      perfil: "participante",
      nomeCompleto: `Participante Fictício ${n}`,
      cpf: `888${String(n).padStart(8, "0")}`,
      dataNascimento: "1995-01-01",
      email: `${id}@exemplo.invalid`,
      whatsapp: "11900000000",
      endereco: { cep: "00000000", logradouro: "Rua Fictícia", numero: "0", bairro: "Centro", cidade: "São Paulo", uf: "SP" },
      autorizacaoResponsavel: "nao_aplicavel",
      autorizacaoPromocional: false,
      aceiteTermosVersao: VERSAO_TERMOS,
      aceiteTermosEm: iso(dias(-30)),
      ativo: true,
      criadoEm: iso(dias(-30)),
    });
  }
}

function criarBaseLegada(): BaseSemComunidade {
  const adminId = "usr-admin";
  const partId = "usr-participante";
  const orgUserId = "usr-organizador";
  const orgId = "org-bravo";

  const evSerra = "evt-serra-verde";
  const evEscudo = "evt-escudo-norte";
  const evRaposa = "evt-raposa"; // rascunho
  const evTrovao = "evt-trovao"; // concluído

  return {
    versao: VERSAO_BASE,
    impulsionamentos: [],
    configuracoes: [],
    usuarios: [
      {
        id: adminId,
        perfil: "admin",
        nomeCompleto: "Comando Administrativo",
        cpf: "00000000191",
        dataNascimento: "1985-03-10",
        email: "admin@admin",
        whatsapp: "11999990001",
        endereco: {
          cep: "01001000",
          logradouro: "Praça da Sé",
          numero: "1",
          bairro: "Sé",
          cidade: "São Paulo",
          uf: "SP",
        },
        autorizacaoResponsavel: "nao_aplicavel",
        autorizacaoPromocional: false,
        aceiteTermosVersao: VERSAO_TERMOS,
        aceiteTermosEm: iso(agora),
        ativo: true,
        criadoEm: iso(dias(-120)),
      },
      {
        id: partId,
        perfil: "participante",
        nomeCompleto: "Carlos Exemplo da Silva",
        cpf: "52998224725",
        dataNascimento: "1998-07-22",
        email: "usuario@teste.com.br",
        whatsapp: "11988887777",
        endereco: {
          cep: "01310930",
          logradouro: "Avenida Paulista",
          numero: "1000",
          bairro: "Bela Vista",
          cidade: "São Paulo",
          uf: "SP",
        },
        instagram: "@carlos.exemplo",
        squad: "Squad Lobo Cinza",
        autorizacaoResponsavel: "nao_aplicavel",
        autorizacaoPromocional: true,
        aceiteTermosVersao: VERSAO_TERMOS,
        aceiteTermosEm: iso(agora),
        ativo: true,
        criadoEm: iso(dias(-90)),
      },
      {
        id: orgUserId,
        perfil: "organizador",
        nomeCompleto: "Marina Fictícia Organizadora",
        cpf: "39053344705",
        dataNascimento: "1990-11-05",
        email: "organizador@teste.com.br",
        whatsapp: "11977776666",
        endereco: {
          cep: "04543011",
          logradouro: "Rua Fictícia",
          numero: "200",
          bairro: "Itaim Bibi",
          cidade: "São Paulo",
          uf: "SP",
        },
        autorizacaoResponsavel: "nao_aplicavel",
        autorizacaoPromocional: false,
        aceiteTermosVersao: VERSAO_TERMOS,
        aceiteTermosEm: iso(agora),
        organizacaoId: orgId,
        ativo: true,
        criadoEm: iso(dias(-100)),
      },
    ],
    organizacoes: [
      {
        id: orgId,
        nome: "Força Tática Bravo",
        cnpj: "11222333000181",
        instagram: "@forcabravo",
        telefone: "11977776666",
        responsavelId: orgUserId,
        status: "ativa",
        criadoEm: iso(dias(-95)),
      },
    ],
    solicitacoes: [
      {
        id: "sol-1",
        usuarioId: partId,
        possuiCnpj: false,
        nomeOrganizacao: "Grupo Recon Litoral",
        instagram: "@reconlitoral",
        telefone: "11988887777",
        status: "pendente",
        criadoEm: iso(dias(-3)),
        atualizadoEm: iso(dias(-3)),
      },
    ],
    eventos: [
      {
        id: evSerra,
        modalidade: "milsim",
        organizacaoId: orgId,
        nome: "Operação Serra Verde",
        descricaoResumida:
          "Grande operação de fim de semana em área de mata serrana, com dois exércitos e missões dinâmicas.",
        enredo:
          "Dois destacamentos disputam o controle de uma rota logística estratégica na Serra Verde. Inteligência, patrulhamento e tomada de objetivos definem o vencedor.",
        inicioEm: iso(dias(20)),
        fimEm: iso(dias(22)),
        fuso: "America/Sao_Paulo",
        local: "Campo de Treinamento Serra Verde",
        endereco: "Estrada Rural km 12, Serra Verde",
        cidade: "Mairiporã",
        uf: "SP",
        capacidadeTotal: 120,
        exercitos: [
          {
            id: "ex-alfa",
            nome: "Exército Alfa",
            descricao: "Defesa da rota logística.",
            capacidade: 60,
          },
          {
            id: "ex-delta",
            nome: "Exército Delta",
            descricao: "Ofensiva para tomada dos objetivos.",
            capacidade: 60,
          },
        ],
        tipos: [
          {
            id: "tp-padrao",
            nome: "Ingresso Padrão",
            descricao: "Acesso aos dois dias de operação.",
            beneficios: "Patch do evento + cronograma impresso",
            precoBaseCentavos: 18000,
            quantidadeMaxima: 100,
          },
          {
            id: "tp-vip",
            nome: "Ingresso Operador",
            descricao: "Acesso completo + kit exclusivo.",
            beneficios: "Patch bordado, camiseta e briefing antecipado",
            precoBaseCentavos: 32000,
            quantidadeMaxima: 20,
          },
        ],
        lotes: [
          {
            id: "lt-1",
            nome: "Lote 1 — Antecipado",
            inicioVendas: iso(dias(-30)),
            fimVendas: iso(dias(-5)),
            status: "encerrado",
            itens: [
              { tipoId: "tp-padrao", precoCentavos: 15000, quantidade: 40 },
              { tipoId: "tp-vip", precoCentavos: 28000, quantidade: 10 },
            ],
          },
          {
            id: "lt-2",
            nome: "Lote 2 — Regular",
            inicioVendas: iso(dias(-5)),
            fimVendas: iso(dias(15)),
            status: "ativo",
            itens: [
              { tipoId: "tp-padrao", precoCentavos: 18000, quantidade: 50 },
              { tipoId: "tp-vip", precoCentavos: 32000, quantidade: 8 },
            ],
          },
        ],
        cronograma: [
          {
            id: "cr-1",
            data: dias(20).toISOString().slice(0, 10),
            horario: "08:00",
            titulo: "Check-in e credenciamento",
            descricao: "Conferência de ingressos e entrega de patches.",
            local: "Portaria principal",
            ordem: 1,
          },
          {
            id: "cr-2",
            data: dias(20).toISOString().slice(0, 10),
            horario: "10:00",
            titulo: "Briefing geral",
            descricao: "Apresentação do enredo e das regras de segurança.",
            ordem: 2,
          },
          {
            id: "cr-3",
            data: dias(21).toISOString().slice(0, 10),
            horario: "09:00",
            titulo: "Fase 2 — Tomada de objetivos",
            descricao: "Missões dinâmicas em três setores do campo.",
            ordem: 3,
          },
        ],
        regras: {
          titulo: "Caderno de Regras — Operação Serra Verde",
          versao: "1.2",
          atualizadoEm: iso(dias(-10)),
          formato: "html",
          conteudoHtml:
            "<h2>1. Segurança</h2><p>Uso obrigatório de óculos de proteção balística em todas as áreas de jogo. Cronagem máxima de 400 FPS com BBs de 0,20g.</p><h2>2. Conduta</h2><p>Respeito absoluto a participantes, staff e propriedade. Acertos devem ser declarados imediatamente.</p><h2>3. Uniformes</h2><p>Cada exército possui padrão de uniforme definido no briefing. Faixas de identificação são obrigatórias.</p><h2>4. Estrutura</h2><p>Área de camping, alimentação e segurança 24h durante o evento.</p>",
        },
        whatsappGrupoUrl: "https://chat.whatsapp.com/GrupoFicticioSerra01",
        status: "publicado",
        criadoEm: iso(dias(-40)),
      },
      {
        id: evEscudo,
        modalidade: "real_action",
        organizacaoId: orgId,
        nome: "Operação Escudo Norte",
        descricaoResumida:
          "Operação de um dia em ambiente urbano cenográfico. Vagas quase esgotadas.",
        enredo:
          "Uma força de paz deve proteger instalações críticas enquanto a oposição tenta sabotá-las.",
        inicioEm: iso(dias(35)),
        fimEm: iso(dias(35)),
        fuso: "America/Sao_Paulo",
        local: "CT Urbano Norte",
        endereco: "Rodovia Fictícia km 40",
        cidade: "Campinas",
        uf: "SP",
        capacidadeTotal: 40,
        exercitos: [
          { id: "ex-esc", nome: "Força Escudo", capacidade: 20 },
          { id: "ex-nor", nome: "Oposição Norte", capacidade: 20 },
        ],
        tipos: [
          {
            id: "tp-esc-padrao",
            nome: "Ingresso Único",
            precoBaseCentavos: 12000,
            quantidadeMaxima: 40,
          },
        ],
        lotes: [
          {
            id: "lt-esc-1",
            nome: "Lote único",
            inicioVendas: iso(dias(-15)),
            fimVendas: iso(dias(30)),
            status: "ativo",
            itens: [
              { tipoId: "tp-esc-padrao", precoCentavos: 12000, quantidade: 40 },
            ],
          },
        ],
        cronograma: [
          {
            id: "cr-e1",
            data: dias(35).toISOString().slice(0, 10),
            horario: "08:30",
            titulo: "Credenciamento",
            descricao: "Check-in e cronagem.",
            ordem: 1,
          },
        ],
        regras: {
          titulo: "Regras — Escudo Norte",
          versao: "1.0",
          atualizadoEm: iso(dias(-15)),
          formato: "html",
          conteudoHtml:
            "<h2>Regras gerais</h2><p>Evento de um dia, limite de 350 FPS. Sem full-auto em ambientes fechados.</p>",
        },
        status: "publicado",
        criadoEm: iso(dias(-20)),
      },
      {
        id: evRaposa,
        organizacaoId: orgId,
        nome: "Treinamento Raposa (rascunho)",
        descricaoResumida: "Treinamento interno em elaboração.",
        enredo: "A definir.",
        inicioEm: iso(dias(60)),
        fimEm: iso(dias(60)),
        fuso: "America/Sao_Paulo",
        local: "A definir",
        endereco: "A definir",
        cidade: "São Paulo",
        uf: "SP",
        capacidadeTotal: 30,
        exercitos: [{ id: "ex-rap", nome: "Pelotão Único", capacidade: 30 }],
        tipos: [
          {
            id: "tp-rap",
            nome: "Ingresso Padrão",
            precoBaseCentavos: 8000,
            quantidadeMaxima: 30,
          },
        ],
        lotes: [],
        cronograma: [],
        status: "rascunho",
        criadoEm: iso(dias(-5)),
      },
      {
        id: evTrovao,
        modalidade: "milsim",
        organizacaoId: orgId,
        nome: "Operação Trovão 2025",
        descricaoResumida: "Edição anterior, já concluída.",
        enredo: "Confronto clássico em campo aberto.",
        inicioEm: iso(dias(-60)),
        fimEm: iso(dias(-58)),
        fuso: "America/Sao_Paulo",
        local: "Campo Trovão",
        endereco: "Zona Rural",
        cidade: "Itu",
        uf: "SP",
        capacidadeTotal: 80,
        exercitos: [
          { id: "ex-t1", nome: "Trovão Azul", capacidade: 40 },
          { id: "ex-t2", nome: "Trovão Vermelho", capacidade: 40 },
        ],
        tipos: [
          {
            id: "tp-t1",
            nome: "Ingresso Padrão",
            precoBaseCentavos: 15000,
            quantidadeMaxima: 80,
          },
        ],
        lotes: [],
        cronograma: [
          {
            id: "cr-t1",
            data: dias(-60).toISOString().slice(0, 10),
            horario: "09:00",
            titulo: "Abertura",
            descricao: "Briefing inicial.",
            ordem: 1,
          },
        ],
        status: "concluido",
        criadoEm: iso(dias(-90)),
      },
    ],
    inscricoes: (() => {
      const lista: BaseDados["inscricoes"] = [];
      // Participante inicial confirmado na Serra Verde
      lista.push({
        id: "ins-1",
        eventoId: evSerra,
        usuarioId: partId,
        tipoId: "tp-padrao",
        loteId: "lt-2",
        exercitoId: "ex-alfa",
        codigo: "SV-7F3K2",
        status: "confirmada",
        origem: "plataforma",
        valorCentavos: 18000,
        descontoCentavos: 0,
        criadoEm: iso(dias(-4)),
      });
      // Inscritos fictícios extras para deixar Escudo Norte quase esgotado
      for (let i = 0; i < 36; i++) {
        lista.push({
          id: `ins-esc-${i}`,
          eventoId: evEscudo,
          usuarioId: `usr-fict-${i}`,
          tipoId: "tp-esc-padrao",
          loteId: "lt-esc-1",
          exercitoId: i % 2 === 0 ? "ex-esc" : "ex-nor",
          codigo: `EN-${1000 + i}`,
          status: "confirmada",
          origem: "plataforma",
          valorCentavos: 12000,
          descontoCentavos: 0,
          criadoEm: iso(dias(-10)),
        });
      }
      // Histórico: participação concluída e uma cancelada
      lista.push({
        id: "ins-hist-1",
        eventoId: evTrovao,
        usuarioId: partId,
        tipoId: "tp-t1",
        exercitoId: "ex-t1",
        codigo: "TR-2025-01",
        status: "confirmada",
        origem: "plataforma",
        valorCentavos: 15000,
        descontoCentavos: 0,
        criadoEm: iso(dias(-70)),
      });
      lista.push({
        id: "ins-hist-2",
        eventoId: evTrovao,
        usuarioId: partId,
        tipoId: "tp-t1",
        exercitoId: "ex-t2",
        codigo: "TR-2025-02",
        status: "estornada",
        origem: "plataforma",
        valorCentavos: 15000,
        descontoCentavos: 0,
        criadoEm: iso(dias(-75)),
        canceladoEm: iso(dias(-72)),
        motivoCancelamento: "Conflito de agenda do participante",
      });
      return lista;
    })(),
    cupons: [
      {
        id: "cup-1",
        eventoId: evSerra,
        codigo: "BEMVINDO10",
        descontoPercentual: 10,
        validoDe: iso(dias(-20)),
        validoAte: iso(dias(10)),
        limiteUsos: 50,
        usos: 3,
        tiposElegiveis: ["tp-padrao"],
        ativo: true,
      },
      {
        id: "cup-2",
        eventoId: evSerra,
        codigo: "EXPIRADO20",
        descontoPercentual: 20,
        validoDe: iso(dias(-40)),
        validoAte: iso(dias(-10)),
        limiteUsos: 10,
        usos: 2,
        tiposElegiveis: ["tp-padrao", "tp-vip"],
        ativo: true,
      },
      {
        id: "cup-3",
        eventoId: evSerra,
        codigo: "ESGOTADO15",
        descontoPercentual: 15,
        validoDe: iso(dias(-20)),
        validoAte: iso(dias(10)),
        limiteUsos: 5,
        usos: 5,
        tiposElegiveis: ["tp-padrao"],
        ativo: true,
      },
    ],
    cortesias: [
      {
        id: "cor-1",
        eventoId: evSerra,
        nomeConvidado: "Convidado Exemplo",
        emailConvidado: "convidado@exemplo.com.br",
        tipoId: "tp-padrao",
        exercitoId: "ex-delta",
        validade: iso(dias(10)),
        codigo: "CORT-SV-ABC123",
        status: "pendente",
        criadoEm: iso(dias(-2)),
      },
      {
        id: "cor-2",
        eventoId: evTrovao,
        nomeConvidado: "Convidada Resgatada",
        emailConvidado: "resgatada@exemplo.com.br",
        tipoId: "tp-t1",
        validade: iso(dias(-55)),
        codigo: "CORT-TR-XYZ789",
        status: "resgatada",
        criadoEm: iso(dias(-65)),
      },
    ],
    missoes: [
      {
        id: "mis-1",
        eventoId: evSerra,
        titulo: "Reconhecimento de terreno",
        descricao:
          "Estude o mapa do setor norte e descreva duas rotas de aproximação.",
        prazo: iso(dias(12)),
        publico: "todos",
        tipoEntrega: "texto",
        exigeAprovacao: true,
      },
      {
        id: "mis-2",
        eventoId: evSerra,
        titulo: "Confirmação de equipamento",
        descricao: "Confirme que seu equipamento passou pela cronagem.",
        prazo: iso(dias(18)),
        publico: "ex-alfa",
        tipoEntrega: "confirmacao",
        exigeAprovacao: false,
      },
    ],
    entregas: [
      {
        id: "ent-1",
        missaoId: "mis-1",
        usuarioId: partId,
        status: "enviada",
        conteudo: "Rotas pela trilha leste e pelo vale central.",
        enviadoEm: iso(dias(-1)),
      },
    ],
    comunicados: [
      {
        id: "com-1",
        eventoId: evSerra,
        autorId: orgUserId,
        titulo: "Boas-vindas à Operação Serra Verde",
        corpo:
          "Inscrições abertas! Leiam o caderno de regras e preparem o equipamento. Briefing obrigatório no primeiro dia.",
        fixado: true,
        criadoEm: iso(dias(-6)),
      },
      {
        id: "com-2",
        eventoId: evSerra,
        autorId: orgUserId,
        titulo: "Atualização do cronograma",
        corpo: "A Fase 2 foi antecipada para 09:00 do segundo dia.",
        fixado: false,
        criadoEm: iso(dias(-2)),
      },
    ],
    comentarios: [
      {
        id: "cmt-1",
        comunicadoId: "com-1",
        autorId: partId,
        corpo: "Ansioso! Squad Lobo Cinza presente.",
        criadoEm: iso(dias(-5)),
      },
    ],
    chamados: [
      {
        id: "cha-1",
        eventoId: evSerra,
        solicitanteId: partId,
        assunto: "Dúvida sobre estacionamento",
        categoria: "Logística",
        descricao: "Haverá estacionamento no local do evento?",
        status: "em_atendimento",
        mensagens: [
          {
            id: "msg-1",
            autorId: partId,
            corpo: "Haverá estacionamento no local do evento?",
            criadoEm: iso(dias(-3)),
          },
          {
            id: "msg-2",
            autorId: orgUserId,
            corpo: "Sim, estacionamento gratuito ao lado da portaria.",
            criadoEm: iso(dias(-2)),
          },
        ],
        criadoEm: iso(dias(-3)),
        atualizadoEm: iso(dias(-2)),
      },
      {
        id: "cha-2",
        solicitanteId: partId,
        assunto: "Troca de patch",
        categoria: "Produtos",
        descricao: "Meu patch veio com defeito na costura.",
        status: "resolvido",
        mensagens: [
          {
            id: "msg-3",
            autorId: partId,
            corpo: "Meu patch veio com defeito na costura.",
            criadoEm: iso(dias(-20)),
          },
        ],
        criadoEm: iso(dias(-20)),
        atualizadoEm: iso(dias(-18)),
      },
    ],
    notificacoes: [
      {
        id: "not-1",
        usuarioId: partId,
        titulo: "Inscrição confirmada",
        corpo: "Sua inscrição na Operação Serra Verde foi confirmada.",
        link: "/app/ingressos",
        lida: false,
        criadoEm: iso(dias(-4)),
      },
      {
        id: "not-2",
        usuarioId: partId,
        titulo: "Novo comunicado",
        corpo: "Atualização do cronograma da Operação Serra Verde.",
        link: "/comunidade/evt-serra-verde",
        lida: false,
        criadoEm: iso(dias(-2)),
      },
      {
        id: "not-3",
        usuarioId: adminId,
        titulo: "Solicitação de organizador",
        corpo: "Nova solicitação aguardando análise: Grupo Recon Litoral.",
        link: "/admin/solicitacoes",
        lida: false,
        criadoEm: iso(dias(-3)),
      },
      {
        id: "not-4",
        usuarioId: orgUserId,
        titulo: "Nova inscrição recebida",
        corpo: "Ana Ribeiro se inscreveu na Operação Serra Verde (Exército Alfa).",
        link: "/organizacao/inscritos",
        lida: false,
        criadoEm: iso(dias(-1)),
      },
      {
        id: "not-5",
        usuarioId: orgUserId,
        titulo: "Inscrição confirmada",
        corpo: "A inscrição de Bruno Costa na Operação Serra Verde foi confirmada.",
        link: "/organizacao/inscritos",
        lida: false,
        criadoEm: iso(dias(-2)),
      },
      {
        id: "not-6",
        usuarioId: orgUserId,
        titulo: "Cortesia utilizada",
        corpo: "Um link de cortesia da Operação Serra Verde foi utilizado.",
        link: "/organizacao/financeiro",
        lida: true,
        criadoEm: iso(dias(-5)),
      },
    ],
    movimentacoes: [
      {
        id: "mov-1",
        eventoId: evSerra,
        inscricaoId: "ins-1",
        tipo: "inscricao",
        valorCentavos: 18000,
        descricao: "Inscrição confirmada — Ingresso Padrão (Lote 2)",
        criadoEm: iso(dias(-4)),
      },
      {
        id: "mov-2",
        eventoId: evTrovao,
        inscricaoId: "ins-hist-2",
        tipo: "estorno",
        valorCentavos: -15000,
        descricao: "Estorno integral simulado — cancelamento",
        criadoEm: iso(dias(-72)),
      },
    ],
    auditoria: [
      {
        id: "aud-1",
        autorId: adminId,
        acao: "aprovacao_organizador",
        entidade: "organizacao",
        entidadeId: orgId,
        criadoEm: iso(dias(-95)),
      },
    ],
    privacidade: [],
    checkins: [],
    perfisOperador: [],
    equipamentos: [],
    fotosPerfil: [],
    insignias: [],
    concessoesInsignia: [],
    campanhasRecompensa: [],
    vouchers: [],
    correcoesParticipacao: [],
    operacoesExternas: [],
    campanhasMissoes: [],
  };
}
