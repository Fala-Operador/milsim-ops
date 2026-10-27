// Placar das missões pré-evento (exércitos por média + metas coletivas), ranking individual e
// temporada da organização. Os números vêm do servidor (placarMissoes/temporadaMissoes): o
// navegador nunca recebe as entregas dos outros participantes.
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Medal, Trophy } from "lucide-react";
import { placarMissoes, temporadaMissoes, type PlacarMissoes } from "@/api/missoes.functions";
import { Badge } from "@/components/ui/badge";
import { NativeSelect } from "@/components/ui/native-select";
import { ErroSecao, SkeletonLista } from "@/components/ui";

export function usePlacar(eventoId: string, versao: unknown) {
  return useQuery({ queryKey: ["placar-missoes", eventoId, versao], queryFn: () => placarMissoes(eventoId) });
}

export function PlacarExercitos({ placar }: { placar: PlacarMissoes }) {
  const maior = Math.max(1, ...placar.exercitos.map((x) => x.total));
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="rotulo-tecnico">Placar dos exércitos</h3>
        <Badge variant={placar.encerrada ? "secondary" : "success"}>{placar.encerrada ? "Resultado final" : "Ao vivo"}</Badge>
      </div>
      <ol className="mt-2 divide-y divide-border border-y border-border">
        {placar.exercitos.map((x) => (
          <li key={x.exercitoId} className="py-3">
            <div className="flex items-baseline gap-3">
              <span className={`font-display text-xl font-bold leading-none ${x.colocacao === 1 ? "text-accent" : "text-muted-foreground"}`} aria-label={`${x.colocacao}º lugar`}>{x.colocacao}º</span>
              <span className="min-w-0 flex-1 truncate font-semibold">{x.nome}</span>
              <span className="font-display text-3xl font-bold leading-none tabular-nums">{x.total}</span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-secondary" aria-hidden>
              <div className={`h-full ${x.colocacao === 1 ? "bg-accent" : "bg-muted-foreground/50"}`} style={{ width: `${Math.round((x.total / maior) * 100)}%` }} />
            </div>
            <p className="mt-1.5 font-mono text-[11px] text-muted-foreground">
              {x.pontos} pts ÷ {x.inscritos} = {x.media}{x.bonus ? ` + ${x.bonus} bônus` : ""}{x.metas.length > 0 && ` · metas: ${x.metas.join(", ")}`}
            </p>
            {x.premio && <p className="mt-1 flex items-center gap-1 text-sm text-accent"><Trophy className="size-4" aria-hidden="true" />{x.premio}</p>}
          </li>
        ))}
      </ol>
      <p className="mt-2 text-xs text-muted-foreground">Média de pontos por inscrito, mais o bônus das metas coletivas. O tamanho do exército não decide.</p>
    </div>
  );
}

export function RankingIndividual({ placar }: { placar: PlacarMissoes }) {
  if (placar.ranking.length === 0) return <p className="text-sm text-muted-foreground">Ninguém pontuou ainda.</p>;
  return (
    <div>
      <h3 className="rotulo-tecnico">Destaques individuais</h3>
      <ol className="mt-2 divide-y divide-border border-y border-border text-sm">
        {placar.ranking.map((l) => (
          <li key={l.posicao} className={`flex items-center gap-3 px-3 py-2 ${l.eu ? "bg-primary/10" : ""}`}>
            <span className="w-6 text-right font-mono text-muted-foreground">{l.posicao}</span>
            {l.posicao <= 3 && <Medal className="size-4 text-accent" aria-hidden="true" />}
            <span className="min-w-0 flex-1 truncate">{l.nome}{l.eu && " (você)"} <span className="text-muted-foreground">· {l.exercito}</span></span>
            <span className="text-xs text-muted-foreground">{l.missoes} missão(ões)</span>
            <span className="w-14 text-right font-mono font-medium">{l.pontos}</span>
          </li>
        ))}
      </ol>
      {placar.minhaPosicao && placar.minhaPosicao > 10 && <p className="mt-2 text-xs text-muted-foreground">Sua posição: {placar.minhaPosicao}º</p>}
    </div>
  );
}

export function PlacarCompleto({ eventoId, versao, empilhado = false }: { eventoId: string; versao: unknown; empilhado?: boolean }) {
  const grade = empilhado ? "grid gap-6" : "grid gap-6 lg:grid-cols-2";
  const q = usePlacar(eventoId, versao);
  if (q.isPending) {
    return (
      <div className={grade}>
        <SkeletonLista linhas={4} rotulo="Carregando placar" />
        <SkeletonLista linhas={6} rotulo="Carregando ranking" />
      </div>
    );
  }
  if (q.isError || !q.data) return <ErroSecao titulo="Placar indisponível" onTentar={() => q.refetch()} />;
  return (
    <div className={`surgir ${grade}`}>
      <PlacarExercitos placar={q.data} />
      <RankingIndividual placar={q.data} />
    </div>
  );
}

export function Temporada({ organizacaoId }: { organizacaoId: string }) {
  const atual = new Date().getFullYear();
  const [ano, setAno] = useState(atual);
  const q = useQuery({ queryKey: ["temporada-missoes", organizacaoId, ano], queryFn: () => temporadaMissoes(organizacaoId, ano) });
  return (
    <section aria-label="Temporada" className="space-y-2">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h3 className="font-display text-base font-semibold uppercase">Temporada {q.data?.organizacao ? `· ${q.data.organizacao}` : ""}</h3>
          <p className="text-xs text-muted-foreground">Pontos de missões somados em todos os eventos da organização no ano.</p>
        </div>
        <label className="text-sm">
          <span className="sr-only">Ano da temporada</span>
          <NativeSelect value={ano} onChange={(e) => setAno(Number(e.target.value))}>
            {[atual + 1, atual, atual - 1, atual - 2].map((a) => <option key={a} value={a}>{a}</option>)}
          </NativeSelect>
        </label>
      </div>
      {q.isPending ? <SkeletonLista rotulo="Carregando temporada" /> : q.isError || !q.data ? (
        <ErroSecao titulo="Temporada indisponível" onTentar={() => q.refetch()} />
      ) : q.data.ranking.length === 0 ? (
        <p className="text-sm text-muted-foreground">Sem pontos nesta temporada.</p>
      ) : (
        <ol className="surgir divide-y divide-border rounded-md border border-border text-sm">
          {q.data.ranking.map((l) => (
            <li key={l.posicao} className={`flex items-center gap-3 px-3 py-2 ${l.eu ? "bg-primary/10" : ""}`}>
              <span className="w-6 text-right font-mono text-muted-foreground">{l.posicao}</span>
              <span className="min-w-0 flex-1 truncate">{l.nome}{l.eu && " (você)"}</span>
              <span className="text-xs text-muted-foreground">{l.missoes} missão(ões)</span>
              <span className="w-14 text-right font-mono font-medium">{l.pontos}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
