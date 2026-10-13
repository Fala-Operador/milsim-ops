import { createFileRoute, Link } from "@tanstack/react-router";
import { MODALIDADES, type ModalidadeId } from "@/lib/modalidades";
import imgRealAction from "@/assets/modalidade-real-action.jpg";
import imgSar from "@/assets/modalidade-sar.jpg";
import imgMilsim from "@/assets/modalidade-milsim.jpg";
import imgSpeedsoft from "@/assets/modalidade-speedsoft.jpg";
import imgForfun from "@/assets/modalidade-forfun.jpg";

interface Explicacao {
  imagem: string;
  resumo: string;
  comoFunciona: string;
  paraQuem: string;
}

const EXPLICACOES: Record<ModalidadeId, Explicacao> = {
  real_action: {
    imagem: imgRealAction,
    resumo: "O máximo de realismo tático: equipamento, comunicação e procedimentos próximos de uma operação real.",
    comoFunciona:
      "As equipes operam em cenários amplos, geralmente em mata fechada, com missões de reconhecimento, patrulha e tomada de objetivos. O ritmo é metódico: planejamento, deslocamento silencioso e disciplina de rádio valem mais do que velocidade. O uniforme e o carregamento seguem regras rígidas definidas no manual do evento.",
    paraQuem: "Para quem busca imersão total, joga em equipe e aceita regras rigorosas de conduta e equipamento.",
  },
  sar: {
    imagem: imgSar,
    resumo: "Busca e salvamento simulado: localizar, estabilizar e retirar vítimas em cenários de emergência.",
    comoFunciona:
      "As equipes recebem um cenário de emergência — desabamento, desaparecimento em mata, acidente — e precisam montar um plano de busca, localizar as vítimas simuladas, prestar os primeiros atendimentos e conduzir a retirada, muitas vezes com maca e rádio. A pontuação valoriza técnica, trabalho em equipe e tempo de resposta.",
    paraQuem: "Para quem gosta de técnica, resgate e cooperação — menos confronto, mais missão.",
  },
  milsim: {
    imagem: imgMilsim,
    resumo: "Simulação militar em grande escala: dezenas de jogadores, facções, cadeia de comando e missões encadeadas.",
    comoFunciona:
      "O evento simula um conflito entre facções, com comando, pelotões e objetivos que evoluem ao longo de horas — às vezes dias. Há briefings, logística, pontos de reabastecimento e consequências: perder um objetivo muda o rumo do jogo. O enredo conduz as missões e cada equipe influencia o resultado final.",
    paraQuem: "Para quem quer viver uma operação longa, com estratégia, hierarquia e enredo.",
  },
  speedsoft: {
    imagem: imgSpeedsoft,
    resumo: "Rápido e competitivo: partidas curtas em arenas, com equipamento leve e muita movimentação.",
    comoFunciona:
      "As partidas acontecem em arenas fechadas ou campos com obstáculos infláveis, em rodadas de poucos minutos. O equipamento é leve e o jogo é de velocidade, reflexo e mira — parecido com um esporte de quadra. Ideal para treinar e competir sem o peso do equipamento completo.",
    paraQuem: "Para quem prefere ação rápida, competição e partidas curtas.",
  },
  forfun: {
    imagem: imgForfun,
    resumo: "O jogo pela diversão: partidas descontraídas, sem compromisso competitivo, abertas a iniciantes.",
    comoFunciona:
      "São encontros casuais, com modos de jogo simples — capturar a bandeira, eliminação, defesa de ponto — e clima de confraternização. Não há exigência de uniforme completo nem de experiência: é a porta de entrada do esporte e o espaço para jogar com os amigos sem pressão.",
    paraQuem: "Para iniciantes, grupos de amigos e quem quer jogar sem compromisso.",
  },
};

export const Route = createFileRoute("/modalidades")({
  head: () => ({
    meta: [
      { title: "Modalidades — MilSim Ops" },
      {
        name: "description",
        content:
          "Conheça as modalidades de simulação militar: Real Action, SAR, Milsim, Speedsoft e Forfun. Entenda como cada uma funciona e escolha a sua próxima operação.",
      },
      { property: "og:title", content: "Modalidades — MilSim Ops" },
      {
        property: "og:description",
        content: "Conheça as modalidades de simulação militar e escolha a sua próxima operação.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PaginaModalidades,
});

function PaginaModalidades() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <header className="max-w-2xl">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Guia do jogador</p>
        <h1 className="mt-1 font-display text-3xl font-semibold uppercase">Modalidades</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          Cada evento da plataforma pertence a uma modalidade. Elas definem o estilo de jogo, o ritmo e o nível de
          exigência de equipamento. Conheça cada uma abaixo e encontre a operação certa para você.
        </p>
      </header>

      <div className="mt-8 space-y-10">
        {MODALIDADES.map((m, i) => {
          const info = EXPLICACOES[m.id];
          return (
            <section
              key={m.id}
              aria-labelledby={`modalidade-${m.id}`}
              className="overflow-hidden rounded-lg border border-border bg-card"
            >
              <img
                src={info.imagem}
                alt={`Cena representativa da modalidade ${m.nome}`}
                loading={i === 0 ? "eager" : "lazy"}
                width={1280}
                height={720}
                className="aspect-video w-full object-cover"
              />
              <div className="p-5 sm:p-6">
                <h2 id={`modalidade-${m.id}`} className="font-display text-xl font-semibold uppercase">
                  {m.nome}
                </h2>
                <p className="mt-2 text-sm font-medium">{info.resumo}</p>
                <div className="mt-4 space-y-3 text-sm leading-relaxed text-muted-foreground">
                  <p>
                    <span className="font-semibold text-foreground">Como funciona: </span>
                    {info.comoFunciona}
                  </p>
                  <p>
                    <span className="font-semibold text-foreground">Para quem é: </span>
                    {info.paraQuem}
                  </p>
                </div>
                <Link
                  to="/"
                  search={{ mod: m.id }}
                  className="mt-4 inline-block text-sm font-semibold text-primary underline-offset-4 hover:underline"
                >
                  Ver eventos de {m.nome}
                </Link>
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
