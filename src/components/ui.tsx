// Composições do app sobre os componentes shadcn/ui de `src/components/ui/`.
import { useEffect, useId, useState, type ReactNode } from "react";

import { AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";

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
    <div className="surgir rounded-lg border border-dashed border-border p-8 text-center">
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

/**
 * Modal com um texto obrigatório (resposta, justificativa) no lugar do `prompt()` do navegador.
 * Mostra o erro da ação sem fechar; fecha só quando `onConfirmar` termina sem erro.
 */
export function ModalTexto({
  aberto,
  titulo,
  rotulo,
  descricao,
  confirmar,
  destrutivo = false,
  maximo,
  onFechar,
  onConfirmar,
}: {
  aberto: boolean;
  titulo: string;
  rotulo: string;
  descricao?: string | undefined;
  confirmar: string;
  destrutivo?: boolean;
  maximo?: number | undefined;
  onFechar: () => void;
  onConfirmar: (texto: string) => Promise<unknown>;
}) {
  const id = useId();
  const [texto, setTexto] = useState("");
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);
  useEffect(() => {
    if (aberto) {
      setTexto("");
      setErro("");
    }
  }, [aberto]);

  const enviar = async () => {
    if (!texto.trim()) return setErro("Preencha este campo.");
    setEnviando(true);
    setErro("");
    try {
      await onConfirmar(texto.trim());
      onFechar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível concluir. Tente novamente.");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Modal aberto={aberto} titulo={titulo} onFechar={onFechar}>
      {descricao && <p className="mb-3 text-sm text-muted-foreground">{descricao}</p>}
      <Campo rotulo={rotulo} erro={erro} htmlFor={id}>
        <Textarea id={id} rows={4} maxLength={maximo} value={texto} onChange={(e) => setTexto(e.target.value)} autoFocus />
      </Campo>
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="ghost" onClick={onFechar} disabled={enviando}>Cancelar</Button>
        <Button variant={destrutivo ? "destructive" : "default"} onClick={enviar} disabled={enviando}>
          {enviando ? "Enviando..." : confirmar}
        </Button>
      </div>
    </Modal>
  );
}

/**
 * Confirmação ou aviso no padrão do app, no lugar de `window.confirm`/`alert`. Sem
 * `cancelar`, vira um aviso com um único botão. Use pelo `useConfirmacao()`.
 */
export function DialogoConfirmacao({
  aberto,
  titulo,
  descricao,
  confirmar,
  cancelar,
  destrutivo = false,
  onResponder,
}: {
  aberto: boolean;
  titulo: string;
  descricao?: ReactNode;
  confirmar: string;
  cancelar?: string | undefined;
  destrutivo?: boolean;
  onResponder: (sim: boolean) => void;
}) {
  return (
    <AlertDialog open={aberto} onOpenChange={(a) => !a && onResponder(false)}>
      <AlertDialogContent className="block w-[calc(100%-2rem)] max-w-md rounded-lg bg-card p-5 text-card-foreground">
        <AlertDialogTitle className="text-base uppercase">{titulo}</AlertDialogTitle>
        {descricao ? (
          <AlertDialogDescription className="mt-1 break-words">{descricao}</AlertDialogDescription>
        ) : (
          <AlertDialogDescription className="sr-only">{titulo}</AlertDialogDescription>
        )}
        <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          {cancelar && <Button type="button" variant="outline" onClick={() => onResponder(false)}>{cancelar}</Button>}
          <Button type="button" variant={destrutivo ? "destructive" : "default"} autoFocus={!destrutivo} onClick={() => onResponder(true)}>
            {confirmar}
          </Button>
        </div>
      </AlertDialogContent>
    </AlertDialog>
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

/** Lista/tabela carregando: linhas com avatar ou posição, texto e valor à direita. */
export function SkeletonLista({ linhas = 5, rotulo = "Carregando lista" }: { linhas?: number; rotulo?: string }) {
  return (
    <div className="divide-y divide-border rounded-md border border-border" role="status" aria-label={rotulo}>
      {Array.from({ length: linhas }, (_, i) => (
        <div key={i} className="flex items-center gap-3 px-3 py-2.5">
          <Skeleton className="h-7 w-7 shrink-0 rounded-full" />
          <Skeleton className="h-4 flex-1" style={{ maxWidth: `${70 - (i % 3) * 15}%` }} />
          <Skeleton className="ml-auto h-4 w-12 shrink-0" />
        </div>
      ))}
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
    <div role="alert" className="surgir rounded-lg border border-border bg-card p-8 text-center">
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
