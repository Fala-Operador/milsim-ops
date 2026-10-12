// Painel de desempenho da divulgação: visualizações, cliques e visitas vindas da página inicial.
import { useEffect, useState } from "react";
import type { BaseDados } from "@/lib/domain/types";
import { limparMetricas, listarMetricas, resumirMetricas, type RegistroMetrica } from "@/services/metricas";
import { Botao, Cartao, EstadoVazio, Selecao, Skeleton } from "@/components/ui";

const pct = (n: number) => `${(n * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;

export function PainelDesempenho({ base }: { base: BaseDados }) {
  const [lista, setLista] = useState<RegistroMetrica[] | null>(null);
  const [periodo, setPeriodo] = useState("30");
  useEffect(() => setLista(listarMetricas()), []);
  if (!lista) return <Skeleton className="h-64 w-full" />;

  const desde = periodo === "tudo" ? undefined : new Date(Date.now() - Number(periodo) * 86400000);
  const { secoes, alvos, total } = resumirMetricas(lista, desde);
  const nomeSecao = (id: string) => base.secoesInicio.find((s) => s.id === id)?.titulo ?? "Seção removida";
  const nomeAlvo = (id: string) =>
    base.eventos.find((e) => e.id === id)?.nome ?? base.parceiros.find((p) => p.id === id)?.nome ?? id;
  const tipoAlvo = (id: string) => (base.eventos.some((e) => e.id === id) ? "Evento" : base.parceiros.some((p) => p.id === id) ? "Parceiro" : "Outro");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <label className="text-sm">
          <span className="mb-1 block text-xs text-muted-foreground">Período</span>
          <Selecao value={periodo} onChange={(e) => setPeriodo(e.target.value)}>
            <option value="1">Últimas 24 horas</option>
            <option value="7">Últimos 7 dias</option>
            <option value="30">Últimos 30 dias</option>
            <option value="tudo">Todo o período</option>
          </Selecao>
        </label>
        <div className="flex gap-2">
          <Botao variante="contorno" onClick={() => setLista(listarMetricas())}>Atualizar</Botao>
          <Botao variante="fantasma" onClick={() => { limparMetricas(); setLista([]); }}>Zerar métricas</Botao>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Demonstração: os números contam apenas o uso neste navegador. A prévia do admin não entra na contagem.
      </p>

      <div className="grid gap-3 sm:grid-cols-4">
        {[
          ["Visualizações de seções", total.v.toLocaleString("pt-BR")],
          ["Cliques nos destaques", total.c.toLocaleString("pt-BR")],
          ["Visitas aos eventos", total.i.toLocaleString("pt-BR")],
          ["Taxa de clique", pct(total.v ? total.c / total.v : 0)],
        ].map(([r, v]) => (
          <Cartao key={r}><p className="text-xs text-muted-foreground">{r}</p><p className="mt-1 font-display text-3xl font-semibold">{v}</p></Cartao>
        ))}
      </div>

      {secoes.length === 0 ? (
        <EstadoVazio titulo="Sem dados no período" descricao="Abra a página inicial e clique nos destaques para gerar métricas." />
      ) : (
        <>
          <Tabela titulo="Por seção" cab={["Seção", "Visualizações", "Cliques", "Visitas", "Taxa de clique"]}
            linhas={secoes.sort((a, b) => b.cliques - a.cliques).map((s) => [nomeSecao(s.secaoId), s.visualizacoes, s.cliques, s.visitas, pct(s.taxaClique)])}
            maximo={Math.max(1, ...secoes.map((s) => s.cliques))} colunaBarra={2} />
          <Tabela titulo="Mais clicados" cab={["Destaque", "Tipo", "Cliques", "Visitas ao evento"]}
            linhas={alvos.slice(0, 10).map((a) => [nomeAlvo(a.id), tipoAlvo(a.id), a.cliques, tipoAlvo(a.id) === "Evento" ? a.visitas : "—"])}
            maximo={Math.max(1, ...alvos.map((a) => a.cliques))} colunaBarra={2} />
        </>
      )}
    </div>
  );
}

function Tabela({ titulo, cab, linhas, maximo, colunaBarra }: {
  titulo: string; cab: string[]; linhas: (string | number)[][]; maximo: number; colunaBarra: number;
}) {
  return (
    <div>
      <h3 className="mb-2 font-display text-lg font-semibold uppercase">{titulo}</h3>
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-secondary text-left">
            <tr>{cab.map((c) => <th key={c} className="px-3 py-2 font-medium">{c}</th>)}</tr>
          </thead>
          <tbody>
            {linhas.map((l, i) => (
              <tr key={i} className="border-t border-border">
                {l.map((v, j) => (
                  <td key={j} className="px-3 py-2">
                    {j === colunaBarra && typeof v === "number" ? (
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-24 rounded bg-secondary"><div className="h-2 rounded bg-primary" style={{ width: `${(v / maximo) * 100}%` }} /></div>
                        {v}
                      </div>
                    ) : v}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
