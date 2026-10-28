// Moldura dos documentos legais (termos, privacidade): índice fixo à esquerda e cláusulas numeradas.
import type { ReactNode } from "react";

export interface Clausula { id: string; titulo: string; texto: ReactNode }

export function DocumentoLegal({ rotulo, titulo, subtitulo, clausulas }: { rotulo: string; titulo: string; subtitulo: string; clausulas: Clausula[] }) {
  return (
    <div className="mx-auto max-w-5xl px-4 py-10 lg:py-14">
      <header className="border-b border-border pb-6">
        <p className="rotulo-tecnico">{rotulo}</p>
        <h1 className="titulo-pagina mt-2">{titulo}</h1>
        <p className="subtitulo-pagina">{subtitulo}</p>
      </header>
      <div className="mt-8 grid gap-10 lg:grid-cols-[220px_minmax(0,1fr)]">
        <nav aria-label="Cláusulas" className="lg:sticky lg:top-24 lg:self-start">
          <p className="rotulo-tecnico mb-2">Neste documento</p>
          <ol className="space-y-1 text-sm">
            {clausulas.map((c, i) => (
              <li key={c.id}>
                <a href={`#${c.id}`} className="flex gap-2 rounded-md px-2 py-1 text-muted-foreground hover:bg-secondary hover:text-foreground">
                  <span className="font-mono text-xs leading-5 text-accent">{String(i + 1).padStart(2, "0")}</span>{c.titulo}
                </a>
              </li>
            ))}
          </ol>
        </nav>
        <article className="max-w-[65ch] divide-y divide-border">
          {clausulas.map((c, i) => (
            <section key={c.id} id={c.id} aria-labelledby={`t-${c.id}`} className="scroll-mt-24 py-6 first:pt-0">
              <h2 id={`t-${c.id}`} className="flex items-baseline gap-3 text-lg font-semibold">
                <span className="font-display text-2xl font-bold text-accent">{String(i + 1).padStart(2, "0")}</span>{c.titulo}
              </h2>
              <div className="mt-2 space-y-2 leading-relaxed text-foreground/90 [&_a]:text-accent [&_a]:underline [&_a]:underline-offset-2 [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5">{c.texto}</div>
            </section>
          ))}
        </article>
      </div>
    </div>
  );
}
