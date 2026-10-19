import { ChevronRight } from "lucide-react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { NativeSelect } from "@/components/ui/native-select";
import { Skeleton } from "@/components/ui/skeleton";
import { useVersaoBase } from "@/hooks/useVersaoBase";
import { analisar, resumoAtual } from "@/services/insights";
import { faltaDados, ROTULO_PERIODO, sugestoesDisponiveis, type PeriodoAnalise, type ResultadoAnalise } from "@/lib/insights";
import { Textarea } from "@/components/ui/textarea";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";

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
          <Badge variant="accent">Lovable AI</Badge>
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
          <Card>
            <h3 className="font-display text-lg font-semibold uppercase">O que você quer analisar?</h3>
            <div className="mt-4 grid gap-4 sm:grid-cols-[200px]">
              <Label className="space-y-1.5 text-sm font-medium text-inherit">
                <span>Período</span>
                <NativeSelect value={periodo} onChange={(e) => setPeriodo(e.target.value as PeriodoAnalise)}>
                  {Object.entries(ROTULO_PERIODO).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </NativeSelect>
              </Label>
            </div>
            <div className="mt-4">
              <Label htmlFor="pergunta" className="flex items-baseline gap-2 text-sm font-medium text-inherit">
                Sua pergunta <span className="text-xs font-normal text-muted-foreground">Opcional</span>
              </Label>
              <Textarea rows={2}
                id="pergunta"
                ref={campo}
                value={pergunta}
                maxLength={1000}
                onChange={(e) => setPergunta(e.target.value)}
                aria-describedby="pergunta-ajuda"
                placeholder="Ex.: Quais eventos estão com baixa ocupação e merecem mais divulgação?"
                className="mt-1.5 block min-h-[120px] w-full resize-y rounded-md border border-input bg-background px-4 py-3 text-base leading-relaxed text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:text-base"
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
                    <Button variant="plain" size="none"
                      key={s.id}
                      type="button"
                      onClick={() => { setPergunta(s.texto); campo.current?.focus(); }}
                      className="rounded-full border border-border px-3 py-1.5 text-left text-sm hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {s.texto}
                    </Button>
                  ))}
                </div>
              </div>
            )}
            <div className="mt-5 flex flex-wrap items-center gap-2">
              <Button onClick={enviar} disabled={carregando || !!falta} aria-busy={carregando}>
                {carregando ? "Analisando dados…" : "Gerar análise"}
              </Button>
              <Button variant="outline" onClick={() => setPainel(true)}>Ver dados da análise</Button>
            </div>
          </Card>

          <div aria-live="polite" className="space-y-4">
            {falta && (
              <Card><p className="font-medium">Dados insuficientes</p><p className="mt-1 text-sm text-muted-foreground">{falta}</p></Card>
            )}
            {erro && !carregando && (
              <div role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
                <p>{erro}</p>
                <Button variant="outline" className="mt-3" onClick={enviar}>Tentar novamente</Button>
              </div>
            )}
            {carregando && (
              <Card>
                <p className="sr-only" role="status">Analisando dados…</p>
                <div className="space-y-2"><Skeleton className="h-5 w-40" /><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-5/6" /><Skeleton className="h-4 w-2/3" /></div>
              </Card>
            )}
            {!gerado && !carregando && !erro && !falta && (
              <Card className="border-dashed text-sm text-muted-foreground">
                Escolha o período, escreva uma pergunta ou use uma sugestão e clique em “Gerar análise”. O resultado aparece aqui, separado em panorama, pontos de atenção, oportunidades e próximas ações.
              </Card>
            )}
            {gerado && !carregando && <Resultado g={gerado} desatualizado={!!desatualizado} />}
          </div>
        </div>

        <aside className="space-y-4">
          <Card>
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
            <Button variant="outline" className="mt-4 w-full" onClick={() => setPainel(true)}>Ver dados da análise</Button>
          </Card>
          <Card className="text-xs text-muted-foreground">
            Ao gerar, o resumo agregado (sem nomes, e-mails ou CPF) é enviado ao Lovable AI e não é armazenado.
          </Card>
        </aside>
      </div>

      <Sheet open={painel} onOpenChange={setPainel}>
        <SheetContent side="right" showCloseButton={false} className="block w-full overflow-y-auto sm:max-w-md">
            <div className="flex items-center justify-between">
              <SheetTitle className="uppercase">Dados da análise</SheetTitle>
              <SheetClose asChild><Button variant="ghost" aria-label="Fechar">✕</Button></SheetClose>
            </div>
            <SheetDescription className="mt-2">Destino ao gerar: Lovable AI. Somente estes campos agregados são enviados.</SheetDescription>
            <h4 className="mt-4 text-sm font-semibold">Inscrições por modalidade</h4>
            <ul className="mt-1 text-sm">{Object.entries(resumo.inscricoesPorModalidade).map(([k, v]) => <li key={k}>{k}: {v}</li>)}</ul>
            <h4 className="mt-4 text-sm font-semibold">Inscrições por estado</h4>
            <ul className="mt-1 text-sm">{Object.entries(resumo.inscricoesPorUf).map(([k, v]) => <li key={k}>{k}: {v}</li>)}</ul>
            <h4 className="mt-4 text-sm font-semibold">Eventos</h4>
            <ul className="mt-1 space-y-1 text-sm">{resumo.eventos.map((e) => <li key={e.nome + e.data}>{e.nome} — {e.cidade} · {e.modalidade} · ocupação {e.ocupacaoPct}%</li>)}</ul>
            <Collapsible className="mt-4 text-xs">
              <CollapsibleTrigger className="group inline-flex cursor-pointer items-center gap-1 py-1 font-medium"><ChevronRight aria-hidden="true" className="h-3 w-3 transition-transform group-data-[state=open]:rotate-90" />Detalhes técnicos (JSON)</CollapsibleTrigger>
              <CollapsibleContent>
                <pre className="mt-2 whitespace-pre-wrap break-words rounded bg-muted p-2">{JSON.stringify(resumo, null, 2)}</pre>
              </CollapsibleContent>
            </Collapsible>
        </SheetContent>
      </Sheet>
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
        <Card key={s.titulo} className={s.titulo === "Pontos de atenção" ? "border-l-4 border-l-warning" : ""}>
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
        </Card>
      ))}
    </div>
  );
}
