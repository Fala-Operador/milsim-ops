import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { carregarBase } from "@/services/db";
import type { BaseDados } from "@/lib/domain/types";
import { vagasRestantes } from "@/services/inscricoes";
import { formatarBRL, formatarDataBR } from "@/lib/domain/money";
import { Badge, Cartao, Entrada, Selecao, EstadoVazio, SkeletonGrade } from "@/components/ui";
import type { Evento } from "@/lib/domain/types";
import { useLocalizacao } from "@/contexts/LocalizacaoContext";
import { montarPaginaInicial, NACIONAL, rotuloAbrangencia } from "@/lib/divulgacao";
import { CardRastreado, SecoesPublicas, SeletorLocalizacao } from "@/components/divulgacao";
import { useVersaoBase } from "@/hooks/useVersaoBase";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "MilSim Ops — Descubra operações de simulação militar" },
      {
        name: "description",
        content:
          "Eventos de simulação militar em destaque por região: busque por nome, filtre por localização, data e disponibilidade. Ambiente de demonstração.",
      },
      { property: "og:title", content: "MilSim Ops — Descubra operações de simulação militar" },
      {
        property: "og:description",
        content: "Eventos de simulação militar em destaque. Ambiente de demonstração.",
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
  const versao = useVersaoBase();
  const [visualizacaoId] = useState(() => `vz-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`);
  const { local, definirLocal } = useLocalizacao();
  useEffect(() => {
    const t = setTimeout(() => setBase(carregarBase()), 350);
    return () => clearTimeout(t);
  }, [versao]);
  const secoes = base ? montarPaginaInicial(base, local, new Date()) : [];
  const temEventosNoLocal = secoes.some((s) => s.eventos.length > 0);
  const carregando = base === null;
  const [busca, setBusca] = useState("");
  const [uf, setUf] = useState("");
  const [periodo, setPeriodo] = useState("");
  const [disponibilidade, setDisponibilidade] = useState("");

  const publicados = base?.eventos.filter((e) => e.status === "publicado") ?? [];
  const ufs = [...new Set(publicados.map((e) => e.uf))].sort();

  const filtrados = !base ? [] : publicados.filter((e) => {
    if (busca && !e.nome.toLowerCase().includes(busca.toLowerCase())) return false;
    if (uf && e.uf !== uf) return false;
    if (periodo) {
      const inicio = new Date(e.inicioEm);
      const hoje = new Date();
      if (periodo === "30d" && inicio.getTime() - hoje.getTime() > 30 * 86400000) return false;
      if (periodo === "90d" && inicio.getTime() - hoje.getTime() > 90 * 86400000) return false;
    }
    if (disponibilidade === "com_vagas" && vagasRestantes(base, e) <= 0) return false;
    if (disponibilidade === "quase_esgotado") {
      const restantes = vagasRestantes(base, e);
      if (restantes <= 0 || restantes > e.capacidadeTotal * 0.15) return false;
    }
    return true;
  });

  const organizacaoDe = (id: string) => base?.organizacoes.find((o) => o.id === id)?.nome ?? "—";

  return (
    <div>
      <section className="topo-bg border-b border-border bg-card">
        <div className="mx-auto max-w-6xl px-4 py-14">
          <p className="font-mono text-xs uppercase tracking-widest text-accent">
            23°06'S 46°42'W — setor de operações
          </p>
          <h1 className="mt-2 font-display text-4xl font-bold uppercase tracking-wide text-foreground sm:text-5xl">
            Operações de simulação militar
          </h1>
          <p className="mt-3 max-w-2xl text-muted-foreground">
            Encontre eventos, escolha seu exército e confirme sua inscrição simulada. Tudo em um
            só lugar — do briefing ao caderno de regras.
          </p>
        </div>
      </section>

      {base && (
        <section className="mx-auto max-w-6xl px-4 pt-8">
          <SeletorLocalizacao base={base} valor={local} onMudar={definirLocal} />
          {local.escopo !== "nacional" && !temEventosNoLocal && (
            <div className="mt-4 rounded-lg border border-dashed border-border p-6 text-center">
              <p className="font-medium">Nenhuma operação divulgada para {rotuloAbrangencia(local)} no momento.</p>
              <button type="button" onClick={() => definirLocal(NACIONAL)} className="mt-3 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
                Ver eventos de todo o Brasil
              </button>
            </div>
          )}
          <div className="mt-6"><SecoesPublicas secoes={secoes} base={base} local={local} rastrear visualizacaoId={visualizacaoId} /></div>
        </section>
      )}

      <section className="mx-auto max-w-6xl px-4 py-8">
        <div className="grid gap-3 rounded-lg border border-border bg-card p-4 sm:grid-cols-2 lg:grid-cols-4">
          <Entrada
            type="search"
            placeholder="Buscar por nome da operação..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            aria-label="Buscar por nome"
          />
          <Selecao value={uf} onChange={(e) => setUf(e.target.value)} aria-label="Filtrar por estado">
            <option value="">Todos os estados</option>
            {ufs.map((u) => (
              <option key={u} value={u}>{u}</option>
            ))}
          </Selecao>
          <Selecao value={periodo} onChange={(e) => setPeriodo(e.target.value)} aria-label="Filtrar por data">
            <option value="">Qualquer data</option>
            <option value="30d">Próximos 30 dias</option>
            <option value="90d">Próximos 90 dias</option>
          </Selecao>
          <Selecao
            value={disponibilidade}
            onChange={(e) => setDisponibilidade(e.target.value)}
            aria-label="Filtrar por disponibilidade"
          >
            <option value="">Qualquer disponibilidade</option>
            <option value="com_vagas">Com vagas</option>
            <option value="quase_esgotado">Quase esgotado</option>
          </Selecao>
        </div>

        <h2 className="mt-8 font-display text-2xl font-semibold uppercase tracking-wide">
          Todas as operações
        </h2>

        {carregando ? (
          <div className="mt-4">
            <SkeletonGrade quantidade={6} />
          </div>
        ) : filtrados.length === 0 ? (
          <div className="mt-4">
            <EstadoVazio titulo="Nenhuma operação encontrada" descricao="Ajuste os filtros ou a busca." />
          </div>
        ) : (
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtrados.map((e, i) => {
              const restantes = vagasRestantes(base!, e);
              return (
                <CardRastreado key={e.id} ativo eventoId={e.id} origem="busca" posicao={i + 1} visualizacaoId={visualizacaoId}>
                <Link to="/eventos/$eventoId" params={{ eventoId: e.id }}>
                  <Cartao className="h-full transition-transform hover:-translate-y-0.5">
                    <div className="topo-bg -mx-5 -mt-5 mb-4 flex h-32 items-end rounded-t-lg border-b border-border bg-secondary p-3">
                      <span className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
                        {e.nome.slice(0, 2).toUpperCase()}-{e.cidade.slice(0, 3).toUpperCase()} · {e.fuso}
                      </span>
                    </div>
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-display text-xl font-semibold uppercase">{e.nome}</h3>
                      {restantes <= 0 ? (
                        <Badge tom="perigo">Esgotado</Badge>
                      ) : restantes <= e.capacidadeTotal * 0.15 ? (
                        <Badge tom="aviso">Últimas vagas</Badge>
                      ) : (
                        <Badge tom="sucesso">Vagas abertas</Badge>
                      )}
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {formatarDataBR(e.inicioEm)} · {e.cidade}/{e.uf}
                    </p>
                    <p className="text-sm text-muted-foreground">{organizacaoDe(e.organizacaoId)}</p>
                    <p className="mt-3 text-sm font-medium text-foreground">
                      A partir de <span className="text-accent">{formatarBRL(precoInicial(e))}</span>
                    </p>
                  </Cartao>
                </Link>
                </CardRastreado>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
