// Protótipo do redesign: moldura das telas de acesso (entrar, cadastro, recuperar senha).
// Esquerda: operação impulsionada em destaque (ou foto, sem impulso). No celular, as impulsionadas ficam acima do formulário.
import { Link } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { carregarBase } from "@/services/db";
import { useVersaoBase } from "@/hooks/useVersaoBase";
import { useLocalizacao } from "@/contexts/LocalizacaoContext";
import { montarPaginaInicial, type CartaoEventoResolvido } from "@/lib/divulgacao";
import { idDoVisitante } from "@/services/analytics";
import { ImagemSegura } from "@/components/divulgacao";
import { Button } from "@/components/ui/button";
import imgRealAction from "@/assets/modalidade-real-action.jpg";

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

function useImpulsionadas(limite: number): CartaoEventoResolvido[] | null {
  const versao = useVersaoBase();
  const { local } = useLocalizacao();
  const [cartoes, setCartoes] = useState<CartaoEventoResolvido[] | null>(null);
  useEffect(() => {
    try {
      const vistos = new Set<string>();
      const lista = montarPaginaInicial(carregarBase(), local, new Date(), { semente: idDoVisitante() })
        .filter((s) => s.secao.tipo === "destaques")
        .flatMap((s) => s.eventos)
        .filter((c) => !vistos.has(c.evento.id) && !!vistos.add(c.evento.id));
      setCartoes(lista.slice(0, limite));
    } catch {
      setCartoes([]);
    }
  }, [versao, local, limite]);
  return cartoes;
}

function OperacoesEmDestaque({ cartoes }: { cartoes: CartaoEventoResolvido[] | null }) {
  if (cartoes && cartoes.length === 0) return null;
  return (
    <section aria-labelledby="t-destaque-acesso" className="mb-8 lg:hidden">
      <div className="mb-2 flex items-baseline justify-between">
        <h2 id="t-destaque-acesso" className="rotulo-tecnico">Em destaque agora</h2>
        <Link to="/" className="text-xs text-muted-foreground hover:text-foreground">Ver todas</Link>
      </div>
      <ul className="carousel-viewport -mx-4 flex snap-x gap-2 px-4 sm:mx-0 sm:grid sm:grid-cols-3 sm:px-0">
        {(cartoes ?? [null, null, null]).map((c, i) => {
          if (!c) return <li key={i} className="skeleton-brilho aspect-[4/3] w-44 shrink-0 rounded-md sm:w-auto" />;
          const d = new Date(c.evento.inicioEm);
          return (
            <li key={c.evento.id} className="w-44 shrink-0 snap-start sm:w-auto">
              <Link to="/eventos/$eventoId" params={{ eventoId: c.evento.id }}
                className="group relative block aspect-[4/3] overflow-hidden rounded-md border border-border/70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring">
                <ImagemSegura src={c.imagem} alt="" className="absolute inset-0 h-full w-full transition-transform duration-500 group-hover:scale-105" />
                <span className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent" aria-hidden />
                <span className="absolute inset-x-0 bottom-0 p-2.5 text-white">
                  <span className="block font-mono text-[10px] uppercase tracking-wider text-white/75">
                    {String(d.getDate()).padStart(2, "0")} {MESES[d.getMonth()]} · {c.evento.cidade}/{c.evento.uf}
                  </span>
                  <span className="mt-0.5 line-clamp-2 block text-[13px] font-semibold leading-tight">{c.evento.nome}</span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** Painel da esquerda: operação impulsionada em destaque; sem impulso, a foto com a frase. */
function PainelLateral({ cartoes, imagem, frase, rotulo }: {
  cartoes: CartaoEventoResolvido[] | null; imagem: string; frase: string; rotulo: string;
}) {
  const [atual, setAtual] = useState(0);
  const total = cartoes?.length ?? 0;
  useEffect(() => {
    if (total < 2) return;
    const t = setInterval(() => setAtual((i) => (i + 1) % total), 7000);
    return () => clearInterval(t);
  }, [total]);
  const c = total > 0 ? cartoes![atual % total] : null;
  const d = c ? new Date(c.evento.inicioEm) : null;
  return (
    <div className="relative hidden overflow-hidden rounded-lg border border-border bg-black lg:sticky lg:top-24 lg:block lg:h-[min(640px,calc(100dvh-8rem))]">
      {c ? <ImagemSegura key={c.evento.id} src={c.imagem} alt="" className="absolute inset-0 h-full w-full" />
         : <img src={imagem} alt="" className="absolute inset-0 h-full w-full object-cover" />}
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/35 to-transparent" />
      {c && d ? (
        <div className="absolute inset-x-0 bottom-0 p-8 text-white">
          <p className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.12em] text-white/80">
            <span className="h-1.5 w-1.5 rounded-full bg-accent" aria-hidden />Operação em destaque
          </p>
          <p className="mt-2 max-w-md font-display text-5xl font-bold uppercase leading-[0.95]">{c.evento.nome}</p>
          <p className="mt-3 font-mono text-xs uppercase tracking-wider text-white/80">
            {String(d.getDate()).padStart(2, "0")} {MESES[d.getMonth()]} {d.getFullYear()} · {c.evento.cidade}/{c.evento.uf}
          </p>
          {c.chamada && <p className="mt-2 max-w-sm text-sm text-white/80">{c.chamada}</p>}
          <div className="mt-5 flex items-center justify-between gap-4">
            <Link to="/eventos/$eventoId" params={{ eventoId: c.evento.id }}
              className="inline-flex items-center rounded-md border border-white/40 bg-black/30 px-4 py-2 text-sm font-semibold hover:bg-black/50">Ver operação</Link>
            {total > 1 && (
              <div className="flex gap-1.5" role="tablist" aria-label="Operações em destaque">
                {cartoes!.map((x, i) => (
                  <Button key={x.evento.id} variant="plain" size="none" role="tab" aria-selected={i === atual % total} aria-label={x.evento.nome}
                    onClick={() => setAtual(i)} className={`h-1 rounded-full transition-all ${i === atual % total ? "w-8 bg-white" : "w-4 bg-white/40 hover:bg-white/70"}`} />
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="absolute inset-x-0 bottom-0 p-8 text-white">
          <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-white/70">{rotulo}</p>
          <p className="mt-2 max-w-sm font-display text-4xl font-bold uppercase leading-none">{frase}</p>
        </div>
      )}
    </div>
  );
}

export function LayoutAcesso({ titulo, subtitulo, imagem = imgRealAction, frase, rotulo, largo = false, children }: {
  titulo: string;
  subtitulo?: ReactNode;
  imagem?: string;
  frase: string;
  rotulo: string;
  /** Formulário mais largo (cadastro em etapas). */
  largo?: boolean;
  children: ReactNode;
}) {
  const cartoes = useImpulsionadas(3);
  return (
    <div className={`mx-auto grid max-w-6xl gap-10 px-4 py-8 lg:py-12 ${largo ? "lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]" : "lg:grid-cols-2"}`}>
      <PainelLateral cartoes={cartoes} imagem={imagem} frase={frase} rotulo={rotulo} />
      <div className={`mx-auto w-full min-w-0 ${largo ? "max-w-xl" : "max-w-md lg:self-center"}`}>
        <OperacoesEmDestaque cartoes={cartoes} />
        <h1 className="font-display text-4xl font-bold uppercase">{titulo}</h1>
        {subtitulo && <p className="mt-1 text-sm text-muted-foreground">{subtitulo}</p>}
        {children}
      </div>
    </div>
  );
}
