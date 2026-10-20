// Placar das missões pré-evento (exércitos por média + metas coletivas), ranking individual e
// temporada da organização. Os números vêm do servidor (placarMissoes/temporadaMissoes): o
// navegador nunca recebe as entregas dos outros participantes.
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Medal, Trophy } from "lucide-react";
import { placarMissoes, temporadaMissoes, type PlacarMissoes } from "@/api/missoes.functions";
import { Badge } from "@/components/ui/badge";
import { NativeSelect } from "@/components/ui/native-select";
import { ErroSecao, Spinner } from "@/components/ui";

export function usePlacar(eventoId: string, versao: unknown) {
  return useQuery({ queryKey: ["placar-missoes", eventoId, versao], queryFn: () => placarMissoes(eventoId) });
}

export function PlacarExercitos({ placar }: { placar: PlacarMissoes }) {
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-display text-base font-semibold uppercase">Placar dos exércitos</h3>
        <Badge variant={placar.encerrada ? "secondary" : "success"}>{placar.encerrada ? "Resultado final" : "Ao vivo"}</Badge>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Média de pontos por inscrito (o tamanho do exército não decide) + bônus das metas coletivas.
      </p>
      <ol className="mt-3 space-y-2">
        {placar.exercitos.map((x) => (
          <li key={x.exercitoId} className="flex flex-wrap items-center gap-3 rounded-md border border-border bg-card p-3">
            <span className={`flex size-9 shrink-0 items-center justify-center rounded-full font-display text-lg font-bold ${x.colocacao === 1 ? "bg-primary text-primary-foreground" : "bg-secondary"}`} aria-label={`${x.colocacao}º lugar`}>
              {x.colocacao}º
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-medium">{x.nome}</p>
              <p className="text-xs text-muted-foreground">
                {x.pontos} pts ÷ {x.inscritos} inscrito(s) = {x.media}{x.bonus ? ` + ${x.bonus} de bônus` : ""}
                {x.metas.length > 0 && ` · metas: ${x.metas.join(", ")}`}
              </p>
              {x.premio && <p className="mt-1 flex items-center gap-1 text-sm text-accent"><Trophy className="size-4" aria-hidden="true" />{x.premio}</p>}
            </div>
            <span className="font-display text-2xl font-semibold tabular-nums">{x.total}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

export function RankingIndividual({ placar }: { placar: PlacarMissoes }) {
  if (placar.ranking.length === 0) return <p className="text-sm text-muted-foreground">Ninguém pontuou ainda.</p>;
  return (
    <div>
      <h3 className="font-display text-base font-semibold uppercase">Destaques individuais</h3>
      <ol className="mt-2 divide-y divide-border rounded-md border border-border text-sm">
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

export function PlacarCompleto({ eventoId, versao }: { eventoId: string; versao: unknown }) {
  const q = usePlacar(eventoId, versao);
  if (q.isPending) return <Spinner texto="Carregando placar..." />;
  if (q.isError || !q.data) return <ErroSecao titulo="Placar indisponível" onTentar={() => q.refetch()} />;
  return (
    <div className="grid gap-6 lg:grid-cols-2">
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
      {q.isPending ? <Spinner texto="Carregando temporada..." /> : q.isError || !q.data ? (
        <ErroSecao titulo="Temporada indisponível" onTentar={() => q.refetch()} />
      ) : q.data.ranking.length === 0 ? (
        <p className="text-sm text-muted-foreground">Sem pontos nesta temporada.</p>
      ) : (
        <ol className="divide-y divide-border rounded-md border border-border text-sm">
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
