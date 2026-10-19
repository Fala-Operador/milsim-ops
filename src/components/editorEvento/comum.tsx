import { useEffect, useRef, useState, type ReactNode } from "react";
import { flushSync } from "react-dom";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
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

/** Evento DOM que abre a seção que contém um campo (ex.: ao levar o foco a um erro). */
export const ABRIR_SECAO = "abrir-secao";

export function Secao({ titulo, children, acao, aberta: abertaInicial = true }: { titulo: string; children: ReactNode; acao?: ReactNode; aberta?: boolean }) {
  const [aberta, setAberta] = useState(abertaInicial);
  const raiz = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = raiz.current;
    // Síncrono para que o campo já esteja visível quando receber o foco logo em seguida.
    const abrir = () => flushSync(() => setAberta(true));
    el?.addEventListener(ABRIR_SECAO, abrir);
    return () => el?.removeEventListener(ABRIR_SECAO, abrir);
  }, []);
  return (
    <Collapsible ref={raiz} data-secao open={aberta} onOpenChange={setAberta} className="group rounded-md border border-border bg-elevated">
      <h3 className="font-display text-sm font-semibold uppercase tracking-wide">
        <CollapsibleTrigger className="flex w-full cursor-pointer items-center justify-between gap-2 px-4 py-3 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring">
          {titulo}
          <span aria-hidden className="font-sans text-xs font-normal text-muted-foreground group-data-[state=open]:rotate-180">▾</span>
        </CollapsibleTrigger>
      </h3>
      {/* Sempre montado (oculto quando recolhido) para que os campos existam ao validar e focar. */}
      <CollapsibleContent forceMount className="space-y-3 border-t border-border px-4 py-3">
        {acao && <div className="flex justify-end">{acao}</div>}
        {children}
      </CollapsibleContent>
    </Collapsible>
  );
}

export function Ajuda({ children }: { children: ReactNode }) {
  return <p className="mt-1 text-xs text-muted-foreground">{children}</p>;
}
