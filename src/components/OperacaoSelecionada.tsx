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
import { tr } from "@/i18n/components/OperacaoSelecionada";

export const ROTULO_STATUS_EVENTO: Record<string, string> = {
  get rascunho() { return tr("rascunho"); }, get publicado() { return tr("publicado"); }, get inscricoes_encerradas() { return tr("inscricoes_encerradas"); },
  get cancelado() { return tr("cancelado"); }, get concluido() { return tr("concluido"); }, get arquivado() { return tr("arquivado"); },
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
        <section aria-label={tr("operacao_selecionada")} className="relative isolate overflow-hidden rounded-lg border border-border bg-black text-white">
          {evento.imagemUrl && <img src={evento.imagemUrl} alt="" className="absolute inset-0 -z-10 h-full w-full object-cover opacity-70" />}
          <div className="absolute inset-0 -z-10 bg-gradient-to-r from-black/90 via-black/60 to-black/20" aria-hidden="true" />
          <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-end sm:justify-between sm:p-6">
            <div className="min-w-0">
              <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-white/70">{tr("operacao_selecionada")}</p>
              <p className="mt-1 truncate font-display text-3xl font-bold uppercase leading-none sm:text-4xl" title={evento.nome}>{evento.nome || tr("sem_nome")}</p>
              <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-xs uppercase tracking-wider text-white/80">
                <span className="inline-flex items-center gap-1.5"><CalendarDays className="h-3.5 w-3.5 shrink-0" />{formatarDataBR(evento.inicioEm)}</span>
                <span className="inline-flex min-w-0 items-center gap-1.5"><MapPin className="h-3.5 w-3.5 shrink-0" /><span className="truncate">{evento.cidade}/{evento.uf}</span></span>
                <span className="inline-flex items-center gap-1.5"><span className={`h-1.5 w-1.5 rounded-full ${evento.status === "publicado" ? "bg-success" : evento.status === "cancelado" ? "bg-destructive" : "bg-warning"}`} />{ROTULO_STATUS_EVENTO[evento.status] ?? evento.status}</span>
              </p>
            </div>
            <Button
              ref={botao}
              variant="outline"
              className="w-full shrink-0 border-white/40 bg-black/30 text-white backdrop-blur hover:border-white hover:bg-black/50 sm:w-auto"
              aria-haspopup="dialog"
              aria-expanded={aberto}
              onClick={() => setAberto(true)}
            >
              <ArrowLeftRight className="h-4 w-4" />{" "}{tr("trocar_evento")}</Button>
          </div>
        </section>
      ) : (
        <section role="alert" className="flex flex-col gap-3 rounded-lg border border-warning/60 bg-warning/10 p-4 sm:flex-row sm:items-center">
          <AlertTriangle className="h-5 w-5 shrink-0 text-warning" />
          <div className="min-w-0 flex-1">
            <p className="font-medium">{invalido ? tr("o_evento_selecionado_nao_esta_mais") : tr("nenhum_evento_selecionado")}</p>
            <p className="text-sm text-muted-foreground">{tr("escolha_uma_operacao_para_continuar")}</p>
          </div>
          <Button ref={botao} onClick={() => setAberto(true)}>{tr("selecionar_evento")}</Button>
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
          <DialogTitle className="uppercase">{tr("trocar_evento")}</DialogTitle>
          <Button variant="ghost" onClick={onFechar} aria-label={tr("fechar")}><X className="h-5 w-5" /></Button>
        </div>
        <div className="grid gap-2 border-b border-border px-4 py-3 sm:grid-cols-[1fr_12rem] sm:px-6">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              autoFocus
              aria-label={tr("buscar_evento_por_nome")}
              placeholder={tr("buscar_por_nome")}
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="w-full rounded-md border border-input bg-background py-2 pl-9 pr-3 text-base focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/40 sm:text-sm"
            />
          </div>
          <NativeSelect aria-label={tr("filtrar_por_status")} value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">{tr("todos_os_status")}</option>
            {Object.entries(ROTULO_STATUS_EVENTO).map(([v, r]) => <option key={v} value={v}>{r}</option>)}
          </NativeSelect>
        </div>
        <ul className="min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain px-4 py-3 sm:px-6" role="listbox" aria-label={tr("eventos_autorizados")}>
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
                    <span className="block truncate font-medium">{e.nome || tr("sem_nome")}</span>
                    <span className="block truncate text-xs text-muted-foreground">{formatarDataBR(e.inicioEm)} · {e.cidade}/{e.uf} · {ROTULO_STATUS_EVENTO[e.status] ?? e.status}</span>
                  </span>
                  {sel && <span className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-primary"><Check className="h-4 w-4" />{tr("atual")}</span>}
                </Button>
              </li>
            );
          })}
          {lista.length === 0 && <li className="py-6 text-center text-sm text-muted-foreground">{tr("nenhum_evento_encontrado_tente_outro_nom")}</li>}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
