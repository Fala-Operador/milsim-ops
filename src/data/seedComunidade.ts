// Dados fictícios da comunidade: fóruns, publicações, respostas, curtidas e denúncias.
import type { BaseDados, Usuario } from "@/lib/domain/types";
import { forunsIniciais } from "@/services/comunidade";
import imgTrilha from "@/assets/comunidade-trilha.jpg";
import imgEquip from "@/assets/comunidade-equipamento.jpg";

export type BaseSemComunidade = Omit<
  BaseDados,
  | "foruns"
  | "publicacoes"
  | "respostas"
  | "curtidas"
  | "denuncias"
  | "preferenciasForum"
  | "restricoesComunidade"
  | "moderacao"
  | "visitasComunidade"
  | "parceiros"
  | "secoesInicio"
>;
export type BaseSemDivulgacao = Omit<BaseDados, "parceiros" | "secoesInicio">;

const h = (horas: number) => new Date(Date.now() - horas * 3600_000).toISOString();

let cpfFicticio = 0;
function usuarioFicticio(id: string, nome: string, exibicao: string): Usuario {
  return {
    id,
    perfil: "participante",
    nomeCompleto: nome,
    nomeExibicao: exibicao,
    cpf: `9990000000${cpfFicticio++}`, // fictício e único (CPF é chave única no banco)
    dataNascimento: "1995-01-01",
    email: `${id}@exemplo.invalid`,
    whatsapp: "11900000000",
    endereco: { cep: "00000000", logradouro: "Rua Fictícia", numero: "0", bairro: "Centro", cidade: "São Paulo", uf: "SP" },
    autorizacaoResponsavel: "nao_aplicavel",
    autorizacaoPromocional: false,
    aceiteTermosVersao: "termos-demo-v1",
    aceiteTermosEm: h(500),
    ativo: true,
    criadoEm: h(600),
  };
}

export function aplicarSeedComunidade(b: BaseSemComunidade): BaseSemDivulgacao {
  const ev = "evt-serra-verde";
  cpfFicticio = 0;
  const extras = [
    usuarioFicticio("usr-ana", "Ana Fictícia Rocha", "Ana Sniper"),
    usuarioFicticio("usr-bruno", "Bruno Exemplo Lima", "Bruno Recon"),
    usuarioFicticio("usr-dani", "Daniela Demo Souza", "Dani Medic"),
  ];
  b.usuarios.push(...extras);
  const exs = ["ex-alfa", "ex-delta", "ex-alfa"];
  extras.forEach((u, i) =>
    b.inscricoes.push({
      id: `ins-com-${i}`,
      eventoId: ev,
      usuarioId: u.id,
      tipoId: "tp-padrao",
      loteId: "lt-2",
      exercitoId: exs[i]!,
      codigo: `SV-DEM${i}`,
      status: "confirmada",
      origem: "plataforma",
      valorCentavos: 18000,
      descontoCentavos: 0,
      criadoEm: h(200),
    }),
  );

  const foruns = [
    ...forunsIniciais(ev, h(300)),
    ...forunsIniciais("evt-escudo-norte", h(300)),
    {
      id: "for-serra-prep",
      eventoId: ev,
      nome: "Preparação operacional",
      descricao: "Briefings e preparação específica.",
      icone: "🎯",
      ordem: 6,
      publico: "ex-alfa",
      publicacao: "membros" as const,
      respostas: "membros" as const,
      status: "ativo" as const,
      criadoEm: h(250),
    },
  ];
  const f = (s: string) => `for-${ev}-${s}`;
  const pub = (id: string, forumId: string, autorId: string, texto: string, horas: number, extra: Partial<BaseDados["publicacoes"][number]> = {}) => ({
    id,
    forumId,
    eventoId: ev,
    autorId,
    texto,
    imagens: [],
    fixada: false,
    importante: false,
    respostasFechadas: false,
    oculta: false,
    removidaPeloAutor: false,
    criadoEm: h(horas),
    ...extra,
  });

  return {
    ...b,
    foruns,
    publicacoes: [
      pub("pub-1", f("avisos"), "usr-organizador", "Bem-vindos à Operação Serra Verde! Leiam o caderno de regras e preparem o equipamento. Briefing obrigatório no primeiro dia às 07:30.", 140, { fixada: true, importante: true }),
      pub("pub-2", f("avisos"), "usr-organizador", "Atualização do cronograma: a Fase 2 foi antecipada para 09:00 do segundo dia.", 48),
      pub("pub-3", f("geral"), "usr-ana", "Alguém mais chegando na sexta à noite? Bora montar acampamento junto.", 30),
      pub("pub-4", f("fotos"), "usr-bruno", "Registro do reconhecimento da trilha leste no último fim de semana.", 20, {
        imagens: [{ url: imgTrilha, alt: "Jogadores em camuflagem caminhando por trilha na mata com neblina" }],
      }),
      pub("pub-5", f("duvidas"), "usr-participante", "Qual o limite de FPS para DMR? Quero conferir meu setup antes.", 16, {
        imagens: [{ url: imgEquip, alt: "Equipamento tático organizado sobre mesa de madeira" }],
      }),
      pub("pub-6", f("caronas"), "usr-dani", "Tenho 2 vagas saindo de Campinas no sábado 05:00. Divisão do combustível.", 10),
      pub("pub-7", f("geral"), "usr-bruno", "Vendo réplica barata, chama no privado!!! promoção imperdível", 6),
      pub("pub-8", "for-serra-prep", "usr-ana", "Revisei o mapa do setor norte, sugiro ponto de reunião no vale central.", 4),
    ],
    respostas: [
      { id: "res-1", publicacaoId: "pub-1", autorId: "usr-participante", texto: "Ansioso! Squad Lobo Cinza presente.", oculta: false, criadoEm: h(120) },
      { id: "res-2", publicacaoId: "pub-3", autorId: "usr-dani", texto: "Eu chego sexta umas 21h!", oculta: false, criadoEm: h(28) },
      { id: "res-3", publicacaoId: "pub-5", autorId: "usr-organizador", texto: "DMR até 450 FPS com distância mínima de 30 m. Está no caderno de regras.", oculta: false, criadoEm: h(14) },
      { id: "res-4", publicacaoId: "pub-4", autorId: "usr-ana", texto: "Que foto! A neblina deixou tudo mais tenso.", oculta: false, criadoEm: h(18) },
    ],
    curtidas: [
      { id: "cur-1", publicacaoId: "pub-1", usuarioId: "usr-participante" },
      { id: "cur-2", publicacaoId: "pub-1", usuarioId: "usr-ana" },
      { id: "cur-3", publicacaoId: "pub-1", usuarioId: "usr-dani" },
      { id: "cur-4", publicacaoId: "pub-4", usuarioId: "usr-participante" },
      { id: "cur-5", publicacaoId: "pub-4", usuarioId: "usr-dani" },
      { id: "cur-6", publicacaoId: "pub-6", usuarioId: "usr-ana" },
    ],
    denuncias: [
      { id: "den-1", eventoId: ev, alvo: "publicacao", alvoId: "pub-7", denuncianteId: "usr-dani", motivo: "spam", descricao: "Anúncio de venda fora do tema.", status: "pendente", criadoEm: h(5) },
      { id: "den-2", eventoId: ev, alvo: "publicacao", alvoId: "pub-7", denuncianteId: "usr-participante", motivo: "spam", status: "pendente", criadoEm: h(3) },
    ],
    preferenciasForum: [],
    restricoesComunidade: [],
    moderacao: [],
    visitasComunidade: { "usr-participante:evt-serra-verde": h(24) },
  };
}
