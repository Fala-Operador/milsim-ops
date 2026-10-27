// Botão de localização + seletor de estado (Popover no desktop, Sheet inferior no celular).
import { useEffect, useId, useRef, useState } from "react";
import { Check, ChevronDown, Crosshair, Loader2, MapPin, Search, X } from "lucide-react";
import { useLocalizacao, mensagemStatus } from "@/contexts/LocalizacaoContext";
import { useIsMobile } from "@/hooks/use-mobile";
import { buscarEstados, rotuloCurto, type Estado } from "@/lib/localizacao";
import { NACIONAL } from "@/lib/divulgacao";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";

// "cabecalho": sem caixa, para a barra do topo; "campo": botão com borda (padrão).
export function SeletorCidade({ compacto = false, className = "", variante = "campo" }: { compacto?: boolean; className?: string; variante?: "campo" | "cabecalho" }) {
  const { local, modo, status, definirLocal, usarLocalizacaoAtual } = useLocalizacao();
  const [aberto, setAberto] = useState(false);
  const [termo, setTermo] = useState("");
  const [montado, setMontado] = useState(false);
  const celular = useIsMobile();
  const buscaRef = useRef<HTMLInputElement>(null);
  const idTitulo = useId();
  useEffect(() => setMontado(true), []);

  const resultados = buscarEstados(termo);

  // Fechar (Esc, clique fora, escolha) devolve o foco ao botão pelo próprio Radix.
  const fechar = () => {
    setAberto(false);
    setTermo("");
  };
  const mudarAberto = (abrir: boolean) => (abrir ? setAberto(true) : fechar());
  const focarBusca = (e: Event) => {
    e.preventDefault();
    buscaRef.current?.focus();
  };

  const escolher = (e: Estado) => { definirLocal({ escopo: "estado", uf: e.uf }); fechar(); };
  const rotulo = montado ? rotuloCurto(local) : "Todo o Brasil";
  const sigla = montado && local.escopo !== "nacional" && local.uf ? local.uf : "Brasil";
  const obtendo = montado && status === "obtendo";
  const aviso = montado ? mensagemStatus(status) : null;
  const selecionado = (e: Estado) => local.escopo !== "nacional" && local.uf === e.uf;

  const conteudo = (
    <>
      <div className="flex items-start justify-between gap-2">
        {celular ? (
          <SheetTitle id={idTitulo} className="uppercase tracking-wide">Onde você quer encontrar operações?</SheetTitle>
        ) : (
          <h2 id={idTitulo} className="font-display text-lg font-semibold uppercase tracking-wide">Onde você quer encontrar operações?</h2>
        )}
        <Button variant="ghost" size="none" type="button" onClick={fechar} aria-label="Fechar" className="rounded p-1 text-muted-foreground"><X className="h-4 w-4" /></Button>
      </div>
      <Button variant="plain" size="none"
        type="button"
        onClick={async () => { await usarLocalizacaoAtual(); }}
        disabled={obtendo}
        className="mt-3 flex w-full items-center gap-2 rounded-md border border-border px-3 py-2 text-left text-sm hover:bg-secondary focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-60"
      >
        {obtendo ? <Loader2 className="h-4 w-4 animate-spin text-accent" /> : <Crosshair className="h-4 w-4 text-accent" />}
        <span className="flex-1">{obtendo ? "Obtendo sua localização…" : "Usar minha localização atual"}</span>
        {modo === "atual" && <span className="text-xs text-muted-foreground">em uso</span>}
      </Button>
      {aviso && status !== "obtendo" && <p role="status" className="mt-2 text-xs text-muted-foreground">{aviso}</p>}
      <Label className="mt-3 block text-xs font-medium text-muted-foreground" htmlFor={`${idTitulo}-busca`}>Buscar estado</Label>
      <div className="relative mt-1">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          id={`${idTitulo}-busca`}
          ref={buscaRef}
          type="search"
          value={termo}
          onChange={(e) => setTermo(e.target.value)}
          placeholder="Ex.: São Paulo ou SP"
          className="w-full rounded-md border border-input bg-background py-2 pl-8 pr-3 text-sm focus:border-ring focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>
      <ul className="mt-2 max-h-[min(18rem,50dvh)] min-h-0 flex-1 overflow-y-auto overscroll-contain pr-1" aria-label="Estados">
        <li>
          <Button variant="plain" size="none" type="button" onClick={() => { definirLocal(NACIONAL); fechar(); }} aria-pressed={local.escopo === "nacional"}
            className="flex w-full items-center justify-between rounded px-3 py-2 text-left text-sm hover:bg-secondary focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring">
            <span className="font-medium">Todo o Brasil</span>
            {local.escopo === "nacional" && <Check className="h-4 w-4 text-accent" />}
          </Button>
        </li>
        {resultados.map((e) => (
          <li key={e.uf}>
            <Button variant="plain" size="none" type="button" onClick={() => escolher(e)} aria-pressed={selecionado(e)}
              className="flex w-full items-center justify-between rounded px-3 py-2 text-left text-sm hover:bg-secondary focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring">
              <span>{e.nome} <span className="text-muted-foreground">· {e.uf}</span></span>
              {selecionado(e) && <Check className="h-4 w-4 text-accent" />}
            </Button>
          </li>
        ))}
        {resultados.length === 0 && <li className="px-3 py-2 text-sm text-muted-foreground">Nenhum estado encontrado.</li>}
      </ul>
      <p className="mt-2 text-[11px] text-muted-foreground">
        {montado && modo === "manual" ? "Localização escolhida manualmente." : montado && modo === "atual" ? "Localização atual obtida pelo aparelho." : "Mostrando todo o Brasil."}
      </p>
    </>
  );

  const gatilho = (
    <Button variant="plain" size="none"
      type="button"
      aria-label={obtendo ? "Obtendo sua localização" : `Localização: ${rotulo}. Alterar localização`}
      className={variante === "cabecalho"
        ? "flex h-11 max-w-full items-center gap-1.5 rounded-md px-2 text-sm hover:bg-secondary/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring lg:px-2.5"
        : `flex max-w-full items-center gap-1.5 rounded-md border border-border bg-secondary/40 text-sm hover:bg-secondary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${compacto ? "h-10 px-3" : "h-10 w-full px-3"}`}
    >
      {obtendo ? <Loader2 className="h-4 w-4 shrink-0 animate-spin text-accent motion-reduce:animate-none" /> : <MapPin className="h-4 w-4 shrink-0 text-accent" />}
      {variante === "cabecalho" ? (
        // No celular só a sigla do estado (ou "Brasil"), para caber ao lado da marca.
        <span className="truncate font-medium text-foreground xl:max-w-[10rem]">
          <span className="xl:hidden">{obtendo ? "…" : sigla}</span>
          <span className="hidden xl:inline">{obtendo ? "Localizando…" : rotulo}</span>
        </span>
      ) : (
        <span className={`truncate font-medium text-foreground ${compacto ? "max-w-[11rem]" : ""}`}>{obtendo ? "Localizando…" : rotulo}</span>
      )}
      <ChevronDown className={`ml-auto h-4 w-4 shrink-0 text-muted-foreground transition-transform motion-reduce:transition-none ${aberto ? "rotate-180" : ""}`} aria-hidden="true" />
    </Button>
  );

  return (
    <div className={`relative ${className}`}>
      {celular ? (
        <Sheet open={aberto} onOpenChange={mudarAberto}>
          <SheetTrigger asChild>{gatilho}</SheetTrigger>
          <SheetContent
            side="bottom"
            showCloseButton={false}
            aria-describedby={undefined}
            onOpenAutoFocus={focarBusca}
            className="z-[60] flex max-h-[85dvh] flex-col gap-0 rounded-t-xl border-t border-border p-4 shadow-2xl"
          >
            {conteudo}
          </SheetContent>
        </Sheet>
      ) : (
        <Popover open={aberto} onOpenChange={mudarAberto}>
          <PopoverTrigger asChild>{gatilho}</PopoverTrigger>
          <PopoverContent
            role="dialog"
            aria-labelledby={idTitulo}
            align="start"
            sideOffset={8}
            onOpenAutoFocus={focarBusca}
            className="flex max-h-[var(--radix-popover-content-available-height)] w-[22rem] flex-col rounded-lg border-border p-4 shadow-xl"
          >
            {conteudo}
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}
