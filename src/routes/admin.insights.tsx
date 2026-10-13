import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { Badge, Botao, Cartao, Selecao, Skeleton } from "@/components/ui";
import { useVersaoBase } from "@/hooks/useVersaoBase";
import { analisar, resumoAtual } from "@/services/insights";
import { faltaDados, ROTULO_PERIODO, sugestoesDisponiveis, type PeriodoAnalise, type ResultadoAnalise } from "@/lib/insights";

export const Route = createFileRoute("/admin/insights")({
  head: () => ({
    meta: [
      { title: "Central de análise — Admin MilSim Ops" },
      { name: "description", content: "Explore o desempenho das operações e identifique oportunidades com base nos dados disponíveis." },
      { property: "og:title", content: "Central de análise — Admin MilSim Ops" },
      { property: "og:description", content: "Análise do desempenho das operações com Lovable AI." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Central,
});

interface Gerado { resultado: ResultadoAnalise; pergunta: string; periodo: PeriodoAnalise; em: Date }

const LINKS: Record<string, { to: "/admin/divulgacao" | "/admin/metricas"; rotulo: string }> = {
  "Oportunidades": { to: "/admin/divulgacao", rotulo: "Abrir divulgação da página inicial" },
  "Próximas ações": { to: "/admin/metricas", rotulo: "Abrir métricas" },
};

function Central() {
  useVersaoBase();
  const [periodo, setPeriodo] = useState<PeriodoAnalise>("todos");
  const resumo = useMemo(() => resumoAtual(periodo), [periodo]);
  const sugestoes = sugestoesDisponiveis(resumo);
  const falta = faltaDados(resumo);
  const [pergunta, setPergunta] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");
  const [gerado, setGerado] = useState<Gerado | null>(null);
  const [painel, setPainel] = useState(false);
  const campo = useRef<HTMLTextAreaElement>(null);
  const atualizado = useMemo(() => new Date(), [resumo]);

  const enviar = async () => {
    if (carregando || falta) return;
    setCarregando(true);
    setErro("");
    try {
      const resultado = await analisar(resumo, pergunta);
      setGerado({ resultado, pergunta: pergunta.trim(), periodo, em: new Date() });
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível gerar a análise agora.");
    } finally {
      setCarregando(false);
    }
  };

  const desatualizado = gerado && gerado.periodo !== periodo;

  return (
    <div className="space-y-6">
      <header>
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="font-display text-2xl font-semibold uppercase tracking-wide">Central de análise</h2>
          <Badge tom="destaque">Lovable AI</Badge>
        </div>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Explore o desempenho das operações e identifique oportunidades com base nos dados disponíveis.
        </p>
        <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            ["Eventos incluídos", String(resumo.totalEventos)],
            ["Inscrições incluídas", String(resumo.totalInscricoes)],
            ["Período analisado", ROTULO_PERIODO[periodo]],
            ["Dados atualizados", atualizado.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })],
          ].map(([r, v]) => (
            <div key={r} className="rounded-md border border-border bg-card px-3 py-2">
              <dt className="text-xs text-muted-foreground">{r}</dt>
              <dd className="font-display text-lg font-semibold">{v}</dd>
            </div>
          ))}
        </dl>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-6">
          <Cartao>
            <h3 className="font-display text-lg font-semibold uppercase">O que você quer analisar?</h3>
            <div className="mt-4 grid gap-4 sm:grid-cols-[200px]">
              <label className="space-y-1.5 text-sm font-medium">
                <span>Período</span>
                <Selecao value={periodo} onChange={(e) => setPeriodo(e.target.value as PeriodoAnalise)}>
                  {Object.entries(ROTULO_PERIODO).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </Selecao>
              </label>
            </div>
            <div className="mt-4">
              <label htmlFor="pergunta" className="flex items-baseline gap-2 text-sm font-medium">
                Sua pergunta <span className="text-xs font-normal text-muted-foreground">Opcional</span>
              </label>
              <textarea
                id="pergunta"
                ref={campo}
                value={pergunta}
                maxLength={1000}
                onChange={(e) => setPergunta(e.target.value)}
                aria-describedby="pergunta-ajuda"
                placeholder="Ex.: Quais eventos estão com baixa ocupação e merecem mais divulgação?"
                className="mt-1.5 block min-h-[120px] w-full resize-y rounded-md border border-input bg-background px-4 py-3 text-base leading-relaxed text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
              <p id="pergunta-ajuda" className="mt-1.5 text-xs text-muted-foreground">
                Deixe em branco para gerar um panorama geral. Não inclua dados pessoais.
              </p>
            </div>
            {sugestoes.length > 0 && (
              <div className="mt-4">
                <p className="text-xs font-medium uppercase text-muted-foreground">Sugestões</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {sugestoes.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => { setPergunta(s.texto); campo.current?.focus(); }}
                      className="rounded-full border border-border px-3 py-1.5 text-left text-sm hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {s.texto}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div className="mt-5 flex flex-wrap items-center gap-2">
              <Botao onClick={enviar} disabled={carregando || !!falta} aria-busy={carregando}>
                {carregando ? "Analisando dados…" : "Gerar análise"}
              </Botao>
              <Botao variante="contorno" onClick={() => setPainel(true)}>Ver dados da análise</Botao>
            </div>
          </Cartao>

          <div aria-live="polite" className="space-y-4">
            {falta && (
              <Cartao><p className="font-medium">Dados insuficientes</p><p className="mt-1 text-sm text-muted-foreground">{falta}</p></Cartao>
            )}
            {erro && !carregando && (
              <div role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
                <p>{erro}</p>
                <Botao variante="contorno" className="mt-3" onClick={enviar}>Tentar novamente</Botao>
              </div>
            )}
            {carregando && (
              <Cartao>
                <p className="sr-only" role="status">Analisando dados…</p>
                <div className="space-y-2"><Skeleton className="h-5 w-40" /><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-5/6" /><Skeleton className="h-4 w-2/3" /></div>
              </Cartao>
            )}
            {!gerado && !carregando && !erro && !falta && (
              <Cartao className="border-dashed text-sm text-muted-foreground">
                Escolha o período, escreva uma pergunta ou use uma sugestão e clique em “Gerar análise”. O resultado aparece aqui, separado em panorama, pontos de atenção, oportunidades e próximas ações.
              </Cartao>
            )}
            {gerado && !carregando && <Resultado g={gerado} desatualizado={!!desatualizado} />}
          </div>
        </div>

        <aside className="space-y-4">
          <Cartao>
            <h3 className="font-display text-base font-semibold uppercase">Base da análise</h3>
            <ul className="mt-3 space-y-2 text-sm">
              <li><span className="text-muted-foreground">Escopo:</span> todas as organizações · {ROTULO_PERIODO[periodo]}</li>
              <li><span className="text-muted-foreground">Volume:</span> {resumo.totalEventos} eventos, {resumo.totalInscricoes} inscrições</li>
              <li><span className="text-muted-foreground">Fontes:</span> eventos, inscrições, modalidades e estados</li>
              <li><span className="text-muted-foreground">Atualização:</span> {atualizado.toLocaleString("pt-BR")}</li>
            </ul>
            <p className="mt-3 text-xs text-muted-foreground">
              Limitações: dados de demonstração; sem visitas por evento nem distância; receitas não são enviadas.
            </p>
            <Botao variante="contorno" className="mt-4 w-full" onClick={() => setPainel(true)}>Ver dados da análise</Botao>
          </Cartao>
          <Cartao className="text-xs text-muted-foreground">
            Ao gerar, o resumo agregado (sem nomes, e-mails ou CPF) é enviado ao Lovable AI e não é armazenado.
          </Cartao>
        </aside>
      </div>

      {painel && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/60" onClick={() => setPainel(false)} onKeyDown={(e) => e.key === "Escape" && setPainel(false)}>
          <div
            role="dialog" aria-modal="true" aria-label="Dados da análise"
            className="h-full w-full max-w-md overflow-y-auto border-l border-border bg-popover p-6 text-popover-foreground"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="font-display text-lg font-semibold uppercase">Dados da análise</h3>
              <Botao variante="fantasma" autoFocus aria-label="Fechar" onClick={() => setPainel(false)}>✕</Botao>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">Destino ao gerar: Lovable AI. Somente estes campos agregados são enviados.</p>
            <h4 className="mt-4 text-sm font-semibold">Inscrições por modalidade</h4>
            <ul className="mt-1 text-sm">{Object.entries(resumo.inscricoesPorModalidade).map(([k, v]) => <li key={k}>{k}: {v}</li>)}</ul>
            <h4 className="mt-4 text-sm font-semibold">Inscrições por estado</h4>
            <ul className="mt-1 text-sm">{Object.entries(resumo.inscricoesPorUf).map(([k, v]) => <li key={k}>{k}: {v}</li>)}</ul>
            <h4 className="mt-4 text-sm font-semibold">Eventos</h4>
            <ul className="mt-1 space-y-1 text-sm">{resumo.eventos.map((e) => <li key={e.nome + e.data}>{e.nome} — {e.cidade} · {e.modalidade} · ocupação {e.ocupacaoPct}%</li>)}</ul>
            <details className="mt-4 text-xs">
              <summary className="cursor-pointer py-1 font-medium">Detalhes técnicos (JSON)</summary>
              <pre className="mt-2 whitespace-pre-wrap break-words rounded bg-muted p-2">{JSON.stringify(resumo, null, 2)}</pre>
            </details>
          </div>
        </div>
      )}
    </div>
  );
}

function Resultado({ g, desatualizado }: { g: Gerado; desatualizado: boolean }) {
  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        Gerada em {g.em.toLocaleString("pt-BR")} · {ROTULO_PERIODO[g.periodo]} · {g.pergunta ? `Pergunta: “${g.pergunta}”` : "Panorama geral"}
      </p>
      {desatualizado && (
        <p className="rounded-md border border-warning/50 bg-warning/10 px-3 py-2 text-sm">
          Esta análise se refere ao período “{ROTULO_PERIODO[g.periodo]}”. Gere novamente para o período atual.
        </p>
      )}
      {g.resultado.secoes.map((s) => (
        <Cartao key={s.titulo} className={s.titulo === "Pontos de atenção" ? "border-l-4 border-l-warning" : ""}>
          <h3 className="font-display text-base font-semibold uppercase">{s.titulo}</h3>
          {s.texto.map((t, i) => <p key={i} className="mt-2 text-sm leading-relaxed">{t}</p>)}
          {s.achados.length > 0 && (
            <ul className="mt-3 space-y-3">
              {s.achados.map((a, i) => (
                <li key={i} className="rounded-md border border-border p-3 text-sm">
                  <p><span className="font-medium">Observado:</span> {a.observado}</p>
                  {a.evidencia && <p className="mt-1 text-muted-foreground"><span className="font-medium text-foreground">Evidência:</span> {a.evidencia}</p>}
                  {a.acao && <p className="mt-1"><span className="font-medium">Ação sugerida:</span> {a.acao}</p>}
                </li>
              ))}
            </ul>
          )}
          {LINKS[s.titulo] && <Link to={LINKS[s.titulo]!.to} className="mt-3 inline-block text-sm font-medium text-primary underline-offset-2 hover:underline">{LINKS[s.titulo]!.rotulo} →</Link>}
        </Cartao>
      ))}
    </div>
  );
}
