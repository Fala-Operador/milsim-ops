// Dados demonstrativos da página inicial: eventos de várias regiões, parceiros e seções.
import type { BaseDados, Evento, Parceiro, SecaoInicial } from "@/lib/domain/types";
import type { BaseSemDivulgacao } from "@/data/seedComunidade";
import imgTrilha from "@/assets/comunidade-trilha.jpg";

const dias = (n: number) => new Date(Date.now() + n * 86400000).toISOString();

function eventoRegional(
  id: string, nome: string, cidade: string, uf: string, emDias: number, capacidade: number, preco: number, orgId: string,
): Evento {
  return {
    id, organizacaoId: orgId, nome,
    descricaoResumida: `Operação demonstrativa em ${cidade}/${uf}.`,
    enredo: "Duas forças disputam o controle de pontos estratégicos.",
    inicioEm: dias(emDias), fimEm: dias(emDias + 1), fuso: "America/Sao_Paulo",
    local: `Campo ${cidade}`, endereco: "Endereço fictício", cidade, uf, capacidadeTotal: capacidade,
    exercitos: [
      { id: `${id}-a`, nome: "Força Azul", capacidade: capacidade / 2 },
      { id: `${id}-b`, nome: "Força Vermelha", capacidade: capacidade / 2 },
    ],
    tipos: [{ id: `${id}-tp`, nome: "Ingresso Padrão", precoBaseCentavos: preco, quantidadeMaxima: capacidade }],
    lotes: [{
      id: `${id}-lt`, nome: "Lote 1", inicioVendas: dias(-10), fimVendas: dias(emDias - 1), status: "ativo",
      itens: [{ tipoId: `${id}-tp`, precoCentavos: preco, quantidade: capacidade }],
    }],
    cronograma: [], status: "publicado", criadoEm: dias(-emDias / 3),
  };
}

// Logos demonstrativos em SVG (sem marcas reais).
function logo(sigla: string, cor: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="120" viewBox="0 0 240 120"><rect x="10" y="20" width="80" height="80" rx="16" fill="${cor}"/><text x="50" y="72" font-family="Arial" font-weight="700" font-size="30" fill="#fff" text-anchor="middle">${sigla}</text><text x="160" y="70" font-family="Arial" font-weight="700" font-size="22" fill="${cor}" text-anchor="middle">${sigla} Co.</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export function aplicarSeedDivulgacao(b: BaseSemDivulgacao): BaseDados {
  const org = b.organizacoes[0]?.id ?? "org-bravo";
  const regionais = [
    eventoRegional("evt-mangue-recife", "Operação Mangue Seco", "Recife", "PE", 25, 60, 13000, org),
    eventoRegional("evt-araucaria", "Operação Araucária", "Curitiba", "PR", 40, 80, 14000, org),
    eventoRegional("evt-cerrado", "Operação Cerrado Vivo", "Goiânia", "GO", 50, 50, 11000, org),
    eventoRegional("evt-amazonia", "Operação Rio Negro", "Manaus", "AM", 70, 40, 16000, org),
    eventoRegional("evt-serra-mg", "Operação Serra do Curral", "Belo Horizonte", "MG", 28, 70, 12500, org),
    eventoRegional("evt-salvador", "Operação Farol da Barra", "Salvador", "BA", 45, 60, 12000, org),
  ];
  const agora = new Date().toISOString();
  const parceiros: Parceiro[] = [
    {
      id: "par-tatico", nome: "Tático Equipamentos", tipo: "patrocinador",
      descricao: "Equipamentos e vestuário tático para operações.", logoUrl: logo("TE", "#4d5d2a"),
      textoAlt: "Logo da Tático Equipamentos", ativo: true, criadoEm: agora, atualizadoEm: agora,
      links: [
        { id: "lk-1", tipo: "site", url: "https://exemplo-tatico.com.br", principal: true },
        { id: "lk-2", tipo: "instagram", url: "@taticoequip" },
        { id: "lk-3", tipo: "whatsapp", telefone: "+55 11 99999-0000", mensagem: "Olá! Vi vocês no MilSim Ops." },
      ],
    },
    {
      id: "par-bbs", nome: "BBs Precision", tipo: "ambos",
      descricao: "Munição biodegradável de alta precisão.", logoUrl: logo("BP", "#8a5a1f"),
      textoAlt: "Logo da BBs Precision", ativo: true, criadoEm: agora, atualizadoEm: agora,
      links: [
        { id: "lk-4", tipo: "instagram", url: "https://instagram.com/bbsprecision", principal: true },
        { id: "lk-5", tipo: "outro", rotulo: "Catálogo", url: "https://exemplo-bbs.com.br/catalogo" },
      ],
    },
    {
      id: "par-campo", nome: "Campo Base SP", tipo: "apoiador",
      descricao: "Campo parceiro da comunidade paulista.", logoUrl: logo("CB", "#2f5d50"),
      textoAlt: "Logo do Campo Base SP", ativo: true, criadoEm: agora, atualizadoEm: agora, links: [],
    },
    {
      id: "par-radio", nome: "Rádio Comms", tipo: "apoiador", logoUrl: logo("RC", "#5a3d6b"),
      textoAlt: "Logo da Rádio Comms", ativo: true, criadoEm: agora, atualizadoEm: agora,
      links: [{ id: "lk-6", tipo: "whatsapp", telefone: "5521988887777", principal: true }],
    },
  ];
  const base = (s: Partial<SecaoInicial> & Pick<SecaoInicial, "id" | "titulo" | "tipo" | "ordem">): SecaoInicial => ({
    abrangencia: { escopo: "nacional" }, status: "publicada", agendamento: {}, layout: "grade", modo: "manual",
    destaques: [], mostrarEsgotados: true, parceiros: [], tamanhoLogo: "m", mostrarDescricoes: false,
    superficieLogo: "clara", criadoEm: agora, atualizadoEm: agora, ...s,
  });
  const secoesInicio: SecaoInicial[] = [
    base({
      id: "sec-banner", titulo: "Temporada de operações", tipo: "banner", layout: "banner", ordem: 1,
      banner: {
        imagemDesktop: imgTrilha, textoAlt: "Operadores em trilha na mata",
        chamada: "Temporada de operações aberta — garanta sua vaga", textoBotao: "Ver Operação Serra Verde",
        destino: { tipo: "evento", valor: "evt-serra-verde" },
      },
    }),
    base({
      id: "sec-destaques", titulo: "Operações em destaque", subtitulo: "Selecionadas pela equipe MilSim Ops", tipo: "destaques",
      ordem: 2, layout: "carrossel",
      destaques: [
        { id: "dst-1", eventoId: "evt-serra-verde", posicao: 1, selo: "Destaque da semana", chamada: "Fim de semana completo com camping.", agendamento: {} },
        { id: "dst-2", eventoId: "evt-escudo-norte", posicao: 2, selo: "Últimas vagas", agendamento: {} },
        { id: "dst-3", eventoId: "evt-mangue-recife", posicao: 3, agendamento: {} },
        { id: "dst-4", eventoId: "evt-araucaria", posicao: 4, agendamento: {} },
      ],
    }),
    base({
      id: "sec-sudeste", titulo: "Operações em destaque no Sudeste", tipo: "regional", ordem: 3, modo: "automatico",
      abrangencia: { escopo: "regiao", regiao: "Sudeste" },
      automatica: { abrangencia: { escopo: "regiao", regiao: "Sudeste" }, maximo: 6, incluirEsgotados: true, ordenacao: "data" },
    }),
    base({
      id: "sec-nordeste", titulo: "Destaques do Nordeste", tipo: "regional", ordem: 4, modo: "automatico",
      abrangencia: { escopo: "regiao", regiao: "Nordeste" },
      automatica: { abrangencia: { escopo: "regiao", regiao: "Nordeste" }, maximo: 6, incluirEsgotados: false, ordenacao: "data" },
    }),
    base({
      id: "sec-sp", titulo: "Próximas operações em São Paulo", tipo: "regional", ordem: 5, modo: "automatico",
      abrangencia: { escopo: "estado", uf: "SP" }, status: "rascunho",
      automatica: { abrangencia: { escopo: "estado", uf: "SP" }, periodoDias: 90, maximo: 4, incluirEsgotados: true, ordenacao: "data" },
    }),
    base({
      id: "sec-patrocinadores", titulo: "Patrocinadores oficiais", tipo: "patrocinadores", ordem: 6, tamanhoLogo: "g",
      mostrarDescricoes: true, parceiros: [{ parceiroId: "par-tatico", posicao: 1 }, { parceiroId: "par-bbs", posicao: 2 }],
    }),
    base({
      id: "sec-apoiadores-se", titulo: "Apoiadores do Sudeste", tipo: "apoiadores", ordem: 7, layout: "carrossel",
      abrangencia: { escopo: "regiao", regiao: "Sudeste" },
      parceiros: [{ parceiroId: "par-campo", posicao: 1 }, { parceiroId: "par-radio", posicao: 2 }, { parceiroId: "par-bbs", posicao: 3 }],
    }),
  ];
  return { ...b, eventos: [...b.eventos, ...regionais], parceiros, secoesInicio };
}
