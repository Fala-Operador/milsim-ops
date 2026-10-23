import { ETAPAS } from "@/lib/eventoEditor";
import { Button } from "@/components/ui/button";

/**
 * Etapas concluídas, atual e pendentes. Só permite ir até a etapa mais avançada já validada.
 * Etapas com pendência ficam em vermelho, com "!" no lugar do número.
 */
export function EventStepNavigation({
  atual,
  alcancada,
  comErro = new Set<number>(),
  irPara,
}: {
  atual: number;
  alcancada: number;
  comErro?: ReadonlySet<number>;
  irPara: (i: number) => void;
}) {
  const pendentes = ETAPAS.map((e, i) => ({ e, i })).filter(({ i }) => comErro.has(i));
  return (
    <nav aria-label="Etapas do formulário">
      {/* Celular: indicador compacto, sem barra horizontal */}
      <div className="md:hidden">
        <p className="text-xs text-muted-foreground">{ETAPAS[atual]?.titulo}</p>
        <div className="mt-1 flex gap-1" aria-hidden>
          {ETAPAS.map((e, i) => (
            <span key={e.id} className={`h-1 flex-1 rounded ${comErro.has(i) ? "bg-destructive" : i < atual ? "bg-primary" : i === atual ? "bg-accent" : "bg-muted"}`} />
          ))}
        </div>
        {pendentes.length > 0 && (
          <p className="mt-1.5 flex flex-wrap gap-x-2 gap-y-1 text-xs text-destructive">
            <span>Pendências em:</span>
            {pendentes.map(({ e, i }) => (
              <Button key={e.id} variant="plain" size="none" type="button" disabled={i > alcancada} onClick={() => irPara(i)} className="underline underline-offset-2">
                {i + 1}. {e.titulo}
              </Button>
            ))}
          </p>
        )}
      </div>
      <ol className="hidden flex-wrap gap-1 md:flex">
        {ETAPAS.map((e, i) => {
          const estado = i === atual ? "atual" : i < alcancada || i < atual ? "concluida" : "pendente";
          const erro = comErro.has(i);
          return (
            <li key={e.id}>
              <Button variant="plain" size="none"
                type="button"
                disabled={i > alcancada}
                aria-current={i === atual ? "step" : undefined}
                onClick={() => irPara(i)}
                className={`flex items-center gap-2 rounded-md px-2.5 py-1.5 text-xs font-medium focus-visible:outline focus-visible:outline-2 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${
                  erro
                    ? estado === "atual" ? "bg-destructive text-destructive-foreground" : "bg-destructive/10 text-destructive ring-1 ring-destructive/50 hover:bg-destructive/15"
                    : estado === "atual" ? "bg-primary text-primary-foreground" : estado === "concluida" ? "bg-secondary text-secondary-foreground hover:opacity-90" : "text-muted-foreground"
                }`}
              >
                <span aria-hidden className="grid h-5 w-5 place-items-center rounded-full border border-current font-mono text-[10px]">{erro ? "!" : estado === "concluida" ? "✓" : i + 1}</span>
                {e.titulo}
                <span className="sr-only">{erro ? " (com pendências)" : estado === "concluida" ? " (concluída)" : estado === "pendente" ? " (pendente)" : " (atual)"}</span>
              </Button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
