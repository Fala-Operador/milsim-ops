import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Crosshair, MapPin, Search } from "lucide-react";
import { carregarBase } from "@/services/db";
import type { BaseDados, Evento } from "@/lib/domain/types";
import { vagasRestantes } from "@/services/inscricoes";
import { formatarBRL, formatarDataBR } from "@/lib/domain/money";
import { Badge, Botao, SkeletonGrade } from "@/components/ui";
import { useLocalizacao, mensagemStatus } from "@/contexts/LocalizacaoContext";
import { eventoElegivel, montarPaginaInicial, NACIONAL } from "@/lib/divulgacao";
import { filtrarEventos, rotuloCurto, type FiltroDescoberta, type Periodo } from "@/lib/localizacao";
import { CardRastreado, SecoesPublicas } from "@/components/divulgacao";
import { SeletorCidade } from "@/components/SeletorCidade";
import { useVersaoBase } from "@/hooks/useVersaoBase";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "MilSim Ops — Encontre sua próxima operação" },
      {
        name: "description",
        content:
          "Explore eventos de simulação militar perto de você: busque por operação ou organização, escolha a cidade e o período.",
      },
      { property: "og:title", content: "MilSim Ops — Encontre sua próxima operação" },
      {
        property: "og:description",
        content: "Explore eventos de simulação militar, reúna seu squad e prepare-se para a missão.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PaginaInicial,
});

function precoInicial(evento: Evento): number {
  const precos = evento.lotes
    .filter((l) => l.status === "ativo")
    .flatMap((l) => l.itens.map((i) => i.precoCentavos));
  if (precos.length) return Math.min(...precos);
  return Math.min(...evento.tipos.map((t) => t.precoBaseCentavos));
}

function PaginaInicial() {
  const [base, setBase] = useState<BaseDados | null>(null);
  const [falha, setFalha] = useState(false);
  const versao = useVersaoBase();
  const [visualizacaoId] = useState(() => `vz-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`);
  const { local, definirLocal, pedirPermissao, usarLocalizacaoAtual, status } = useLocalizacao();
  const [busca, setBusca] = useState("");
  const [periodo, setPeriodo] = useState<Periodo>("");
  const [aplicado, setAplicado] = useState<FiltroDescoberta>({ busca: "", periodo: "" });

  useEffect(() => {
    const t = setTimeout(() => {
      try { setBase(carregarBase()); setFalha(false); } catch { setFalha(true); }
    }, 300);
    return () => clearTimeout(t);
  }, [versao]);

  const agora = new Date();
  const secoes = base ? montarPaginaInicial(base, local, agora) : [];
  const organizacaoDe = (id: string) => base?.organizacoes.find((o) => o.id === id)?.nome ?? "—";
  const publicados = base?.eventos.filter((e) => e.status === "publicado" && eventoElegivel(e, agora)) ?? [];
  const resultados = base ? filtrarEventos(publicados, local, aplicado, organizacaoDe, agora) : [];
  const nacional = local.escopo === "nacional";
  const tituloSecao = nacional
    ? "Explore operações pelo Brasil"
    : local.escopo === "cidade" ? `Operações perto de ${local.cidade}` : `Operações em ${rotuloCurto(local)}`;
  const aviso = mensagemStatus(status);

  const buscar = (e: React.FormEvent) => {
    e.preventDefault();
    setAplicado({ busca, periodo });
    document.getElementById("resultados")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div>
      <section className="topo-bg border-b border-border bg-card">
        <div className="mx-auto max-w-6xl px-4 pb-6 pt-8 sm:pt-10">
          <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-accent">Central de operações</p>
          <h1 className="mt-1 font-display text-3xl font-bold uppercase tracking-wide text-foreground sm:text-4xl">
            Encontre sua próxima operação.
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground sm:text-base">
            Explore eventos de simulação militar, reúna seu squad e prepare-se para a missão.
          </p>

          <form onSubmit={buscar} role="search" aria-label="Buscar operações"
            className="mt-5 grid gap-3 rounded-lg border border-border bg-background/80 p-3 backdrop-blur md:grid-cols-[minmax(0,2fr)_minmax(0,1.3fr)_minmax(0,1fr)_auto] md:items-end">
            <div>
              <label htmlFor="busca-inicio" className="mb-1 block text-xs font-medium text-muted-foreground">Buscar operação ou organização</label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input id="busca-inicio" type="search" value={busca} onChange={(e) => setBusca(e.target.value)}
                  placeholder="Ex.: Escudo Norte"
                  className="h-10 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
              </div>
            </div>
            <div>
              <span className="mb-1 block text-xs font-medium text-muted-foreground">Localização</span>
              <SeletorCidade />
            </div>
            <div>
              <label htmlFor="periodo-inicio" className="mb-1 block text-xs font-medium text-muted-foreground">Período</label>
              <select id="periodo-inicio" value={periodo} onChange={(e) => setPeriodo(e.target.value as Periodo)}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground focus:border-ring focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <option value="">Qualquer data</option>
                <option value="30d">Próximos 30 dias</option>
                <option value="90d">Próximos 90 dias</option>
              </select>
            </div>
            <Botao type="submit" className="h-10 px-5">Buscar operações</Botao>
          </form>

          {pedirPermissao && (
            <div className="mt-3 flex flex-wrap items-center gap-3 rounded-md border border-dashed border-accent/50 bg-background/60 px-3 py-2 text-sm">
              <Crosshair className="h-4 w-4 text-accent" aria-hidden />
              <span className="flex-1 font-medium">Encontre operações perto de você</span>
              <Botao variante="secundario" onClick={() => void usarLocalizacaoAtual()}>Usar minha localização</Botao>
            </div>
          )}
          {aviso && status !== "obtendo" && (
            <p role="status" className="mt-2 text-xs text-muted-foreground">{aviso}</p>
          )}
        </div>
      </section>

      <section id="resultados" className="mx-auto max-w-6xl scroll-mt-24 px-4 py-8">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="font-display text-2xl font-semibold uppercase tracking-wide">{tituloSecao}</h2>
            <p className="mt-0.5 flex items-center gap-1 text-sm text-muted-foreground">
              <MapPin className="h-3.5 w-3.5 text-accent" aria-hidden />
              {rotuloCurto(local)}
              {base && <> · {resultados.length} {resultados.length === 1 ? "operação encontrada" : "operações encontradas"}</>}
            </p>
          </div>
          {(aplicado.busca || aplicado.periodo) && (
            <button type="button" className="text-sm text-accent underline-offset-2 hover:underline" onClick={() => { setBusca(""); setPeriodo(""); setAplicado({ busca: "", periodo: "" }); }}>
              Limpar busca
            </button>
          )}
        </div>

        {falha ? (
          <div role="alert" className="mt-4 rounded-lg border border-destructive/50 p-6 text-center">
            <p className="font-medium">Não foi possível carregar as operações.</p>
            <Botao className="mt-3" variante="secundario" onClick={() => { try { setBase(carregarBase()); setFalha(false); } catch { setFalha(true); } }}>Tentar novamente</Botao>
          </div>
        ) : !base ? (
          <div className="mt-4"><SkeletonGrade quantidade={3} /></div>
        ) : resultados.length === 0 ? (
          <div className="mt-4 rounded-lg border border-dashed border-border p-6 text-center">
            <p className="font-medium">
              {aplicado.busca || aplicado.periodo
                ? "Nenhuma operação encontrada para esta busca."
                : local.escopo === "cidade" ? "Nenhuma operação encontrada nesta cidade." : "Nenhuma operação encontrada nesta localização."}
            </p>
            <div className="mt-3 flex flex-wrap justify-center gap-2">
              {local.escopo === "cidade" && local.uf && (
                <Botao variante="secundario" onClick={() => definirLocal({ escopo: "estado", uf: local.uf })}>Ver eventos no estado</Botao>
              )}
              {!nacional && <Botao onClick={() => definirLocal(NACIONAL)}>Explorar todo o Brasil</Botao>}
            </div>
          </div>
        ) : (
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {resultados.map((e, i) => (
              <CardRastreado key={e.id} ativo eventoId={e.id} origem="busca" posicao={i + 1} visualizacaoId={visualizacaoId}>
                <CartaoEvento evento={e} base={base} organizacao={organizacaoDe(e.organizacaoId)} />
              </CardRastreado>
            ))}
          </div>
        )}
      </section>

      {base && secoes.length > 0 && (
        <section className="mx-auto max-w-6xl px-4 pb-10" aria-label="Destaques e parceiros">
          <SecoesPublicas secoes={secoes} base={base} local={local} rastrear visualizacaoId={visualizacaoId} />
        </section>
      )}
    </div>
  );
}

function CartaoEvento({ evento: e, base, organizacao }: { evento: Evento; base: BaseDados; organizacao: string }) {
  const restantes = vagasRestantes(base, e);
  return (
    <Link to="/eventos/$eventoId" params={{ eventoId: e.id }}
      className="group flex h-full flex-col overflow-hidden rounded-lg border border-border bg-card text-card-foreground transition-transform hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
      <div className="topo-bg flex aspect-[16/7] items-end border-b border-border bg-secondary p-3">
        <span className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
          {e.cidade}/{e.uf}
        </span>
      </div>
      <div className="flex flex-1 flex-col p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="line-clamp-2 min-h-[3.25rem] font-display text-xl font-semibold uppercase leading-tight">{e.nome}</h3>
          {restantes <= 0 ? <Badge tom="perigo">Esgotado</Badge>
            : restantes <= e.capacidadeTotal * 0.15 ? <Badge tom="aviso">Últimas vagas</Badge>
            : <Badge tom="sucesso">Vagas abertas</Badge>}
        </div>
        <p className="mt-1 text-sm text-muted-foreground">{formatarDataBR(e.inicioEm)} · {e.cidade}/{e.uf}</p>
        <p className="truncate text-sm text-muted-foreground">{organizacao}</p>
        <div className="mt-auto flex items-center justify-between pt-3">
          <p className="text-sm">A partir de <span className="font-semibold text-accent">{formatarBRL(precoInicial(e))}</span></p>
          <span className="text-sm font-medium text-primary group-hover:underline">Ver operação →</span>
        </div>
      </div>
    </Link>
  );
}
