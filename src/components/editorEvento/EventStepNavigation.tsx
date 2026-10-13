import { ETAPAS } from "@/lib/eventoEditor";

/** Etapas concluídas, atual e pendentes. Só permite ir até a etapa mais avançada já validada. */
export function EventStepNavigation({ atual, alcancada, irPara }: { atual: number; alcancada: number; irPara: (i: number) => void }) {
  return (
    <nav aria-label="Etapas do formulário">
      {/* Celular: indicador compacto, sem barra horizontal */}
      <div className="md:hidden">
        <p className="text-xs text-muted-foreground">{ETAPAS[atual]?.titulo}</p>
        <div className="mt-1 flex gap-1" aria-hidden>
          {ETAPAS.map((e, i) => <span key={e.id} className={`h-1 flex-1 rounded ${i < atual ? "bg-primary" : i === atual ? "bg-accent" : "bg-muted"}`} />)}
        </div>
      </div>
      <ol className="hidden flex-wrap gap-1 md:flex">
        {ETAPAS.map((e, i) => {
          const estado = i === atual ? "atual" : i < alcancada || i < atual ? "concluida" : "pendente";
          return (
            <li key={e.id}>
              <button
                type="button"
                disabled={i > alcancada}
                aria-current={i === atual ? "step" : undefined}
                onClick={() => irPara(i)}
                className={`flex items-center gap-2 rounded-md px-2.5 py-1.5 text-xs font-medium focus-visible:outline focus-visible:outline-2 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${
                  estado === "atual" ? "bg-primary text-primary-foreground" : estado === "concluida" ? "bg-secondary text-secondary-foreground hover:opacity-90" : "text-muted-foreground"
                }`}
              >
                <span aria-hidden className="grid h-5 w-5 place-items-center rounded-full border border-current font-mono text-[10px]">{estado === "concluida" ? "✓" : i + 1}</span>
                {e.titulo}
                <span className="sr-only">{estado === "concluida" ? " (concluída)" : estado === "pendente" ? " (pendente)" : " (atual)"}</span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
