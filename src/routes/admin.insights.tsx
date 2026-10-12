import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { carregarBase } from "@/services/db";
import { gerarInsights } from "@/lib/insights.functions";
import { AreaTexto, Botao, Cartao, Skeleton } from "@/components/ui";

export const Route = createFileRoute("/admin/insights")({
  head: () => ({
    meta: [
      { title: "Insights com IA — Admin MilSim Ops" },
      { name: "description", content: "Tendências e recomendações práticas geradas por IA a partir de eventos e inscrições." },
      { property: "og:title", content: "Insights com IA — Admin MilSim Ops" },
      { property: "og:description", content: "Tendências e recomendações com IA." },
    ],
  }),
  component: Insights,
});

/** Agrega os dados sem informações pessoais para enviar à IA. */
function montarResumo() {
  const base = carregarBase();
  const eventos = base.eventos.map((ev) => {
    const ins = base.inscricoes.filter((i) => i.eventoId === ev.id);
    const porStatus: Record<string, number> = {};
    for (const i of ins) porStatus[i.status] = (porStatus[i.status] ?? 0) + 1;
    const confirmadas = porStatus["confirmada"] ?? 0;
    return {
      nome: ev.nome,
      cidade: `${ev.cidade}/${ev.uf}`,
      data: ev.inicioEm.slice(0, 10),
      status: ev.status,
      capacidade: ev.capacidadeTotal,
      inscricoesPorStatus: porStatus,
      ocupacaoPct: ev.capacidadeTotal ? Math.round((confirmadas / ev.capacidadeTotal) * 100) : 0,
      receitaReais: base.movimentacoes.filter((m) => m.eventoId === ev.id).reduce((s, m) => s + m.valorCentavos, 0) / 100,
    };
  });
  const porMes: Record<string, number> = {};
  for (const i of base.inscricoes) {
    const mes = (i as { criadoEm?: string }).criadoEm?.slice(0, 7) ?? "desconhecido";
    porMes[mes] = (porMes[mes] ?? 0) + 1;
  }
  return {
    dataReferencia: new Date().toISOString().slice(0, 10),
    totalEventos: eventos.length,
    totalInscricoes: base.inscricoes.length,
    inscricoesPorMes: porMes,
    usuariosAtivos: base.usuarios.filter((u) => u.ativo).length,
    solicitacoesOrganizadorPendentes: base.solicitacoes.filter((s) => ["pendente", "em_analise"].includes(s.status)).length,
    eventos,
  };
}

function Insights() {
  const chamar = useServerFn(gerarInsights);
  const resumo = useMemo(montarResumo, []);
  const [pergunta, setPergunta] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [texto, setTexto] = useState("");
  const [erro, setErro] = useState("");

  const analisar = async () => {
    setCarregando(true);
    setErro("");
    setTexto("");
    try {
      const r = await chamar({ data: { resumo, pergunta: pergunta || undefined } });
      if (r.ok) setTexto(r.texto);
      else setErro(r.erro);
    } catch {
      setErro("Não foi possível gerar a análise agora.");
    } finally {
      setCarregando(false);
    }
  };

  return (
    <div className="space-y-6">
      <section>
        <h2 className="font-display text-lg font-semibold uppercase">Insights com IA</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          A IA analisa os dados agregados de {resumo.totalEventos} eventos e {resumo.totalInscricoes} inscrições (sem dados pessoais) para apontar tendências e recomendações.
        </p>
      </section>

      <Cartao>
        <label htmlFor="pergunta" className="text-sm font-medium">Pergunta específica (opcional)</label>
        <AreaTexto
          id="pergunta"
          className="mt-2"
          rows={2}
          placeholder="Ex.: Quais eventos correm risco de baixa ocupação? Como aumentar as inscrições?"
          value={pergunta}
          onChange={(e) => setPergunta(e.target.value)}
        />
        <div className="mt-3 flex flex-wrap gap-2">
          <Botao onClick={analisar} disabled={carregando}>{carregando ? "Analisando..." : "Gerar análise"}</Botao>
          <details className="text-xs text-muted-foreground">
            <summary className="cursor-pointer py-2">Ver dados enviados</summary>
            <pre className="mt-2 max-h-64 overflow-auto rounded bg-muted p-2">{JSON.stringify(resumo, null, 2)}</pre>
          </details>
        </div>
      </Cartao>

      {erro && <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">{erro}</p>}

      {carregando && (
        <Cartao>
          <div className="space-y-2">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        </Cartao>
      )}

      {texto && (
        <Cartao>
          <div className="space-y-1 text-sm leading-relaxed">{renderMarkdown(texto)}</div>
        </Cartao>
      )}
    </div>
  );
}

function renderMarkdown(md: string) {
  const negrito = (s: string) =>
    s.split(/(\*\*[^*]+\*\*)/g).map((p, i) => (p.startsWith("**") ? <strong key={i}>{p.slice(2, -2)}</strong> : p));
  return md.split("\n").map((l, i) => {
    if (l.startsWith("## ") || l.startsWith("### "))
      return <h3 key={i} className="pt-3 font-display text-base font-semibold uppercase">{l.replace(/^#+\s/, "")}</h3>;
    if (/^\s*([-*]|\d+\.)\s/.test(l))
      return <p key={i} className="pl-4">• {negrito(l.replace(/^\s*([-*]|\d+\.)\s/, ""))}</p>;
    if (!l.trim()) return null;
    return <p key={i}>{negrito(l)}</p>;
  });
}
