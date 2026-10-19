// Cartão "Operação selecionada" + seletor de eventos, compartilhado por
// Inscritos, Comunidade e Financeiro. Desktop: janela central. Celular: bottom sheet.
import { useEffect, useRef, useState } from "react";
import { AlertTriangle, ArrowLeftRight, CalendarDays, Check, ChevronDown, MapPin, Search, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { NativeSelect } from "@/components/ui/native-select";
import { formatarDataBR } from "@/lib/domain/money";
import type { Evento } from "@/lib/domain/types";
import { Input } from "@/components/ui/input";

export const ROTULO_STATUS_EVENTO: Record<string, string> = {
  rascunho: "Rascunho", publicado: "Publicado", inscricoes_encerradas: "Inscrições encerradas",
  cancelado: "Cancelado", concluido: "Concluído",
};
const tomStatusEvento = (s: string) =>
  s === "publicado" ? "success" : s === "cancelado" ? "destructive" : s === "rascunho" ? "secondary" : "warning";

export function Miniatura({ evento, tamanho = "h-16 w-16" }: { evento: Evento; tamanho?: string }) {
  return evento.imagemUrl ? (
    <img src={evento.imagemUrl} alt="" className={`${tamanho} shrink-0 rounded-md object-cover`} />
  ) : (
    <div className={`${tamanho} topo-bg grid shrink-0 place-items-center rounded-md bg-secondary font-display text-lg font-bold uppercase text-secondary-foreground`}>
      {evento.nome.slice(0, 2) || "?"}
    </div>
  );
}

export function OperacaoSelecionada({ eventos, evento, invalido, onSelecionar }: {
  eventos: Evento[]; evento: Evento | undefined; invalido?: boolean; onSelecionar: (id: string) => void;
}) {
  const [aberto, setAberto] = useState(false);
  const botao = useRef<HTMLButtonElement>(null);
  // Depois que a janela (Radix) desmonta, devolve o foco ao botão que a abriu.
  const fechar = () => { setAberto(false); requestAnimationFrame(() => botao.current?.focus()); };
  const escolher = (id: string) => { fechar(); if (id !== evento?.id) onSelecionar(id); };

  if (eventos.length === 0) return null;
  return (
    <>
      {evento ? (
        <section
          aria-label="Operação selecionada"
          className="topo-bg relative grid grid-cols-[auto_minmax(0,1fr)] items-center gap-4 overflow-hidden rounded-lg border border-border border-l-4 border-l-primary bg-elevated p-4 shadow-sm sm:grid-cols-[auto_minmax(0,1fr)_auto]"
        >
          <Miniatura evento={evento} />
          <div className="min-w-0">
            <p className="font-display text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Operação selecionada</p>
            <p className="truncate font-display text-xl font-bold uppercase" title={evento.nome}>{evento.nome || "Sem nome"}</p>
            <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1"><CalendarDays className="h-4 w-4 shrink-0" />{formatarDataBR(evento.inicioEm)}</span>
              <span className="inline-flex min-w-0 items-center gap-1"><MapPin className="h-4 w-4 shrink-0" /><span className="truncate">{evento.cidade}/{evento.uf}</span></span>
              <Badge variant={tomStatusEvento(evento.status)}>{ROTULO_STATUS_EVENTO[evento.status] ?? evento.status}</Badge>
            </p>
          </div>
          <Button
            ref={botao}
            variant="outline"
            className="col-span-2 w-full border-primary sm:col-span-1 sm:w-auto"
            aria-haspopup="dialog"
            aria-expanded={aberto}
            onClick={() => setAberto(true)}
          >
            <ArrowLeftRight className="h-4 w-4" /> Trocar evento <ChevronDown className="h-4 w-4" />
          </Button>
        </section>
      ) : (
        <section role="alert" className="flex flex-col gap-3 rounded-lg border border-warning/60 bg-warning/10 p-4 sm:flex-row sm:items-center">
          <AlertTriangle className="h-5 w-5 shrink-0 text-warning" />
          <div className="min-w-0 flex-1">
            <p className="font-medium">{invalido ? "O evento selecionado não está mais disponível" : "Nenhum evento selecionado"}</p>
            <p className="text-sm text-muted-foreground">Escolha uma operação para continuar.</p>
          </div>
          <Button ref={botao} onClick={() => setAberto(true)}>Selecionar evento</Button>
        </section>
      )}
      {aberto && <SeletorEventos eventos={eventos} atual={evento?.id ?? ""} onFechar={fechar} onSelecionar={escolher} />}
    </>
  );
}

function SeletorEventos({ eventos, atual, onFechar, onSelecionar }: {
  eventos: Evento[]; atual: string; onFechar: () => void; onSelecionar: (id: string) => void;
}) {
  const [busca, setBusca] = useState("");
  const [status, setStatus] = useState("");
  const lista = eventos.filter(
    (e) => (!status || e.status === status) && e.nome.toLowerCase().includes(busca.trim().toLowerCase()),
  );
  return (
    <Dialog open onOpenChange={(aberto) => !aberto && onFechar()}>
      <DialogContent
        showCloseButton={false}
        aria-describedby={undefined}
        className="bottom-0 top-auto flex max-h-[85dvh] w-full max-w-none translate-y-0 flex-col gap-0 rounded-t-2xl p-0 pb-[env(safe-area-inset-bottom)] sm:bottom-auto sm:top-[50%] sm:max-h-[85vh] sm:w-[calc(100%-2rem)] sm:max-w-2xl sm:translate-y-[-50%] sm:rounded-lg sm:pb-0"
      >
        <div className="mx-auto mt-2 h-1.5 w-10 rounded-full bg-border sm:hidden" aria-hidden="true" />
        <div className="flex items-center justify-between gap-2 px-4 pt-3 sm:px-6 sm:pt-5">
          <DialogTitle className="uppercase">Trocar evento</DialogTitle>
          <Button variant="ghost" onClick={onFechar} aria-label="Fechar"><X className="h-5 w-5" /></Button>
        </div>
        <div className="grid gap-2 border-b border-border px-4 py-3 sm:grid-cols-[1fr_12rem] sm:px-6">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              autoFocus
              aria-label="Buscar evento por nome"
              placeholder="Buscar por nome"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="w-full rounded-md border border-input bg-background py-2 pl-9 pr-3 text-base focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/40 sm:text-sm"
            />
          </div>
          <NativeSelect aria-label="Filtrar por status" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">Todos os status</option>
            {Object.entries(ROTULO_STATUS_EVENTO).map(([v, r]) => <option key={v} value={v}>{r}</option>)}
          </NativeSelect>
        </div>
        <ul className="min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain px-4 py-3 sm:px-6" role="listbox" aria-label="Eventos autorizados">
          {lista.map((e) => {
            const sel = e.id === atual;
            return (
              <li key={e.id}>
                <Button variant="plain" size="none"
                  role="option"
                  aria-selected={sel}
                  onClick={() => onSelecionar(e.id)}
                  className={`flex w-full items-center gap-3 rounded-md border p-3 text-left transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${sel ? "border-primary bg-secondary ring-1 ring-primary" : "border-border"}`}
                >
                  <Miniatura evento={e} tamanho="h-12 w-12" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{e.nome || "Sem nome"}</span>
                    <span className="block truncate text-xs text-muted-foreground">{formatarDataBR(e.inicioEm)} · {e.cidade}/{e.uf} · {ROTULO_STATUS_EVENTO[e.status] ?? e.status}</span>
                  </span>
                  {sel && <span className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-primary"><Check className="h-4 w-4" />Atual</span>}
                </Button>
              </li>
            );
          })}
          {lista.length === 0 && <li className="py-6 text-center text-sm text-muted-foreground">Nenhum evento encontrado. Tente outro nome ou status.</li>}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
