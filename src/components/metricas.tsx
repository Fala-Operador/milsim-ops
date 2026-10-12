// Painel de métricas por evento (organizador) e consolidado (admin). Somente dados agregados.
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { BaseDados, Evento } from "@/lib/domain/types";
import {
  ROTULO_ORIGEM, ROTULO_ORIGEM_CAMPANHA, agrupar, chaveOrigem, filtrar, indicadores, serieDiaria, variacao,
  type Campanha, type Filtro, type Indicadores, type OrigemAcesso, type OrigemCampanha, type RegistroAnalytics,
} from "@/lib/analytics";
import { regiaoDaUf } from "@/lib/divulgacao";
import { criarCampanha, linkCampanha, listarCampanhas, listarRegistros } from "@/services/analytics";
import { inscricoesAtivasDoEvento } from "@/services/inscricoes";
import { formatarDataHoraBR } from "@/lib/domain/money";
import { Badge, Botao, Cartao, Entrada, EstadoVazio, Selecao, Skeleton } from "@/components/ui";
import { baixarCsv, baixarPdf, montarRelatorio, nomeArquivo } from "@/lib/relatorioMetricas";

const DIA = 86400000;
const fmtN = (n: number) => n.toLocaleString("pt-BR");
const fmtP = (v: number | null) => (v === null ? "Sem dados suficientes" : `${v.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`);

export const AVISO_DEMO = "Métricas de demonstração: os dados deste navegador não representam acessos reais de outros dispositivos.";

function Indicador({ rotulo, valor, ajuda, anterior }: { rotulo: string; valor: string; ajuda: string; anterior?: ReactNode }) {
  return (
    <Cartao className="!p-4">
      <p className="text-xs text-muted-foreground">{rotulo}</p>
      <p className="mt-1 font-display text-2xl font-semibold">{valor}</p>
      {anterior}
      <p className="mt-1 text-[11px] leading-snug text-muted-foreground">{ajuda}</p>
    </Cartao>
  );
}

function Comparacao({ atual, anterior, ativo }: { atual: number; anterior: number; ativo: boolean }) {
  if (!ativo) return null;
  const v = variacao(atual, anterior);
  return (
    <p className="text-xs">
      {v === null ? <span className="text-muted-foreground">Sem base no período anterior</span>
        : <span className={v >= 0 ? "text-success" : "text-destructive"}>{v >= 0 ? "▲" : "▼"} {Math.abs(v).toFixed(1)}% vs. anterior ({fmtN(anterior)})</span>}
    </p>
  );
}

function Tabela({ cab, linhas, vazio = "Sem dados no período." }: { cab: string[]; linhas: ReactNode[][]; vazio?: string }) {
  if (!linhas.length) return <p className="text-sm text-muted-foreground">{vazio}</p>;
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-sm">
        <thead className="bg-secondary text-left"><tr>{cab.map((c) => <th key={c} className="px-3 py-2 font-medium">{c}</th>)}</tr></thead>
        <tbody>{linhas.map((l, i) => <tr key={i} className="border-t border-border">{l.map((v, j) => <td key={j} className="px-3 py-2">{v}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );
}

function Bloco({ titulo, children, nota }: { titulo: string; children: ReactNode; nota?: string }) {
  return (
    <section>
      <h3 className="font-display text-lg font-semibold uppercase">{titulo}</h3>
      {nota && <p className="mb-2 text-xs text-muted-foreground">{nota}</p>}
      <div className="mt-2">{children}</div>
    </section>
  );
}

interface Periodo { tipo: "7" | "30" | "tudo" | "custom"; de: string; ate: string }

function intervalo(p: Periodo, regs: RegistroAnalytics[], agora: number): { desde: number; ate: number } {
  if (p.tipo === "7" || p.tipo === "30") return { desde: agora - Number(p.tipo) * DIA, ate: agora };
  if (p.tipo === "custom" && p.de && p.ate) return { desde: new Date(`${p.de}T00:00:00`).getTime(), ate: new Date(`${p.ate}T23:59:59`).getTime() };
  const min = regs.reduce((m, r) => Math.min(m, r.em), agora);
  return { desde: min, ate: agora };
}

export function PainelMetricas({ base, eventos, modo }: { base: BaseDados; eventos: Evento[]; modo: "organizador" | "admin" }) {
  const [dados, setDados] = useState<{ regs: RegistroAnalytics[]; campanhas: Campanha[]; em: number } | null>(null);
  const recarregar = () => setDados({ regs: listarRegistros(), campanhas: listarCampanhas(), em: Date.now() });
  useEffect(recarregar, []);
  const [eventoId, setEventoId] = useState(modo === "admin" ? "todos" : (eventos[0]?.id ?? ""));
  const [periodo, setPeriodo] = useState<Periodo>({ tipo: "30", de: "", ate: "" });
  const [origem, setOrigem] = useState("");
  const [comparar, setComparar] = useState(true);
  const [agrupamento, setAgrupamento] = useState<"regiao" | "uf" | "cidade">("regiao");

  const idsPermitidos = useMemo(() => new Set(eventos.map((e) => e.id)), [eventos]);
  const evAtual = eventos.find((e) => e.id === eventoId);

  if (!dados) return <Skeleton className="h-96 w-full" />;
  if (!eventos.length) return <EstadoVazio titulo="Nenhum evento para analisar" />;

  // Organizador nunca vê registros de eventos de outras organizações.
  const todos = dados.regs.filter((r) => idsPermitidos.has(r.eventoId));
  const eventoIds = eventoId === "todos" ? idsPermitidos : new Set([eventoId]);
  const { desde, ate } = intervalo(periodo, todos, dados.em);
  const duracao = Math.max(DIA, ate - desde);
  const filtro: Filtro = { eventoIds, desde, ate, origem: origem || undefined };
  const regs = filtrar(todos, filtro);
  const anteriores = filtrar(todos, { ...filtro, desde: desde - duracao, ate: desde - 1 });
  const ind = indicadores(regs, todos);
  const indAnt = indicadores(anteriores, todos);
  const comp = comparar && periodo.tipo !== "tudo";
  const ativasAgora = [...eventoIds].reduce((t, id) => t + inscricoesAtivasDoEvento(base, id).length, 0);
  const campanhasVisiveis = dados.campanhas.filter((c) => eventoIds.has(c.eventoId));
  const nomeEvento = (id: string) => base.eventos.find((e) => e.id === id)?.nome ?? id;
  const nomeOrigem = (k: string) => k.startsWith("cmp:")
    ? `Campanha: ${dados.campanhas.find((c) => c.id === k.slice(4))?.nome ?? "removida"}`
    : ROTULO_ORIGEM[k as OrigemAcesso] ?? k;
  const nomeSecao = (id: string) => base.secoesInicio.find((s) => s.id === id)?.titulo ?? "Seção removida";
  const serie = serieDiaria(regs, desde, ate);

  const porOrigem = agrupar(regs, todos, chaveOrigem).sort((a, b) => b.ind.visitas - a.ind.visitas);
  const porSecao = agrupar(regs, todos, (r) => r.secaoId).sort((a, b) => b.ind.cliques - a.ind.cliques);
  const evPorId = new Map(base.eventos.map((e) => [e.id, e]));
  const linhaComVolume = (i: Indicadores) => [fmtN(i.visitas), fmtN(i.visitantes), fmtN(i.confirmadas), <>{fmtP(i.conversao)} <span className="text-xs text-muted-foreground">({fmtN(i.confirmadas)} de {fmtN(i.visitantes)})</span></>];
  const rotEvento = eventoId === "todos" ? "Todos os eventos" : (evAtual?.nome ?? eventoId);
  const fmtD = (t: number) => new Date(t).toLocaleDateString("pt-BR");
  const relatorio = () => montarRelatorio({
    evento: rotEvento, periodo: `${fmtD(desde)} a ${fmtD(ate)}`, origem: origem ? nomeOrigem(origem) : "Todas", ind,
    porOrigem, porSecao, porEvento: agrupar(regs, todos, (r) => r.eventoId).sort((a, b) => b.ind.visitas - a.ind.visitas),
    nomeOrigem, nomeSecao, nomeEvento, geradoEm: new Date().toLocaleString("pt-BR"),
  });

  return (
    <div className="space-y-8">
      <p className="rounded-md border border-border bg-secondary px-3 py-2 text-xs">{AVISO_DEMO}</p>

      <div className="flex flex-wrap items-end gap-3">
        <label className="text-sm"><span className="mb-1 block text-xs text-muted-foreground">Evento</span>
          <Selecao value={eventoId} onChange={(e) => { setEventoId(e.target.value); setOrigem(""); }}>
            {modo === "admin" && <option value="todos">Todos os eventos</option>}
            {eventos.map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}
          </Selecao>
        </label>
        <label className="text-sm"><span className="mb-1 block text-xs text-muted-foreground">Período</span>
          <Selecao value={periodo.tipo} onChange={(e) => setPeriodo({ ...periodo, tipo: e.target.value as Periodo["tipo"] })}>
            <option value="7">Últimos 7 dias</option><option value="30">Últimos 30 dias</option>
            <option value="tudo">Todo o período</option><option value="custom">Intervalo personalizado</option>
          </Selecao>
        </label>
        {periodo.tipo === "custom" && (
          <>
            <label className="text-sm"><span className="mb-1 block text-xs text-muted-foreground">De</span><Entrada type="date" value={periodo.de} onChange={(e) => setPeriodo({ ...periodo, de: e.target.value })} /></label>
            <label className="text-sm"><span className="mb-1 block text-xs text-muted-foreground">Até</span><Entrada type="date" value={periodo.ate} onChange={(e) => setPeriodo({ ...periodo, ate: e.target.value })} /></label>
          </>
        )}
        <label className="text-sm"><span className="mb-1 block text-xs text-muted-foreground">Origem ou campanha</span>
          <Selecao value={origem} onChange={(e) => setOrigem(e.target.value)}>
            <option value="">Todas</option>
            {Object.entries(ROTULO_ORIGEM).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            {campanhasVisiveis.map((c) => <option key={c.id} value={`cmp:${c.id}`}>Campanha: {c.nome}</option>)}
          </Selecao>
        </label>
        <label className="flex items-center gap-2 pb-2 text-sm"><input type="checkbox" checked={comparar} onChange={(e) => setComparar(e.target.checked)} /> Comparar com período anterior</label>
        <div className="ml-auto text-right text-xs text-muted-foreground">
          Última atualização: {formatarDataHoraBR(new Date(dados.em).toISOString())}
          <div className="mt-1 flex justify-end gap-2">
            <Botao variante="contorno" className="!py-1" onClick={() => baixarCsv(relatorio(), nomeArquivo(rotEvento, "csv"))}>Exportar CSV</Botao>
            <Botao variante="contorno" className="!py-1" onClick={() => void baixarPdf(relatorio(), nomeArquivo(rotEvento, "pdf"))}>Exportar PDF</Botao>
            <Botao variante="contorno" className="!py-1" onClick={recarregar}>Atualizar</Botao>
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Indicador rotulo="Exibições dos cards" valor={fmtN(ind.exibicoes)} ajuda="Card com ao menos 50% visível por 1 segundo." anterior={<Comparacao ativo={comp} atual={ind.exibicoes} anterior={indAnt.exibicoes} />} />
        <Indicador rotulo="Cliques nos cards" valor={fmtN(ind.cliques)} ajuda="Cliques em cards da plataforma que levaram ao evento." anterior={<Comparacao ativo={comp} atual={ind.cliques} anterior={indAnt.cliques} />} />
        <Indicador rotulo="Visitas à página" valor={fmtN(ind.visitas)} ajuda="Acessos à página do evento, inclusive links diretos. Recarregar conta nova visita." anterior={<Comparacao ativo={comp} atual={ind.visitas} anterior={indAnt.visitas} />} />
        <Indicador rotulo="Visitantes únicos estimados" valor={fmtN(ind.visitantes)} ajuda="Estimativa por navegador/dispositivo, não identifica pessoas." anterior={<Comparacao ativo={comp} atual={ind.visitantes} anterior={indAnt.visitantes} />} />
        <Indicador rotulo="Cliques em “Inscrever-se”" valor={fmtN(ind.cliquesInscrever)} ajuda="Cliques no botão da página do evento." />
        <Indicador rotulo="Inscrições iniciadas" valor={fmtN(ind.iniciadas)} ajuda="Formulário de inscrição efetivamente aberto." />
        <Indicador rotulo="Inscrições confirmadas" valor={fmtN(ind.confirmadas)} ajuda={`Confirmadas no período pelo fluxo público. Ativas agora: ${fmtN(ativasAgora)} (cancelamentos não apagam o histórico).`} anterior={<Comparacao ativo={comp} atual={ind.confirmadas} anterior={indAnt.confirmadas} />} />
        <Indicador rotulo="Cortesias e inclusões" valor={`${fmtN(ind.cortesias)} / ${fmtN(ind.inclusoes)}`} ajuda="Cortesias resgatadas / inclusões administrativas — fora da conversão pública." />
        <Indicador rotulo="CTR dos cards" valor={fmtP(ind.ctr)} ajuda="Cliques nos cards ÷ exibições dos cards × 100." />
        <Indicador rotulo="Conversão de visitantes" valor={fmtP(ind.conversao)} ajuda="Visitantes com inscrição confirmada ÷ visitantes únicos estimados × 100." />
        <Indicador rotulo="Conclusão da inscrição" valor={fmtP(ind.conclusao)} ajuda="Fluxos concluídos ÷ fluxos iniciados no período × 100." />
      </div>

      <Bloco titulo="Visitas e cliques ao longo do tempo">
        <div className="h-64 rounded-lg border border-border bg-card p-2">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={serie}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="dia" fontSize={11} stroke="var(--muted-foreground)" />
              <YAxis allowDecimals={false} fontSize={11} stroke="var(--muted-foreground)" />
              <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", color: "var(--popover-foreground)" }} />
              <Legend />
              <Bar dataKey="visitas" name="Visitas" fill="var(--primary)" />
              <Bar dataKey="cliques" name="Cliques nos cards" fill="var(--accent)" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Bloco>

      <Bloco titulo="Funil de inscrição" nota="Fluxos iniciados no período e suas conclusões até agora.">
        <div className="space-y-2">
          {[
            ["Visitas à página", ind.visitas],
            ["Cliques em “Inscrever-se”", ind.cliquesInscrever],
            ["Inscrições iniciadas", ind.iniciadas],
            ["Concluídas", ind.concluidas],
            ["Não concluídos até o momento", ind.naoConcluidos],
          ].map(([r, v]) => (
            <div key={r as string} className="flex items-center gap-3 text-sm">
              <span className="w-56 shrink-0">{r}</span>
              <div className="h-3 flex-1 rounded bg-secondary"><div className="h-3 rounded bg-primary" style={{ width: `${ind.visitas ? Math.min(100, ((v as number) / ind.visitas) * 100) : 0}%` }} /></div>
              <span className="w-12 text-right">{fmtN(v as number)}</span>
            </div>
          ))}
        </div>
      </Bloco>

      <Bloco titulo="Origens e campanhas" nota="“Origem desconhecida” é mantida quando não há como identificar a procedência.">
        <Tabela cab={["Origem", "Visitas", "Iniciadas", "Confirmadas", "Conclusão"]}
          linhas={porOrigem.map((g) => [nomeOrigem(g.chave), fmtN(g.ind.visitas), fmtN(g.ind.iniciadas), fmtN(g.ind.confirmadas), fmtP(g.ind.conclusao)])} />
      </Bloco>

      <Bloco titulo="Desempenho por seção de divulgação">
        <Tabela cab={["Seção", "Exibições", "Cliques", "CTR", "Visitas", "Confirmadas"]}
          linhas={porSecao.map((g) => [nomeSecao(g.chave), fmtN(g.ind.exibicoes), fmtN(g.ind.cliques), fmtP(g.ind.ctr), fmtN(g.ind.visitas), fmtN(g.ind.confirmadas)])} />
      </Bloco>

      {evAtual && <Campanhas evento={evAtual} campanhas={dados.campanhas.filter((c) => c.eventoId === evAtual.id)} regs={todos} onCriada={recarregar} />}

      {modo === "admin" && eventoId === "todos" && (() => {
        const porEvento = agrupar(regs, todos, (r) => r.eventoId);
        const top = (f: (i: Indicadores) => number, filtroMin = 0) => porEvento.filter((g) => g.ind.visitantes >= filtroMin).sort((a, b) => f(b.ind) - f(a.ind)).slice(0, 5);
        const org = agrupar(regs, todos, (r) => { const e = evPorId.get(r.eventoId); return e ? base.organizacoes.find((o) => o.id === e.organizacaoId)?.nome ?? e.organizacaoId : undefined; });
        const geo = agrupar(regs, todos, (r) => {
          const e = evPorId.get(r.eventoId); if (!e) return undefined;
          return agrupamento === "regiao" ? regiaoDaUf(e.uf) ?? "—" : agrupamento === "uf" ? e.uf : `${e.cidade}/${e.uf}`;
        }).sort((a, b) => b.ind.visitas - a.ind.visitas);
        const cab = ["Visitas", "Visitantes", "Confirmadas", "Conversão (volume)"];
        return (
          <>
            <div className="grid gap-6 lg:grid-cols-3">
              <Bloco titulo="Mais visitas"><Tabela cab={["Evento", "Visitas"]} linhas={top((i) => i.visitas).map((g) => [nomeEvento(g.chave), fmtN(g.ind.visitas)])} /></Bloco>
              <Bloco titulo="Mais inscrições"><Tabela cab={["Evento", "Confirmadas"]} linhas={top((i) => i.confirmadas).map((g) => [nomeEvento(g.chave), fmtN(g.ind.confirmadas)])} /></Bloco>
              <Bloco titulo="Maior conversão" nota="Só eventos com 10+ visitantes, para evitar comparações enganosas.">
                <Tabela cab={["Evento", "Conversão"]} linhas={top((i) => i.conversao ?? -1, 10).map((g) => [nomeEvento(g.chave), <>{fmtP(g.ind.conversao)} <span className="text-xs text-muted-foreground">({g.ind.confirmadas}/{g.ind.visitantes})</span></>])} />
              </Bloco>
            </div>
            <Bloco titulo="Comparação entre organizações"><Tabela cab={["Organização", ...cab]} linhas={org.map((g) => [g.chave, ...linhaComVolume(g.ind)])} /></Bloco>
            <Bloco titulo="Comparação por localização do evento" nota="O filtro usa a localização do evento, não a localização física dos visitantes.">
              <div className="mb-2 flex gap-1">
                {(["regiao", "uf", "cidade"] as const).map((a) => <Botao key={a} variante={agrupamento === a ? "primario" : "contorno"} onClick={() => setAgrupamento(a)}>{a === "regiao" ? "Região" : a === "uf" ? "Estado" : "Cidade"}</Botao>)}
              </div>
              <Tabela cab={["Local", ...cab]} linhas={geo.map((g) => [g.chave, ...linhaComVolume(g.ind)])} />
            </Bloco>
          </>
        );
      })()}

      <p className="text-xs text-muted-foreground">
        Privacidade: os painéis mostram apenas números agregados, sem lista de quem visitou, clicou ou iniciou inscrição. Os registros usam
        identificadores aleatórios e não guardam nome, e-mail, CPF, telefone, endereço, exército, pagamento ou textos digitados. A coleta real,
        sua base legal, retenção e consentimento precisam ser definidos antes da produção.
      </p>
    </div>
  );
}

function Campanhas({ evento, campanhas, regs, onCriada }: { evento: Evento; campanhas: Campanha[]; regs: RegistroAnalytics[]; onCriada: () => void }) {
  const [nome, setNome] = useState("");
  const [origem, setOrigem] = useState<OrigemCampanha>("instagram");
  const [erro, setErro] = useState("");
  const [copiado, setCopiado] = useState("");
  return (
    <Bloco titulo="Links de divulgação" nota="A origem identifica a campanha: um link criado para Instagram pode ser compartilhado em outro canal.">
      <div className="flex flex-wrap items-end gap-2">
        <Entrada aria-label="Nome da campanha" placeholder="Nome (ex.: Lançamento)" value={nome} onChange={(e) => setNome(e.target.value)} className="!w-64" />
        <Selecao aria-label="Origem da campanha" value={origem} onChange={(e) => setOrigem(e.target.value as OrigemCampanha)}>
          {Object.entries(ROTULO_ORIGEM_CAMPANHA).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </Selecao>
        <Botao onClick={() => { setErro(""); try { criarCampanha(evento.id, nome, origem); setNome(""); onCriada(); } catch (e) { setErro((e as Error).message); } }}>Criar link</Botao>
      </div>
      {erro && <p role="alert" className="mt-1 text-sm text-destructive">{erro}</p>}
      <div className="mt-3">
        <Tabela vazio="Nenhuma campanha para este evento."
          cab={["Campanha", "Origem", "Visitas", "Inscrições", "Link"]}
          linhas={campanhas.map((c) => {
            const r = regs.filter((x) => x.campanhaId === c.id);
            return [c.nome, <Badge key="b">{ROTULO_ORIGEM_CAMPANHA[c.origem]}</Badge>, fmtN(r.filter((x) => x.tipo === "visita").length), fmtN(r.filter((x) => x.tipo === "inscricao_confirmada").length),
              <Botao key="c" variante="contorno" className="!py-1" onClick={async () => { await navigator.clipboard?.writeText(linkCampanha(c)); setCopiado(c.id); }}>{copiado === c.id ? "Copiado!" : "Copiar link"}</Botao>];
          })} />
      </div>
    </Bloco>
  );
}
