// Mapa vetorial dos 26 estados + DF (malha do IBGE) com lista acessível equivalente.
import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { CONTORNOS_UF, CREDITO_MAPA, MAPA_ALTURA, MAPA_LARGURA } from "@/data/mapaBrasil";
import { NOMES_UF } from "@/lib/participacao";
import { nomeModalidade } from "@/lib/modalidades";
import { formatarDataBR } from "@/lib/domain/money";
import type { OperacaoDTO } from "@/lib/perfilSocial";
import { Button } from "@/components/ui/button";
import { EstadoVazio } from "@/components/ui";
import { BadgeParticipacao } from "./abas";

type Situacao = "participou" | "participando" | "ambos";
function situacao(ops: OperacaoDTO[] | undefined): Situacao | null {
  if (!ops?.length) return null;
  const sim = ops.some((o) => o.estado === "participou");
  const nao = ops.some((o) => o.estado === "participando");
  return sim && nao ? "ambos" : sim ? "participou" : "participando";
}
const PREENCHIMENTO: Record<Situacao, string> = {
  participou: "fill-success", participando: "fill-warning", ambos: "fill-[url(#padrao-ambos)]",
};

export function MapaBrasil({ operacoes }: { operacoes: OperacaoDTO[] }) {
  const porUf = useMemo(() => {
    const m = new Map<string, OperacaoDTO[]>();
    for (const o of operacoes) if (o.uf) m.set(o.uf, [...(m.get(o.uf) ?? []), o]);
    return m;
  }, [operacoes]);
  const temParticipando = operacoes.some((o) => o.estado === "participando");
  const temAmbos = [...porUf.values()].some((ops) => situacao(ops) === "ambos");
  const [foco, setFoco] = useState<string | null>(null);
  const [aberto, setAberto] = useState<string | null>(null);
  const ufs = Object.keys(CONTORNOS_UF).sort((a, b) => NOMES_UF[a]!.localeCompare(NOMES_UF[b]!));
  const dica = foco ? `${NOMES_UF[foco]}: ${porUf.get(foco)?.length ?? 0} operação(ões)` : "Passe o cursor ou use Tab para ver cada estado";

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      <div>
        <p aria-live="polite" className="mb-2 min-h-5 text-sm text-muted-foreground">{dica}</p>
        <svg viewBox={`0 0 ${MAPA_LARGURA} ${MAPA_ALTURA}`} role="group" aria-label="Mapa do Brasil com estados visitados" className="h-auto w-full max-w-xl">
          <defs>
            <pattern id="padrao-ambos" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <rect width="4" height="8" className="fill-success" />
              <rect x="4" width="4" height="8" className="fill-warning" />
            </pattern>
          </defs>
          {ufs.map((uf) => {
            const n = porUf.get(uf)?.length ?? 0;
            const sit = situacao(porUf.get(uf));
            const ativo = aberto === uf || foco === uf;
            return (
              <path
                key={uf}
                d={CONTORNOS_UF[uf]}
                tabIndex={0}
                role="button"
                aria-label={`${NOMES_UF[uf]}: ${n} operação(ões)`}
                aria-pressed={aberto === uf}
                onMouseEnter={() => setFoco(uf)}
                onMouseLeave={() => setFoco(null)}
                onFocus={() => setFoco(uf)}
                onBlur={() => setFoco(null)}
                onClick={() => setAberto(uf)}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setAberto(uf); } }}
                className={`cursor-pointer stroke-background outline-none transition-colors [stroke-width:1.5] focus-visible:[stroke-width:4] focus-visible:stroke-ring ${
                  sit ? (ativo ? "fill-accent" : PREENCHIMENTO[sit]) : ativo ? "fill-primary/40" : "fill-secondary"
                }`}
              />
            );
          })}
        </svg>
        <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1"><span className="h-3 w-3 rounded-sm bg-success" aria-hidden="true" /> Participou</span>
          {temParticipando && <span className="flex items-center gap-1"><span className="h-3 w-3 rounded-sm bg-warning" aria-hidden="true" /> Participando</span>}
          {temAmbos && (
            <span className="flex items-center gap-1">
              <svg className="h-3 w-3 rounded-sm" aria-hidden="true"><rect width="12" height="12" fill="url(#padrao-ambos)" /></svg> Participou e participando
            </span>
          )}
          <span className="flex items-center gap-1"><span className="h-3 w-3 rounded-sm bg-secondary" aria-hidden="true" /> Sem participação</span>
          <span>{CREDITO_MAPA}</span>
        </div>
      </div>

      <div>
        {aberto ? (
          <section aria-label={`Operações em ${NOMES_UF[aberto]}`} className="rounded-lg border border-border bg-card p-4">
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-display text-lg font-semibold uppercase">{NOMES_UF[aberto]}</h3>
              <Button variant="ghost" onClick={() => setAberto(null)} aria-label="Fechar detalhes do estado">✕</Button>
            </div>
            {(porUf.get(aberto) ?? []).length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">Nenhuma operação neste estado.</p>
            ) : (
              <ul className="mt-2 space-y-2">
                {[...porUf.get(aberto)!].sort((a, b) => (a.estado === b.estado ? b.inicioEm.localeCompare(a.inicioEm) : a.estado === "participando" ? -1 : 1)).map((o) => (
                  <li key={o.eventoId} className="rounded-md border border-border p-3 text-sm">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <Link to="/eventos/$eventoId" params={{ eventoId: o.eventoId }} className="font-medium hover:underline">{o.nome}</Link>
                      <BadgeParticipacao estado={o.estado} />
                    </div>
                    <p className="text-muted-foreground">{formatarDataBR(o.inicioEm)} · {o.cidade}/{o.uf} · {nomeModalidade(o.modalidade)}</p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ) : null}
        <h3 className="mt-4 text-sm font-semibold">Lista de estados</h3>
        {porUf.size === 0 ? (
          <div className="mt-2"><EstadoVazio titulo="Nenhum estado ainda" descricao="Estados aparecem ao confirmar uma inscrição (Participando) e contam como visitados após o evento com presença confirmada (Participou)." /></div>
        ) : (
          <ul className="mt-2 grid gap-1 sm:grid-cols-2">
            {[...porUf.entries()].sort((a, b) => b[1].length - a[1].length).map(([uf, ops]) => (
              <li key={uf}>
                <Button variant="plain" size="none" type="button" onClick={() => setAberto(uf)} className="flex w-full items-center justify-between rounded-md border border-border px-3 py-2 text-left text-sm hover:bg-secondary focus-visible:outline-2 focus-visible:outline-ring">
                  <span>{NOMES_UF[uf]}</span>
                  <span className="text-muted-foreground">{ops.length}</span>
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
