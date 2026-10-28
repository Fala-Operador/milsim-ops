import { createFileRoute, Link } from "@tanstack/react-router";
import { MODALIDADES, type ModalidadeId } from "@/lib/modalidades";
import { Button } from "@/components/ui/button";
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

/**
 * Rolagem até a seção de uma modalidade. Quem rola é o próprio router (`hashScrollIntoView`
 * do Link): ele intercepta mudanças de # no endereço e, se outra rolagem estiver em curso,
 * a substitui por um pulo seco. O scroll-mt da seção desconta o cabeçalho e a barra fixa.
 * Sem animação para quem pede menos movimento.
 */
const rolagemSuave = (): ScrollIntoViewOptions => ({
  behavior: typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
  block: "start",
});

function PaginaModalidades() {
  return (
    <div>
      <header className="relative isolate overflow-hidden border-b border-border bg-black text-white">
        <img src={imgMilsim} alt="" className="absolute inset-0 -z-10 h-full w-full object-cover opacity-55" />
        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-black/90 via-black/60 to-transparent" aria-hidden />
        <div className="mx-auto max-w-6xl px-4 py-14 sm:py-20">
          <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-white/70">Guia do jogador</p>
          <h1 className="mt-2 font-display text-5xl font-bold uppercase leading-none sm:text-6xl">Modalidades</h1>
          <p className="mt-4 max-w-xl text-white/80">
            Cada operação pertence a uma modalidade. Ela define o estilo de jogo, o ritmo e o equipamento exigido. Escolha a sua e veja as operações abertas.
          </p>
        </div>
      </header>

      <nav aria-label="Modalidades" className="sticky top-14 z-10 border-b lg:top-[68px] border-border bg-background/95 backdrop-blur">
        <ol className="carousel-viewport mx-auto flex max-w-6xl gap-1 overflow-x-auto px-4 py-2">
          {MODALIDADES.map((m, i) => (
            <li key={m.id} className="shrink-0">
              <Link
                to="/modalidades"
                hash={`modalidade-${m.id}`}
                replace
                resetScroll={false}
                hashScrollIntoView={rolagemSuave()}
                // Teclado e leitor de tela seguem para a seção escolhida (sem novo pulo).
                onClick={() => document.getElementById(`modalidade-${m.id}`)?.focus({ preventScroll: true })}
                className="flex items-baseline gap-2 rounded-md px-3 py-1.5 text-sm hover:bg-secondary"
              >
                <span className="font-mono text-[11px] text-accent">{String(i + 1).padStart(2, "0")}</span>{m.nome}
              </Link>
            </li>
          ))}
        </ol>
      </nav>

      <div className="mx-auto max-w-6xl divide-y divide-border px-4">
        {MODALIDADES.map((m, i) => {
          const info = EXPLICACOES[m.id];
          const invertido = i % 2 === 1;
          return (
            <section key={m.id} id={`modalidade-${m.id}`} aria-labelledby={`t-modalidade-${m.id}`} tabIndex={-1}
              className="grid scroll-mt-28 items-center gap-8 py-12 outline-none lg:scroll-mt-32 lg:grid-cols-2 lg:gap-14">
              <div className={`relative overflow-hidden rounded-lg border border-border ${invertido ? "lg:order-2" : ""}`}>
                <img src={info.imagem} alt={`Cena representativa da modalidade ${m.nome}`} loading={i === 0 ? "eager" : "lazy"}
                  width={1280} height={720} className="aspect-[4/3] w-full object-cover" />
                <span className="absolute left-4 top-4 font-display text-6xl font-bold leading-none text-white/90 drop-shadow">{String(i + 1).padStart(2, "0")}</span>
              </div>
              <div>
                <p className="rotulo-tecnico">Modalidade {String(i + 1).padStart(2, "0")} de {String(MODALIDADES.length).padStart(2, "0")}</p>
                <h2 id={`t-modalidade-${m.id}`} className="mt-2 font-display text-4xl font-bold uppercase leading-none">{m.nome}</h2>
                <p className="mt-4 text-lg font-medium leading-snug">{info.resumo}</p>
                <dl className="mt-6 space-y-5 border-l-2 border-accent/60 pl-5 text-sm leading-relaxed">
                  <div>
                    <dt className="rotulo-tecnico">Como funciona</dt>
                    <dd className="mt-1 text-muted-foreground">{info.comoFunciona}</dd>
                  </div>
                  <div>
                    <dt className="rotulo-tecnico">Para quem é</dt>
                    <dd className="mt-1 text-muted-foreground">{info.paraQuem}</dd>
                  </div>
                </dl>
                <Button asChild variant="outline" className="mt-6">
                  <Link to="/" search={{ mod: m.id }}>Ver operações de {m.nome}</Link>
                </Button>
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
