// Botão de localização + seletor (popover no desktop, painel inferior no celular).
import { createPortal } from "react-dom";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Check, Crosshair, Loader2, MapPin, Search, X } from "lucide-react";
import { useLocalizacao, mensagemStatus } from "@/contexts/LocalizacaoContext";
import { useIsMobile } from "@/hooks/use-mobile";
import { carregarBase } from "@/services/db";
import { CIDADES_BASE, buscarLocalidades, normalizar, rotuloCurto, type Localidade } from "@/lib/localizacao";
import { NACIONAL } from "@/lib/divulgacao";

export function SeletorCidade({ compacto = false, className = "" }: { compacto?: boolean; className?: string }) {
  const { local, modo, status, definirLocal, usarLocalizacaoAtual } = useLocalizacao();
  const [aberto, setAberto] = useState(false);
  const [termo, setTermo] = useState("");
  const [montado, setMontado] = useState(false);
  const celular = useIsMobile();
  const botaoRef = useRef<HTMLButtonElement>(null);
  const painelRef = useRef<HTMLDivElement>(null);
  const buscaRef = useRef<HTMLInputElement>(null);
  const idTitulo = useId();
  useEffect(() => setMontado(true), []);

  const lista = useMemo<Localidade[]>(() => {
    if (!aberto) return CIDADES_BASE;
    const extras = carregarBase().eventos.map((e) => ({ cidade: e.cidade, uf: e.uf }));
    const todos = [...CIDADES_BASE, ...extras];
    const v = new Set<string>();
    return todos.filter((l) => { const k = `${normalizar(l.cidade)}/${l.uf}`; if (v.has(k)) return false; v.add(k); return true; });
  }, [aberto]);
  const resultados = buscarLocalidades(lista, termo, 8);

  const fechar = () => {
    setAberto(false);
    setTermo("");
    requestAnimationFrame(() => botaoRef.current?.focus());
  };

  useEffect(() => {
    if (!aberto) return;
    buscaRef.current?.focus();
    const tecla = (e: KeyboardEvent) => { if (e.key === "Escape") { e.preventDefault(); fechar(); } };
    const fora = (e: MouseEvent) => {
      if (celular) return;
      const alvo = e.target as Node;
      if (!painelRef.current?.contains(alvo) && !botaoRef.current?.contains(alvo)) fechar();
    };
    document.addEventListener("keydown", tecla);
    document.addEventListener("mousedown", fora);
    return () => { document.removeEventListener("keydown", tecla); document.removeEventListener("mousedown", fora); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberto, celular]);

  const escolher = (l: Localidade) => { definirLocal({ escopo: "cidade", cidade: l.cidade, uf: l.uf }); fechar(); };
  const rotulo = montado ? rotuloCurto(local) : "Todo o Brasil";
  const obtendo = montado && status === "obtendo";
  const aviso = montado ? mensagemStatus(status) : null;
  const selecionado = (l: Localidade) => local.escopo === "cidade" && local.uf === l.uf && normalizar(local.cidade ?? "") === normalizar(l.cidade);

  const conteudo = (
    <div
      ref={painelRef}
      role="dialog"
      aria-modal={celular ? "true" : undefined}
      aria-labelledby={idTitulo}
      className={celular
        ? "fixed inset-x-0 bottom-0 z-[60] flex max-h-[85dvh] flex-col rounded-t-xl border-t border-border bg-popover p-4 text-popover-foreground shadow-2xl"
        : "absolute left-0 top-full z-50 mt-2 w-[22rem] rounded-lg border border-border bg-popover p-4 text-popover-foreground shadow-xl"}
    >
      <div className="flex items-start justify-between gap-2">
        <h2 id={idTitulo} className="font-display text-lg font-semibold uppercase tracking-wide">Onde você quer encontrar operações?</h2>
        <button type="button" onClick={fechar} aria-label="Fechar" className="rounded p-1 text-muted-foreground hover:bg-secondary focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"><X className="h-4 w-4" /></button>
      </div>
      <button
        type="button"
        onClick={async () => { await usarLocalizacaoAtual(); }}
        disabled={obtendo}
        className="mt-3 flex w-full items-center gap-2 rounded-md border border-border px-3 py-2 text-left text-sm hover:bg-secondary focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-60"
      >
        {obtendo ? <Loader2 className="h-4 w-4 animate-spin text-accent" /> : <Crosshair className="h-4 w-4 text-accent" />}
        <span className="flex-1">{obtendo ? "Obtendo sua localização…" : "Usar minha localização atual"}</span>
        {modo === "atual" && <span className="text-xs text-muted-foreground">em uso</span>}
      </button>
      {aviso && status !== "obtendo" && <p role="status" className="mt-2 text-xs text-muted-foreground">{aviso}</p>}
      <label className="mt-3 block text-xs font-medium text-muted-foreground" htmlFor={`${idTitulo}-busca`}>Buscar cidade ou estado</label>
      <div className="relative mt-1">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          id={`${idTitulo}-busca`}
          ref={buscaRef}
          type="search"
          value={termo}
          onChange={(e) => setTermo(e.target.value)}
          placeholder="Ex.: Campinas ou SP"
          className="w-full rounded-md border border-input bg-background py-2 pl-8 pr-3 text-sm focus:border-ring focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>
      <ul className="mt-2 min-h-0 flex-1 overflow-y-auto" aria-label="Localidades">
        <li>
          <button type="button" onClick={() => { definirLocal(NACIONAL); fechar(); }} aria-pressed={local.escopo === "nacional"}
            className="flex w-full items-center justify-between rounded px-3 py-2 text-left text-sm hover:bg-secondary focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring">
            <span className="font-medium">Todo o Brasil</span>
            {local.escopo === "nacional" && <Check className="h-4 w-4 text-accent" />}
          </button>
        </li>
        {resultados.map((l) => (
          <li key={`${l.cidade}/${l.uf}`}>
            <button type="button" onClick={() => escolher(l)} aria-pressed={selecionado(l)}
              className="flex w-full items-center justify-between rounded px-3 py-2 text-left text-sm hover:bg-secondary focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring">
              <span>{l.cidade} <span className="text-muted-foreground">· {l.uf}</span></span>
              {selecionado(l) && <Check className="h-4 w-4 text-accent" />}
            </button>
          </li>
        ))}
        {resultados.length === 0 && <li className="px-3 py-2 text-sm text-muted-foreground">Nenhuma cidade encontrada.</li>}
      </ul>
      <p className="mt-2 text-[11px] text-muted-foreground">
        {montado && modo === "manual" ? "Localização escolhida manualmente." : montado && modo === "atual" ? "Localização atual obtida pelo aparelho." : "Mostrando todo o Brasil."}
      </p>
    </div>
  );

  return (
    <div className={`relative ${className}`}>
      <button
        ref={botaoRef}
        type="button"
        onClick={() => (aberto ? fechar() : setAberto(true))}
        aria-expanded={aberto}
        aria-haspopup="dialog"
        aria-label={`Localização: ${rotulo}. Alterar`}
        className={`flex max-w-full items-center gap-1.5 rounded-md border border-border bg-background/60 text-sm hover:bg-secondary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${compacto ? "px-2.5 py-1.5" : "h-10 w-full px-3"}`}
      >
        {obtendo ? <Loader2 className="h-4 w-4 shrink-0 animate-spin text-accent" /> : <MapPin className="h-4 w-4 shrink-0 text-accent" />}
        <span className="truncate font-medium text-foreground">{obtendo ? "Localizando…" : rotulo}</span>
        <span className="shrink-0 text-muted-foreground">· Alterar</span>
      </button>
      {aberto && (celular ? createPortal(
        <>
          <div className="fixed inset-0 z-[55] bg-black/60" onClick={fechar} aria-hidden="true" />
          {conteudo}
        </>,
        document.body,
      ) : conteudo)}
    </div>
  );
}
