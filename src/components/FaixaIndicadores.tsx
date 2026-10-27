// Protótipo do redesign: indicadores numa faixa única com divisórias (substitui a grade de cartões).
export function FaixaIndicadores({ itens, className = "" }: { itens: { rotulo: string; valor: string; detalhe?: string | undefined }[]; className?: string }) {
  return (
    <dl className={`grid grid-cols-2 divide-border overflow-hidden rounded-lg border border-border lg:grid-cols-${itens.length} lg:divide-x ${className}`}>
      {itens.map((i) => (
        <div key={i.rotulo} className="border-b border-border p-4 last:border-b-0 lg:border-b-0">
          <dt className="rotulo-tecnico">{i.rotulo}</dt>
          <dd className="mt-1.5 font-display text-3xl font-bold leading-none">{i.valor}</dd>
          {i.detalhe && <dd className="mt-1.5 text-xs text-muted-foreground">{i.detalhe}</dd>}
        </div>
      ))}
    </dl>
  );
}
