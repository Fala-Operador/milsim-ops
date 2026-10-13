// Componentes de interface reutilizáveis, todos via tokens semânticos.
import { type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";

type VarianteBotao = "primario" | "secundario" | "contorno" | "perigo" | "fantasma";

export function Botao({
  variante = "primario",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variante?: VarianteBotao; ref?: React.Ref<HTMLButtonElement> }) {
  const estilos: Record<VarianteBotao, string> = {
    primario: "bg-primary text-primary-foreground hover:opacity-90",
    secundario: "bg-secondary text-secondary-foreground hover:opacity-90",
    contorno: "border border-border bg-transparent text-foreground hover:bg-secondary",
    perigo: "bg-destructive text-destructive-foreground hover:opacity-90",
    fantasma: "bg-transparent text-foreground hover:bg-secondary",
  };
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-opacity disabled:cursor-not-allowed disabled:opacity-50 ${estilos[variante]} ${className}`}
      {...props}
    />
  );
}

export function Cartao({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-lg border border-border bg-card p-5 text-card-foreground shadow-sm ${className}`}>
      {children}
    </div>
  );
}

type TomBadge = "padrao" | "sucesso" | "aviso" | "perigo" | "destaque";

export function Badge({ tom = "padrao", children, "aria-label": ariaLabel }: { tom?: TomBadge; children: ReactNode; "aria-label"?: string }) {
  const tons: Record<TomBadge, string> = {
    padrao: "bg-secondary text-secondary-foreground",
    sucesso: "bg-success text-success-foreground",
    aviso: "bg-warning text-warning-foreground",
    perigo: "bg-destructive text-destructive-foreground",
    destaque: "bg-accent text-accent-foreground",
  };
  return (
    <span aria-label={ariaLabel} className={`status-badge inline-flex w-max max-w-full shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-2 py-1 text-xs font-medium leading-4 [&_svg]:size-3 [&_svg]:shrink-0 ${tons[tom]}`}>
      {children}
    </span>
  );
}

export function Campo({
  rotulo,
  erro,
  children,
  htmlFor,
}: {
  rotulo: string;
  erro?: string | undefined;
  children: ReactNode;
  htmlFor?: string;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block text-sm font-medium text-foreground">
        {rotulo}
      </label>
      {children}
      {erro && (
        <p role="alert" className="text-sm text-destructive">
          {erro}
        </p>
      )}
    </div>
  );
}

export function Entrada(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none"
      {...props}
    />
  );
}

export function AreaTexto(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none"
      rows={4}
      {...props}
    />
  );
}

export function Selecao(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:border-ring focus:outline-none"
      {...props}
    />
  );
}

export function EstadoVazio({ titulo, descricao }: { titulo: string; descricao?: string }) {
  return (
    <div className="rounded-lg border border-dashed border-border p-8 text-center">
      <p className="font-medium text-foreground">{titulo}</p>
      {descricao && <p className="mt-1 text-sm text-muted-foreground">{descricao}</p>}
    </div>
  );
}

export function Modal({
  aberto,
  titulo,
  onFechar,
  children,
  largo = false,
}: {
  aberto: boolean;
  titulo: string;
  onFechar: () => void;
  children: ReactNode;
  largo?: boolean;
}) {
  if (!aberto) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={titulo}
      onClick={onFechar}
    >
      <div
        className={`max-h-[90vh] w-full ${largo ? "max-w-6xl" : "max-w-2xl"} overflow-y-auto rounded-lg border border-border bg-popover p-6 text-popover-foreground shadow-xl`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold">{titulo}</h2>
          <Botao variante="fantasma" onClick={onFechar} aria-label="Fechar">
            ✕
          </Botao>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={`animate-pulse rounded-md bg-secondary ${className}`}
    />
  );
}

export function SkeletonCartao() {
  return (
    <div className="rounded-lg border border-border bg-card p-5" role="status" aria-label="Carregando conteúdo">
      <Skeleton className="h-32 w-full" />
      <Skeleton className="mt-4 h-5 w-3/4" />
      <Skeleton className="mt-2 h-4 w-1/2" />
      <Skeleton className="mt-2 h-4 w-2/3" />
    </div>
  );
}

export function SkeletonGrade({ quantidade = 6 }: { quantidade?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: quantidade }, (_, i) => (
        <SkeletonCartao key={i} />
      ))}
    </div>
  );
}

export function SkeletonPagina() {
  return (
    <div className="mx-auto max-w-4xl space-y-4 px-4 py-8" role="status" aria-label="Carregando página">
      <Skeleton className="h-40 w-full" />
      <Skeleton className="h-8 w-1/2" />
      <Skeleton className="h-4 w-2/3" />
      <Skeleton className="h-4 w-1/3" />
      <div className="grid gap-4 sm:grid-cols-2">
        <SkeletonCartao />
        <SkeletonCartao />
      </div>
    </div>
  );
}

// Limite de erro de uma seção: mostra recuperação em vez de tela em branco.
export function ErroSecao({
  titulo = "Esta seção não carregou",
  descricao = "Algo deu errado ao exibir este conteúdo. Tente novamente ou volte ao início.",
  onTentar,
}: {
  titulo?: string;
  descricao?: string;
  onTentar?: () => void;
}) {
  return (
    <div role="alert" className="rounded-lg border border-border bg-card p-8 text-center">
      <h2 className="font-display text-lg font-semibold text-foreground">{titulo}</h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">{descricao}</p>
      <div className="mt-5 flex flex-wrap justify-center gap-2">
        {onTentar && (
          <Botao variante="primario" onClick={onTentar}>
            Tentar novamente
          </Botao>
        )}
        <a
          href="/"
          className="inline-flex items-center justify-center rounded-md border border-border bg-transparent px-4 py-2 text-sm font-medium text-foreground hover:bg-secondary"
        >
          Voltar ao início
        </a>
      </div>
    </div>
  );
}

export function Spinner({ texto = "Carregando..." }: { texto?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 p-8 text-muted-foreground" role="status">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-border border-t-primary" />
      <span className="text-sm">{texto}</span>
    </div>
  );
}
