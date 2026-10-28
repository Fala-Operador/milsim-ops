import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Crosshair, MapPin, Search } from "lucide-react";
import { carregarBase } from "@/services/db";
import { POSICAO_LISTAGEM, type BaseDados, type Evento } from "@/lib/domain/types";
import { campanhasNaPosicao } from "@/lib/impulsionamento";
import { idDoVisitante } from "@/services/analytics";
import { vagasRestantes } from "@/services/inscricoes";
import { formatarDataBR } from "@/lib/domain/money";
import { CartaoOperacao } from "@/components/CartaoOperacao";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SkeletonGrade } from "@/components/ui";
import { useLocalizacao, mensagemStatus } from "@/contexts/LocalizacaoContext";
import { eventoElegivel, montarPaginaInicial, NACIONAL } from "@/lib/divulgacao";
import { filtrarEventos, rotuloCurto, type FiltroDescoberta, type Periodo } from "@/lib/localizacao";
import { CardRastreado, ImagemSegura, SecoesPublicas } from "@/components/divulgacao";
import { SeletorCidade } from "@/components/SeletorCidade";
import { useVersaoBase } from "@/hooks/useVersaoBase";
import { SectionCarousel } from "@/components/SectionCarousel";
import { SobrePlataforma } from "@/components/SobrePlataforma";
import { usePreferencias } from "@/contexts/PreferenciasContext";
import {
  ehModalidade, filtrarPorModalidades, MODALIDADES, nomeModalidade, ordenarEventos, ROTULO_ORDENACAO, separarPorPreferencia,
  type ModalidadeId, type Ordenacao,
} from "@/lib/modalidades";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Toggle } from "@/components/ui/toggle";
import { Label } from "@/components/ui/label";
import imgMilsim from "@/assets/modalidade-milsim.jpg";

interface BuscaInicio { q?: string | undefined; periodo?: "30d" | "90d" | undefined; mod?: string | undefined; ordem?: Ordenacao | undefined }

export const Route = createFileRoute("/")({
  // Retorno do Supabase que caiu na página inicial (ele usa o endereço do site quando o destino
  // pedido não está nas Redirect URLs). token_hash = link de recuperação de senha: vai para a nova
  // senha. code = PKCE (login com o Google ou link antigo de recuperação): /entrar-google troca o
  // código e decide pelo tipo do fluxo.
  beforeLoad: ({ location }) => {
    const s = location.search as Record<string, unknown>;
    if (typeof s["token_hash"] === "string" && (s["type"] === "recovery" || s["type"] === undefined)) {
      throw redirect({ to: "/recuperar-senha", search: { token_hash: s["token_hash"], type: "recovery" } });
    }
    if (typeof s["code"] === "string" || typeof s["error"] === "string") {
      const volta = new URLSearchParams();
      if (typeof s["code"] === "string") volta.set("code", s["code"]);
      if (typeof s["error"] === "string") volta.set("error", s["error"]);
      throw redirect({ href: `/entrar-google?${volta}`, reloadDocument: true });
    }
  },
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
      { name: "twitter:card", content: "summary_large_image" },
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
  const semente = base ? idDoVisitante() : "";
  const secoes = base ? montarPaginaInicial(base, local, agora, { semente }) : [];
  // "Operações em destaque" (seções de destaques e impulsos) vêm acima de qualquer outra lista.
  const secoesDestaque = secoes.filter((s) => s.secao.tipo === "destaques");
  const secoesDemais = secoes.filter((s) => s.secao.tipo !== "destaques");
  const organizacaoDe = (id: string) => base?.organizacoes.find((o) => o.id === id)?.nome ?? "—";
  const publicados = base?.eventos.filter((e) => e.status === "publicado" && eventoElegivel(e, agora)) ?? [];
  const regionais = base ? filtrarEventos(publicados, local, aplicado, organizacaoDe, agora) : [];
  const resultados = ordenarEventos(filtrarPorModalidades(regionais, modsSel), ordem, pref.preferencia);
  // "Para você": respeita local e filtros explícitos; nunca amplia a região sozinho.
  const paraVoce = separarPorPreferencia(filtrarPorModalidades(regionais, modsSel), pref.preferencia);
  // Bloco da listagem: só campanhas cujo evento já atende a todos os filtros explícitos.
  const idsResultados = new Set(resultados.map((e) => e.id));
  const impulsionados = base
    ? campanhasNaPosicao(base, POSICAO_LISTAGEM, local, agora, { semente, filtro: (id) => idsResultados.has(id) })
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
      <section className="relative overflow-hidden border-b border-border">
        <img src={imgMilsim} alt="" aria-hidden="true" className="absolute inset-0 h-full w-full object-cover opacity-60" />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,var(--background)_0%,color-mix(in_oklch,var(--background)_88%,transparent)_45%,color-mix(in_oklch,var(--background)_35%,transparent)_100%)]" aria-hidden="true" />
        <div className="relative mx-auto max-w-6xl px-4 pb-8 pt-12 sm:pt-16">
          <h1 className="max-w-2xl font-display text-4xl font-bold uppercase leading-[0.95] text-foreground sm:text-6xl">
            Operações de airsoft e milsim pelo Brasil
          </h1>
          <p className="mt-3 max-w-xl text-base text-muted-foreground">
            O MilSim Ops reúne agenda, inscrição, ingresso e check-in de eventos de airsoft e milsim.{" "}
            <a href="#sobre" className="text-accent underline-offset-2 hover:underline">Saiba mais</a>
          </p>

          <form onSubmit={buscar} role="search" aria-label="Buscar operações"
            className="mt-7 grid overflow-hidden rounded-lg border border-border bg-background shadow-[0_8px_30px_-12px_rgb(0_0_0/0.5)] md:grid-cols-[minmax(0,2fr)_minmax(0,1.2fr)_minmax(0,1fr)_auto]">
            <div className="border-b border-border px-4 py-2.5 md:border-b-0 md:border-r">
              <Label htmlFor="busca-inicio" className="rotulo-tecnico block">Operação ou organização</Label>
              <div className="relative mt-1">
                <Search className="pointer-events-none absolute left-0 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input id="busca-inicio" type="search" value={busca} onChange={(e) => setBusca(e.target.value)}
                  placeholder="Ex.: Escudo Norte"
                  className="h-7 w-full border-0 bg-transparent p-0 pl-6 text-[15px] text-foreground shadow-none placeholder:text-muted-foreground focus-visible:ring-0" />
              </div>
            </div>
            <div className="border-b border-border px-4 py-2.5 md:border-b-0 md:border-r">
              <span className="rotulo-tecnico block">Onde</span>
              <SeletorCidade className="mt-1 [&_button]:h-7 [&_button]:w-full [&_button]:justify-between [&_button]:border-0 [&_button]:bg-transparent [&_button]:px-0" />
            </div>
            <div className="border-b border-border px-4 py-2.5 md:border-b-0">
              <Label htmlFor="periodo-inicio" className="rotulo-tecnico block">Quando</Label>
              <NativeSelect id="periodo-inicio" value={periodo} onChange={(e) => setPeriodo(e.target.value as Periodo)}
                className="mt-1 h-7 w-full border-0 bg-transparent px-0 text-[15px] text-foreground focus-visible:ring-0 py-0">
                <option value="">Qualquer data</option>
                <option value="30d">Próximos 30 dias</option>
                <option value="90d">Próximos 90 dias</option>
              </NativeSelect>
            </div>
            <Button type="submit" className="m-2 h-11 rounded-md px-6 md:self-center"><Search className="h-4 w-4" aria-hidden />Buscar</Button>
          </form>

          <div className="mt-3 flex flex-wrap items-center gap-2" role="group" aria-label="Modalidades">
            <span className="rotulo-tecnico mr-1">Modalidade</span>
            {MODALIDADES.map((m) => {
              const ativo = modsSel.includes(m.id);
              return (
                <Toggle key={m.id} variant="chip" pressed={ativo} onPressedChange={() => alternarMod(m.id)}>
                  {m.nome}
                </Toggle>
              );
            })}
            {pref.montado && (
              <Button variant="plain" size="none" type="button" onClick={pref.abrirEditor} className="ml-auto text-xs text-accent underline-offset-2 hover:underline">
                Personalizar modalidades
              </Button>
            )}
          </div>

          {pedirPermissao && (
            <div className="mt-4 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <Crosshair className="h-4 w-4 text-accent" aria-hidden />
              <Button variant="link" size="none" className="text-sm" onClick={() => void usarLocalizacaoAtual()}>Usar minha localização</Button>
              <span>para ver primeiro o que está perto.</span>
            </div>
          )}
          {aviso && status !== "obtendo" && (
            <p role="status" className="mt-2 text-xs text-muted-foreground">{aviso}</p>
          )}
        </div>
      </section>

      {base && !falha && (impulsionados.length > 0 || secoesDestaque.length > 0) && (
        <section className="mx-auto max-w-6xl px-4 pt-8" aria-label="Operações em destaque">
          {impulsionados.length > 0 && (
            <div aria-labelledby="t-impulsionados">
              <h2 id="t-impulsionados" className="font-display text-2xl font-semibold uppercase tracking-wide">Operações em destaque</h2>
              <p className="text-sm text-muted-foreground">Divulgação da plataforma, de acordo com a sua busca. As demais listas vêm abaixo.</p>
              <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {impulsionados.map((e, i) => (
                  <CardRastreado key={e.id} ativo eventoId={e.id} origem="destaques" secaoId="listagem" posicao={i + 1} visualizacaoId={visualizacaoId} campanhaId={e.campanhaId}>
                    <CartaoEvento evento={e} base={base} organizacao={organizacaoDe(e.organizacaoId)} />
                  </CardRastreado>
                ))}
              </div>
            </div>
          )}
          {secoesDestaque.length > 0 && (
            <div className={impulsionados.length > 0 ? "mt-8" : undefined}>
              <SecoesPublicas secoes={secoesDestaque} base={base} local={local} rastrear visualizacaoId={visualizacaoId} />
            </div>
          )}
        </section>
      )}

      {base && pref.montado && pref.preferencia.estado === "selecionadas" && !modsSel.length && regionais.length > 0 && (
        <section className="mx-auto max-w-6xl px-4 pt-8" aria-label="Operações para você">
          {paraVoce.favoritas.length > 0 ? (
            <SectionCarousel rotulo="Operações para você" cabecalho={
              <div className="flex flex-wrap items-end justify-between gap-2">
                <div>
                  <h2 className="font-display text-2xl font-semibold uppercase tracking-wide">Operações para você</h2>
                  <p className="text-sm text-muted-foreground">Priorizadas pelas suas modalidades favoritas e pela localização selecionada.</p>
                </div>
                <Button variant="plain" size="none" type="button" onClick={pref.abrirEditor} className="text-sm text-accent underline-offset-2 hover:underline">Editar preferências</Button>
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
                  <Button variant="secondary" onClick={() => definirLocal({ escopo: "estado", uf: local.uf })}>Ampliar para o estado</Button>
                )}
                {!nacional && <Button variant="secondary" onClick={() => definirLocal(NACIONAL)}>Ampliar para todo o Brasil</Button>}
                <Button variant="ghost" onClick={pref.abrirEditor}>Editar preferências</Button>
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
            <Label className="flex items-center gap-2 text-sm text-muted-foreground font-normal">
              Ordenar por
              <NativeSelect value={ordem} onChange={(e) => atualizar({ ordem: e.target.value === "para_voce" ? undefined : (e.target.value as Ordenacao) })}
                className="h-9 rounded-md border border-input bg-background px-2 text-sm text-foreground focus-visible:ring-2 focus-visible:ring-ring w-auto py-0">
                {(Object.keys(ROTULO_ORDENACAO) as Ordenacao[]).map((o) => <option key={o} value={o}>{ROTULO_ORDENACAO[o]}</option>)}
              </NativeSelect>
            </Label>
            {filtrosAtivos && (
              <Button variant="plain" size="none" type="button" className="text-sm text-accent underline-offset-2 hover:underline" onClick={limparFiltros}>
                Limpar filtros
              </Button>
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
            <Button className="mt-3" variant="secondary" onClick={() => { try { setBase(carregarBase()); setFalha(false); } catch { setFalha(true); } }}>Tentar novamente</Button>
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
                <Button variant="secondary" onClick={() => definirLocal({ escopo: "estado", uf: local.uf })}>Ver eventos no estado</Button>
              )}
              {!nacional && <Button onClick={() => definirLocal(NACIONAL)}>Explorar todo o Brasil</Button>}
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

      {base && secoesDemais.length > 0 && (
        <section className="mx-auto max-w-6xl px-4 pb-10" aria-label="Destaques e parceiros">
          <SecoesPublicas secoes={secoesDemais} base={base} local={local} rastrear visualizacaoId={visualizacaoId} />
        </section>
      )}

      <SobrePlataforma />
    </div>
  );
}

function CartaoEvento({ evento: e, base, organizacao }: { evento: Evento; base: BaseDados; organizacao: string }) {
  return <CartaoOperacao evento={e} organizacao={organizacao} preco={precoInicial(e)} restantes={vagasRestantes(base, e)} />;
}
