import { createFileRoute, Link } from "@tanstack/react-router";
import { MODALIDADES, type ModalidadeId } from "@/lib/modalidades";
import { Button } from "@/components/ui/button";
import imgRealAction from "@/assets/modalidade-real-action.jpg";
import imgSar from "@/assets/modalidade-sar.jpg";
import imgMilsim from "@/assets/modalidade-milsim.jpg";
import imgSpeedsoft from "@/assets/modalidade-speedsoft.jpg";
import imgForfun from "@/assets/modalidade-forfun.jpg";
import { tr } from "@/i18n/routes/modalidades";
import { idiomaDaRaiz } from "@/lib/i18n";

interface Explicacao {
  imagem: string;
  resumo: string;
  comoFunciona: string;
  paraQuem: string;
}

const EXPLICACOES: Record<ModalidadeId, Explicacao> = {
  real_action: {
    imagem: imgRealAction,
    get resumo() { return tr("o_maximo_de_realismo_tatico_equipamento"); },
    get comoFunciona() { return tr("as_equipes_operam_em_cenarios_amplos"); },
    get paraQuem() { return tr("para_quem_busca_imersao_total_joga"); },
  },
  sar: {
    imagem: imgSar,
    get resumo() { return tr("busca_e_salvamento_simulado_localizar_es"); },
    get comoFunciona() { return tr("as_equipes_recebem_um_cenario_de"); },
    get paraQuem() { return tr("para_quem_gosta_de_tecnica_resgate"); },
  },
  milsim: {
    imagem: imgMilsim,
    get resumo() { return tr("simulacao_militar_em_grande_escala_dezen"); },
    get comoFunciona() { return tr("o_evento_simula_um_conflito_entre"); },
    get paraQuem() { return tr("para_quem_quer_viver_uma_operacao"); },
  },
  speedsoft: {
    imagem: imgSpeedsoft,
    get resumo() { return tr("rapido_e_competitivo_partidas_curtas_em"); },
    get comoFunciona() { return tr("as_partidas_acontecem_em_arenas_fechadas"); },
    get paraQuem() { return tr("para_quem_prefere_acao_rapida_competicao"); },
  },
  forfun: {
    imagem: imgForfun,
    get resumo() { return tr("o_jogo_pela_diversao_partidas_descontrai"); },
    get comoFunciona() { return tr("sao_encontros_casuais_com_modos_de"); },
    get paraQuem() { return tr("para_iniciantes_grupos_de_amigos_e"); },
  },
};

export const Route = createFileRoute("/modalidades")({
  head: ({ matches }) => {
    const t = tr.em(idiomaDaRaiz(matches));
    return {
      meta: [
        { title: t("modalidades_milsim_ops") },
        { name: "description", content: t("conheca_as_modalidades_de_simulacao_mili") },
        { property: "og:title", content: t("modalidades_milsim_ops") },
        { property: "og:description", content: t("conheca_as_modalidades_de_simulacao_mili_2") },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary" },
      ],
    };
  },
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
          <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-white/70">{tr("guia_do_jogador")}</p>
          <h1 className="mt-2 font-display text-5xl font-bold uppercase leading-none sm:text-6xl">{tr("modalidades")}</h1>
          <p className="mt-4 max-w-xl text-white/80">
            {tr("cada_operacao_pertence_a_uma_modalidade")}</p>
        </div>
      </header>

      <nav aria-label={tr("modalidades")} className="sticky top-14 z-10 border-b lg:top-[68px] border-border bg-background/95 backdrop-blur">
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
                <img src={info.imagem} alt={tr("cena_representativa_da_modalidade_nome", { nome: m.nome })} loading={i === 0 ? "eager" : "lazy"}
                  width={1280} height={720} className="aspect-[4/3] w-full object-cover" />
                <span className="absolute left-4 top-4 font-display text-6xl font-bold leading-none text-white/90 drop-shadow">{String(i + 1).padStart(2, "0")}</span>
              </div>
              <div>
                <p className="rotulo-tecnico">{tr("modalidade_valor_de_valor2", { valor: String(i + 1).padStart(2, "0"), valor2: String(MODALIDADES.length).padStart(2, "0") })}</p>
                <h2 id={`t-modalidade-${m.id}`} className="mt-2 font-display text-4xl font-bold uppercase leading-none">{m.nome}</h2>
                <p className="mt-4 text-lg font-medium leading-snug">{info.resumo}</p>
                <dl className="mt-6 space-y-5 border-l-2 border-accent/60 pl-5 text-sm leading-relaxed">
                  <div>
                    <dt className="rotulo-tecnico">{tr("como_funciona")}</dt>
                    <dd className="mt-1 text-muted-foreground">{info.comoFunciona}</dd>
                  </div>
                  <div>
                    <dt className="rotulo-tecnico">{tr("para_quem_e")}</dt>
                    <dd className="mt-1 text-muted-foreground">{info.paraQuem}</dd>
                  </div>
                </dl>
                <Button asChild variant="outline" className="mt-6">
                  <Link to="/" search={{ mod: m.id }}>{tr("ver_operacoes_de_nome", { nome: m.nome })}</Link>
                </Button>
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
