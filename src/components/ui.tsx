// Composições do app sobre os componentes shadcn/ui de `src/components/ui/`.
import { type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";

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
      <Label htmlFor={htmlFor} className="block">
        {rotulo}
      </Label>
      {children}
      {erro && (
        <p role="alert" className="text-sm text-destructive">
          {erro}
        </p>
      )}
    </div>
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
  // No celular abre como folha a partir da base; a partir de sm, centralizado.
  return (
    <Dialog open={aberto} onOpenChange={(aberto) => !aberto && onFechar()}>
      <DialogContent
        showCloseButton={false}
        aria-describedby={undefined}
        className={`bottom-0 top-auto block max-h-[92dvh] w-full translate-y-0 overflow-y-auto rounded-t-xl p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:bottom-auto sm:top-[50%] sm:max-h-[90vh] sm:w-[calc(100%-2rem)] sm:translate-y-[-50%] sm:rounded-lg sm:p-6 ${largo ? "max-w-6xl" : "max-w-2xl"}`}
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <DialogTitle className="min-w-0">{titulo}</DialogTitle>
          <Button variant="ghost" className="shrink-0" onClick={onFechar} aria-label="Fechar">
            ✕
          </Button>
        </div>
        {children}
      </DialogContent>
    </Dialog>
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
          <Button onClick={onTentar}>
            Tentar novamente
          </Button>
        )}
        <Button variant="outline" asChild>
          <a href="/">Voltar ao início</a>
        </Button>
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
