import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Crosshair, MapPin, Search } from "lucide-react";
import { carregarBase } from "@/services/db";
import { POSICAO_LISTAGEM, type BaseDados, type Evento } from "@/lib/domain/types";
import { campanhasNaPosicao } from "@/lib/impulsionamento";
import { vagasRestantes } from "@/services/inscricoes";
import { formatarBRL, formatarDataBR } from "@/lib/domain/money";
import { Badge, Botao, SkeletonGrade } from "@/components/ui";
import { useLocalizacao, mensagemStatus } from "@/contexts/LocalizacaoContext";
import { eventoElegivel, montarPaginaInicial, NACIONAL } from "@/lib/divulgacao";
import { filtrarEventos, rotuloCurto, type FiltroDescoberta, type Periodo } from "@/lib/localizacao";
import { CardRastreado, ImagemSegura, SecoesPublicas } from "@/components/divulgacao";
import { SeletorCidade } from "@/components/SeletorCidade";
import { useVersaoBase } from "@/hooks/useVersaoBase";
import { SectionCarousel } from "@/components/SectionCarousel";
import { usePreferencias } from "@/contexts/PreferenciasContext";
import {
  ehModalidade, filtrarPorModalidades, MODALIDADES, nomeModalidade, ordenarEventos, ROTULO_ORDENACAO, separarPorPreferencia,
  type ModalidadeId, type Ordenacao,
} from "@/lib/modalidades";

interface BuscaInicio { q?: string | undefined; periodo?: "30d" | "90d" | undefined; mod?: string | undefined; ordem?: Ordenacao | undefined }

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
  validateSearch: (s: { q?: unknown; periodo?: unknown; mod?: unknown; ordem?: unknown }): BuscaInicio => ({
    q: typeof s.q === "string" && s.q ? s.q.slice(0, 100) : undefined,
    periodo: s.periodo === "30d" || s.periodo === "90d" ? s.periodo : undefined,
    mod: typeof s.mod === "string" && s.mod ? s.mod.split(",").filter(ehModalidade).join(",") || undefined : undefined,
    ordem: s.ordem === "data" || s.ordem === "recentes" ? s.ordem : undefined,
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
  // Filtros ficam no endereço: abrir um evento e voltar preserva a busca.
  const pesquisa = Route.useSearch();
  const navegar = Route.useNavigate();
  const aplicado: FiltroDescoberta = { busca: pesquisa.q ?? "", periodo: pesquisa.periodo ?? "" };
  const modsSel = (pesquisa.mod?.split(",") ?? []) as ModalidadeId[];
  const ordem: Ordenacao = pesquisa.ordem ?? "para_voce";
  const [busca, setBusca] = useState(aplicado.busca);
  const [periodo, setPeriodo] = useState<Periodo>(aplicado.periodo);
  const pref = usePreferencias();
  const atualizar = (m: Partial<BuscaInicio>) =>
    void navegar({ search: (prev) => ({ ...prev, ...m }), replace: true, resetScroll: false });
  const setAplicado = (f: FiltroDescoberta) => atualizar({ q: f.busca || undefined, periodo: f.periodo || undefined });
  const alternarMod = (id: ModalidadeId) => {
    const prox = modsSel.includes(id) ? modsSel.filter((x) => x !== id) : [...modsSel, id];
    atualizar({ mod: prox.join(",") || undefined });
  };
  const filtrosAtivos = !!(aplicado.busca || aplicado.periodo || modsSel.length);
  const limparFiltros = () => { setBusca(""); setPeriodo(""); void navegar({ search: {}, replace: true, resetScroll: false }); };

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
  const regionais = base ? filtrarEventos(publicados, local, aplicado, organizacaoDe, agora) : [];
  const resultados = ordenarEventos(filtrarPorModalidades(regionais, modsSel), ordem, pref.preferencia);
  // "Para você": respeita local e filtros explícitos; nunca amplia a região sozinho.
  const paraVoce = separarPorPreferencia(filtrarPorModalidades(regionais, modsSel), pref.preferencia);
  // Bloco da listagem: só campanhas cujo evento já atende a todos os filtros explícitos.
  const idsResultados = new Set(resultados.map((e) => e.id));
  const impulsionados = base
    ? campanhasNaPosicao(base, POSICAO_LISTAGEM, local, agora)
        .filter((c) => idsResultados.has(c.eventoId))
        .map((c) => ({ ...resultados.find((e) => e.id === c.eventoId)!, campanhaId: c.id }))
    : [];
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

          <div className="mt-3 flex flex-wrap items-center gap-2" role="group" aria-label="Modalidades">
            <span className="text-xs font-medium text-muted-foreground">Modalidades:</span>
            {MODALIDADES.map((m) => {
              const ativo = modsSel.includes(m.id);
              return (
                <button key={m.id} type="button" aria-pressed={ativo} onClick={() => alternarMod(m.id)}
                  className={`rounded-full border px-3 py-1 text-xs font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${ativo ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background/70 text-muted-foreground hover:border-accent hover:text-foreground"}`}>
                  {ativo && <span aria-hidden>✓ </span>}{m.nome}
                </button>
              );
            })}
            {pref.montado && (
              <button type="button" onClick={pref.abrirEditor} className="ml-auto text-xs text-accent underline-offset-2 hover:underline">
                Personalizar modalidades
              </button>
            )}
          </div>

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

      {base && pref.montado && pref.preferencia.estado === "selecionadas" && !modsSel.length && regionais.length > 0 && (
        <section className="mx-auto max-w-6xl px-4 pt-8" aria-label="Operações para você">
          {paraVoce.favoritas.length > 0 ? (
            <SectionCarousel rotulo="Operações para você" cabecalho={
              <div className="flex flex-wrap items-end justify-between gap-2">
                <div>
                  <h2 className="font-display text-2xl font-semibold uppercase tracking-wide">Operações para você</h2>
                  <p className="text-sm text-muted-foreground">Priorizadas pelas suas modalidades favoritas e pela localização selecionada.</p>
                </div>
                <button type="button" onClick={pref.abrirEditor} className="text-sm text-accent underline-offset-2 hover:underline">Editar preferências</button>
              </div>
            }>
              {paraVoce.favoritas.map((e, i) => (
                <CardRastreado key={e.id} ativo eventoId={e.id} origem="busca" posicao={i + 1} visualizacaoId={visualizacaoId} className="w-72 max-w-full shrink-0 snap-start">
                  <CartaoEvento evento={e} base={base} organizacao={organizacaoDe(e.organizacaoId)} />
                </CardRastreado>
              ))}
            </SectionCarousel>
          ) : (
            <div className="rounded-lg border border-dashed border-border p-4">
              <h2 className="font-display text-xl font-semibold uppercase">Operações para você</h2>
              <p className="mt-1 text-sm">
                Nenhuma operação de {pref.preferencia.modalidades.map(nomeModalidade).join(", ")} em {rotuloCurto(local)} no momento.
                {paraVoce.outras.length > 0 && " Veja abaixo outras modalidades desta região."}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {local.escopo === "cidade" && local.uf && (
                  <Botao variante="secundario" onClick={() => definirLocal({ escopo: "estado", uf: local.uf })}>Ampliar para o estado</Botao>
                )}
                {!nacional && <Botao variante="secundario" onClick={() => definirLocal(NACIONAL)}>Ampliar para todo o Brasil</Botao>}
                <Botao variante="fantasma" onClick={pref.abrirEditor}>Editar preferências</Botao>
              </div>
            </div>
          )}
        </section>
      )}

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
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              Ordenar por
              <select value={ordem} onChange={(e) => atualizar({ ordem: e.target.value === "para_voce" ? undefined : (e.target.value as Ordenacao) })}
                className="h-9 rounded-md border border-input bg-background px-2 text-sm text-foreground focus-visible:ring-2 focus-visible:ring-ring">
                {(Object.keys(ROTULO_ORDENACAO) as Ordenacao[]).map((o) => <option key={o} value={o}>{ROTULO_ORDENACAO[o]}</option>)}
              </select>
            </label>
            {filtrosAtivos && (
              <button type="button" className="text-sm text-accent underline-offset-2 hover:underline" onClick={limparFiltros}>
                Limpar filtros
              </button>
            )}
          </div>
        </div>

        {filtrosAtivos && (
          <p className="mt-2 text-xs text-muted-foreground">
            Filtros ativos: {[aplicado.busca && `“${aplicado.busca}”`, aplicado.periodo && (aplicado.periodo === "30d" ? "próximos 30 dias" : "próximos 90 dias"), ...modsSel.map(nomeModalidade)].filter(Boolean).join(" · ")}
          </p>
        )}
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
              {filtrosAtivos
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
          <>
          {impulsionados.length > 0 && (
            <div className="mt-4 rounded-lg border border-accent/40 p-4" aria-labelledby="t-impulsionados">
              <div className="flex flex-wrap items-center gap-2">
                <h3 id="t-impulsionados" className="font-display text-lg font-semibold uppercase">Operações em destaque</h3>
                <Badge tom="aviso">Em destaque</Badge>
              </div>
              <p className="text-sm text-muted-foreground">Divulgação da plataforma, de acordo com a sua busca. Os resultados comuns vêm abaixo.</p>
              <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {impulsionados.map((e, i) => (
                  <CardRastreado key={e.id} ativo eventoId={e.id} origem="destaques" secaoId="listagem" posicao={i + 1} visualizacaoId={visualizacaoId} campanhaId={e.campanhaId}>
                    <CartaoEvento evento={e} base={base} organizacao={organizacaoDe(e.organizacaoId)} />
                  </CardRastreado>
                ))}
              </div>
            </div>
          )}
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {resultados.map((e, i) => (
              <CardRastreado key={e.id} ativo eventoId={e.id} origem="busca" posicao={i + 1} visualizacaoId={visualizacaoId}>
                <CartaoEvento evento={e} base={base} organizacao={organizacaoDe(e.organizacaoId)} />
              </CardRastreado>
            ))}
          </div>
          </>
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
      <div className="aspect-video overflow-hidden border-b border-border bg-secondary">
        {e.imagemUrl ? (
          <ImagemSegura key={e.imagemUrl} src={e.imagemUrl} alt={e.imagem?.alt || `Imagem da ${e.nome}`} className="h-full w-full" />
        ) : (
          <div className="topo-bg flex h-full items-end p-3">
            <span className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
              {e.cidade}/{e.uf}
            </span>
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="line-clamp-2 min-h-[3.25rem] font-display text-xl font-semibold uppercase leading-tight">{e.nome}</h3>
          {restantes <= 0 ? <Badge tom="perigo">Esgotado</Badge>
            : restantes <= e.capacidadeTotal * 0.15 ? <Badge tom="aviso">Últimas vagas</Badge>
            : <Badge tom="sucesso">Vagas abertas</Badge>}
        </div>
        <p className="mt-1 text-sm text-muted-foreground">{formatarDataBR(e.inicioEm)} · {e.cidade}/{e.uf}</p>
        <p className="mt-1"><span className="inline-block rounded border border-border px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{nomeModalidade(e.modalidade)}</span></p>
        <p className="truncate text-sm text-muted-foreground">{organizacao}</p>
        <div className="mt-auto flex items-center justify-between pt-3">
          <p className="text-sm">A partir de <span className="font-semibold text-accent">{formatarBRL(precoInicial(e))}</span></p>
          <span className="text-sm font-medium text-primary group-hover:underline">Ver operação →</span>
        </div>
      </div>
    </Link>
  );
}
