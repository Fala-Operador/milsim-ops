import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { paginasCarrossel, paginaMaisProxima } from "@/lib/carrossel";

/** Rolagem nativa: gesto, teclado e links mantêm o comportamento do navegador. */
export function SectionCarousel({ rotulo, cabecalho, children }: { rotulo: string; cabecalho: ReactNode; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const id = useId();
  const [estado, setEstado] = useState({ paginas: [0], atual: 0, inicio: true, fim: true });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const atualizar = () => {
      const origem = el.getBoundingClientRect().left;
      const cards = Array.from(el.children).map((card) => {
        const rect = card.getBoundingClientRect();
        return { left: Math.round(rect.left - origem + el.scrollLeft), width: rect.width };
      });
      const paginas = paginasCarrossel(cards, el.clientWidth, el.scrollWidth);
      setEstado({ paginas, atual: paginaMaisProxima(paginas, el.scrollLeft), inicio: el.scrollLeft <= 1, fim: el.scrollLeft >= el.scrollWidth - el.clientWidth - 1 });
    };
    atualizar();
    const observer = new ResizeObserver(atualizar);
    observer.observe(el);
    Array.from(el.children).forEach((card) => observer.observe(card));
    el.addEventListener("scroll", atualizar, { passive: true });
    return () => { observer.disconnect(); el.removeEventListener("scroll", atualizar); };
  }, [children]);

  const irPara = (indice: number) => {
    const el = ref.current;
    if (!el) return;
    const reduzir = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollTo({ left: estado.paginas[indice] ?? 0, behavior: reduzir ? "auto" : "smooth" });
  };
  const mover = (direcao: number) => {
    const posicao = ref.current?.scrollLeft ?? 0;
    const indice = direcao > 0
      ? estado.paginas.findIndex((alvo) => alvo > posicao + 1)
      : estado.paginas.reduce((ultimo, alvo, i) => alvo < posicao - 1 ? i : ultimo, -1);
    if (indice >= 0) irPara(indice);
  };
  const controles = estado.paginas.length > 1;

  return (
    <div className="w-full min-w-0 max-w-full" role="region" aria-roledescription="carrossel" aria-label={rotulo}>
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1 break-words">{cabecalho}</div>
        {controles && <div className="flex shrink-0 gap-1">
          <Button type="button" variant="outline" className="h-11 w-11 !p-0" disabled={estado.inicio} onClick={() => mover(-1)} aria-controls={id} aria-label={`Anterior em ${rotulo}`} title="Anterior"><ChevronLeft className="h-4 w-4" aria-hidden /></Button>
          <Button type="button" variant="outline" className="h-11 w-11 !p-0" disabled={estado.fim} onClick={() => mover(1)} aria-controls={id} aria-label={`Próximo em ${rotulo}`} title="Próximo"><ChevronRight className="h-4 w-4" aria-hidden /></Button>
        </div>}
      </div>
      <div id={id} ref={ref} tabIndex={0} aria-label={`Cards de ${rotulo}`} className="carousel-viewport flex w-full min-w-0 max-w-full snap-x snap-mandatory gap-4 pb-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
        onKeyDown={(e) => {
          if (e.target !== e.currentTarget) return;
          if (e.key === "ArrowLeft" || e.key === "ArrowRight") { e.preventDefault(); mover(e.key === "ArrowRight" ? 1 : -1); }
          if (e.key === "Home" || e.key === "End") { e.preventDefault(); irPara(e.key === "Home" ? 0 : estado.paginas.length - 1); }
        }}>
        {children}
      </div>
      {controles && <div className="mt-2 flex flex-wrap justify-center" role="group" aria-label={`Páginas de ${rotulo}`}>
        {estado.paginas.map((alvo, indice) => <Button key={alvo} type="button" variant="ghost" className="h-8 w-8 !p-0" aria-label={`Página ${indice + 1} de ${estado.paginas.length} em ${rotulo}`} aria-current={indice === estado.atual ? "true" : undefined} aria-controls={id} onClick={() => irPara(indice)}>
          <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${indice === estado.atual ? "bg-accent" : "bg-muted-foreground/40"}`} />
        </Button>)}
      </div>}
    </div>
  );
}