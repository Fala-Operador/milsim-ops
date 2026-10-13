import type { ReactNode } from "react";
import type { Evento } from "@/lib/domain/types";

export interface PropsEtapa {
  ev: Evento;
  set: <K extends keyof Evento>(k: K, v: Evento[K]) => void;
  erros: Record<string, string>;
}

export function paraLocal(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** Atributos de acessibilidade para um campo com possível erro. */
export const inval = (erros: Record<string, string>, id: string) =>
  erros[id] ? { "aria-invalid": true as const, "aria-describedby": `${id}-erro` } : {};

export function MsgErro({ erros, id }: { erros: Record<string, string>; id: string }) {
  return erros[id] ? <p id={`${id}-erro`} className="mt-1 text-xs text-destructive">{erros[id]}</p> : null;
}

export function Secao({ titulo, children, acao, aberta = true }: { titulo: string; children: ReactNode; acao?: ReactNode; aberta?: boolean }) {
  return (
    <details open={aberta} className="group rounded-md border border-border bg-elevated">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring">
        <h3 className="font-display text-sm font-semibold uppercase tracking-wide">{titulo}</h3>
        <span aria-hidden className="text-xs text-muted-foreground group-open:rotate-180">▾</span>
      </summary>
      <div className="space-y-3 border-t border-border px-4 py-3">
        {acao && <div className="flex justify-end">{acao}</div>}
        {children}
      </div>
    </details>
  );
}

export function Ajuda({ children }: { children: ReactNode }) {
  return <p className="mt-1 text-xs text-muted-foreground">{children}</p>;
}
