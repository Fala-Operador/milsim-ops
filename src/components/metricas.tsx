// Painel de métricas por evento (organizador) e consolidado (admin). Somente dados agregados.
import { nomeModalidade } from "@/lib/modalidades";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { BaseDados, Evento } from "@/lib/domain/types";
import {
  ROTULO_ORIGEM, ROTULO_ORIGEM_CAMPANHA, agrupar, chaveOrigem, filtrar, indicadores, resumoVendas, serieDiaria, variacao,
  type Campanha, type Filtro, type Indicadores, type OrigemAcesso, type OrigemCampanha, type RegistroAnalytics,
} from "@/lib/analytics";
import { regiaoDaUf, rotuloAbrangencia } from "@/lib/divulgacao";
import { ROTULO_OBJETIVO, metricasCampanha, rotuloPosicao, statusExibido } from "@/lib/impulsionamento";
import { StatusImpulsionamento } from "@/components/impulsionamentos";
import { linkCampanha } from "@/services/analytics";
import { criarCampanha, listarMetricas } from "@/api/analytics.functions";
import { inscricoesAtivasDoEvento } from "@/services/inscricoes";
import { formatarBRL, formatarDataBR, formatarDataHoraBR } from "@/lib/domain/money";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Skeleton } from "@/components/ui/skeleton";
import { EstadoVazio } from "@/components/ui";
import { baixarCsv, baixarPdf, montarRelatorio, nomeArquivo } from "@/lib/relatorioMetricas";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Label } from "@/components/ui/label";
import { tr } from "@/i18n/components/metricas";
import { localeAtual } from "@/i18n/dicionario";

const DIA = 86400000;
const fmtN = (n: number) => n.toLocaleString(localeAtual());
const fmtP = (v: number | null) => (v === null ? tr("sem_dados_suficientes") : `${v.toLocaleString(localeAtual(), { maximumFractionDigits: 1 })}%`);

export const AVISO_METRICAS = () => tr("aviso_metricas");

function Indicador({ rotulo, valor, ajuda, anterior }: { rotulo: string; valor: string; ajuda: string; anterior?: ReactNode }) {
  return (
    <Card className="!p-4">
      <p className="text-xs text-muted-foreground">{rotulo}</p>
      <p className="mt-1 font-display text-2xl font-semibold">{valor}</p>
      {anterior}
      <p className="mt-1 text-[11px] leading-snug text-muted-foreground">{ajuda}</p>
    </Card>
  );
}

function Comparacao({ atual, anterior, ativo }: { atual: number; anterior: number; ativo: boolean }) {
  if (!ativo) return null;
  const v = variacao(atual, anterior);
  return (
    <p className="text-xs">
      {v === null ? <span className="text-muted-foreground">{tr("sem_base_no_periodo_anterior")}</span>
        : <span className={v >= 0 ? "text-success" : "text-destructive"}>{v >= 0 ? "▲" : "▼"} {tr("valor_vs_anterior_anterior", { valor: Math.abs(v).toFixed(1), anterior: fmtN(anterior) })}</span>}
    </p>
  );
}

function Tabela({ cab, linhas, vazio = tr("sem_dados_no_periodo") }: { cab: string[]; linhas: ReactNode[][]; vazio?: string }) {
  if (!linhas.length) return <p className="text-sm text-muted-foreground">{vazio}</p>;
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <Table className="w-full text-sm">
        <TableHeader className="bg-secondary text-left"><TableRow>{cab.map((c) => <TableHead key={c} className="px-3 py-2 font-medium">{c}</TableHead>)}</TableRow></TableHeader>
        <TableBody>{linhas.map((l, i) => <TableRow key={i} className="border-t border-border">{l.map((v, j) => <TableCell key={j} className="px-3 py-2">{v}</TableCell>)}</TableRow>)}</TableBody>
      </Table>
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
  const [erroCarga, setErroCarga] = useState("");
  const recarregar = () => {
    listarMetricas()
      .then((r) => setDados({ regs: r.registros, campanhas: r.campanhas, em: Date.now() }))
      .catch((e) => setErroCarga(e instanceof Error ? e.message : tr("falha_ao_carregar_as_metricas")));
  };
  useEffect(recarregar, []);
  const [eventoId, setEventoId] = useState(modo === "admin" ? "todos" : (eventos[0]?.id ?? ""));
  const [periodo, setPeriodo] = useState<Periodo>({ tipo: "30", de: "", ate: "" });
  const [origem, setOrigem] = useState("");
  const [comparar, setComparar] = useState(true);
  const [agrupamento, setAgrupamento] = useState<"regiao" | "uf" | "cidade">("regiao");

  const idsPermitidos = useMemo(() => new Set(eventos.map((e) => e.id)), [eventos]);
  const evAtual = eventos.find((e) => e.id === eventoId);

  if (erroCarga && !dados) return <EstadoVazio titulo={tr("metricas_indisponiveis")} descricao={erroCarga} />;
  if (!dados) return <Skeleton className="h-96 w-full" />;
  if (!eventos.length) return <EstadoVazio titulo={tr("nenhum_evento_para_analisar")} />;

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
  const vendas = resumoVendas(base.inscricoes, { eventoIds, desde, ate });
  const vendasAnt = resumoVendas(base.inscricoes, { eventoIds, desde: desde - duracao, ate: desde - 1 });
  const ativasAgora = [...eventoIds].reduce((t, id) => t + inscricoesAtivasDoEvento(base, id).length, 0);
  const campanhasVisiveis = dados.campanhas.filter((c) => eventoIds.has(c.eventoId));
  const nomeEvento = (id: string) => base.eventos.find((e) => e.id === id)?.nome ?? id;
  const nomeImp = (id: string) => {
    const c = base.impulsionamentos.find((x) => x.id === id);
    return c ? tr("impulsionamento_valor", { valor: modo === "admin" && c.nome ? c.nome : ROTULO_OBJETIVO[c.objetivo] }) : null;
  };
  const impulsos = base.impulsionamentos.filter((c) => eventoIds.has(c.eventoId) && c.status !== "rascunho")
    .sort((a, b) => b.inicioEm.localeCompare(a.inicioEm));
  const nomeOrigem = (k: string) => k.startsWith("cmp:") && nomeImp(k.slice(4))
    ? nomeImp(k.slice(4))!
    : k.startsWith("cmp:")
    ? tr("campanha_valor", { valor: dados.campanhas.find((c) => c.id === k.slice(4))?.nome ?? "removida" })
    : ROTULO_ORIGEM[k as OrigemAcesso] ?? k;
  const nomeSecao = (id: string) => base.secoesInicio.find((s) => s.id === id)?.titulo ?? tr("secao_removida");
  const serie = serieDiaria(regs, desde, ate);

  const porOrigem = agrupar(regs, todos, chaveOrigem).sort((a, b) => b.ind.visitas - a.ind.visitas);
  const porSecao = agrupar(regs, todos, (r) => r.secaoId).sort((a, b) => b.ind.cliques - a.ind.cliques);
  const evPorId = new Map(base.eventos.map((e) => [e.id, e]));
  const linhaComVolume = (i: Indicadores) => [fmtN(i.visitas), fmtN(i.visitantes), fmtN(i.confirmadas), <>{fmtP(i.conversao)} <span className="text-xs text-muted-foreground">{tr("confirmadas_de_visitantes", { confirmadas: fmtN(i.confirmadas), visitantes: fmtN(i.visitantes) })}</span></>];
  const rotEvento = eventoId === "todos" ? tr("todos_os_eventos") : (evAtual?.nome ?? eventoId);
  const fmtD = (t: number) => new Date(t).toLocaleDateString(localeAtual());
  const relatorio = () => montarRelatorio({
    evento: rotEvento, periodo: `${fmtD(desde)} a ${fmtD(ate)}`, origem: origem ? nomeOrigem(origem) : tr("todas"), ind,
    porOrigem, porSecao, porEvento: agrupar(regs, todos, (r) => r.eventoId).sort((a, b) => b.ind.visitas - a.ind.visitas),
    nomeOrigem, nomeSecao, nomeEvento, geradoEm: new Date().toLocaleString(localeAtual()),
  });

  return (
    <div className="space-y-8">
      <p className="rounded-md border border-border bg-secondary px-3 py-2 text-xs">{AVISO_METRICAS()}</p>

      <div className="flex flex-wrap items-end gap-3">
        <Label className="text-sm font-normal text-inherit"><span className="mb-1 block text-xs text-muted-foreground">{tr("evento")}</span>
          <NativeSelect value={eventoId} onChange={(e) => { setEventoId(e.target.value); setOrigem(""); }}>
            {modo === "admin" && <option value="todos">{tr("todos_os_eventos")}</option>}
            {eventos.map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}
          </NativeSelect>
        </Label>
        <Label className="text-sm font-normal text-inherit"><span className="mb-1 block text-xs text-muted-foreground">{tr("periodo")}</span>
          <NativeSelect value={periodo.tipo} onChange={(e) => setPeriodo({ ...periodo, tipo: e.target.value as Periodo["tipo"] })}>
            <option value="7">{tr("ultimos_7_dias")}</option><option value="30">{tr("ultimos_30_dias")}</option>
            <option value="tudo">{tr("todo_o_periodo")}</option><option value="custom">{tr("intervalo_personalizado")}</option>
          </NativeSelect>
        </Label>
        {periodo.tipo === "custom" && (
          <>
            <Label className="text-sm font-normal text-inherit"><span className="mb-1 block text-xs text-muted-foreground">{tr("de")}</span><Input type="date" value={periodo.de} onChange={(e) => setPeriodo({ ...periodo, de: e.target.value })} /></Label>
            <Label className="text-sm font-normal text-inherit"><span className="mb-1 block text-xs text-muted-foreground">{tr("ate")}</span><Input type="date" value={periodo.ate} onChange={(e) => setPeriodo({ ...periodo, ate: e.target.value })} /></Label>
          </>
        )}
        <Label className="text-sm font-normal text-inherit"><span className="mb-1 block text-xs text-muted-foreground">{tr("origem_ou_campanha")}</span>
          <NativeSelect value={origem} onChange={(e) => setOrigem(e.target.value)}>
            <option value="">{tr("todas")}</option>
            {Object.entries(ROTULO_ORIGEM).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            {campanhasVisiveis.map((c) => <option key={c.id} value={`cmp:${c.id}`}>{tr("campanha_nome", { nome: c.nome })}</option>)}
          </NativeSelect>
        </Label>
        <Label className="flex items-center gap-2 pb-2 text-sm font-normal text-inherit"><Checkbox checked={comparar} onCheckedChange={(marcado) => setComparar(marcado === true)} />{" "}{tr("comparar_com_periodo_anterior")}</Label>
        <div className="ml-auto text-right text-xs text-muted-foreground">{tr("ultima_atualizacao_valor", { valor: formatarDataHoraBR(new Date(dados.em).toISOString()) })}
          <div className="mt-1 flex justify-end gap-2">
            <Button variant="outline" className="!py-1" onClick={() => baixarCsv(relatorio(), nomeArquivo(rotEvento, "csv"))}>{tr("exportar_csv")}</Button>
            <Button variant="outline" className="!py-1" onClick={() => void baixarPdf(relatorio(), nomeArquivo(rotEvento, "pdf"))}>{tr("exportar_pdf")}</Button>
            <Button variant="outline" className="!py-1" onClick={recarregar}>{tr("atualizar")}</Button>
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Indicador rotulo={tr("exibicoes_dos_cards")} valor={fmtN(ind.exibicoes)} ajuda={tr("card_com_ao_menos_50_visivel")} anterior={<Comparacao ativo={comp} atual={ind.exibicoes} anterior={indAnt.exibicoes} />} />
        <Indicador rotulo={tr("cliques_nos_cards")} valor={fmtN(ind.cliques)} ajuda={tr("cliques_em_cards_da_plataforma_que")} anterior={<Comparacao ativo={comp} atual={ind.cliques} anterior={indAnt.cliques} />} />
        <Indicador rotulo={tr("visitas_a_pagina")} valor={fmtN(ind.visitas)} ajuda={tr("acessos_a_pagina_do_evento_inclusive")} anterior={<Comparacao ativo={comp} atual={ind.visitas} anterior={indAnt.visitas} />} />
        <Indicador rotulo={tr("visitantes_unicos_estimados")} valor={fmtN(ind.visitantes)} ajuda={tr("estimativa_por_navegador_dispositivo_nao")} anterior={<Comparacao ativo={comp} atual={ind.visitantes} anterior={indAnt.visitantes} />} />
        <Indicador rotulo={tr("cliques_em_inscrever_se")} valor={fmtN(ind.cliquesInscrever)} ajuda={tr("cliques_no_botao_da_pagina_do")} />
        <Indicador rotulo={tr("inscricoes_iniciadas")} valor={fmtN(ind.iniciadas)} ajuda={tr("formulario_de_inscricao_efetivamente_abe")} />
        <Indicador rotulo={tr("inscricoes_confirmadas")} valor={fmtN(ind.confirmadas)} ajuda={tr("confirmadas_no_periodo_pelo_fluxo_public", { ativasAgora: fmtN(ativasAgora) })} anterior={<Comparacao ativo={comp} atual={ind.confirmadas} anterior={indAnt.confirmadas} />} />
        <Indicador rotulo={tr("cortesias_e_inclusoes")} valor={`${fmtN(ind.cortesias)} / ${fmtN(ind.inclusoes)}`} ajuda={tr("cortesias_resgatadas_inclusoes_administr")} />
        <Indicador rotulo={tr("ctr_dos_cards")} valor={fmtP(ind.ctr)} ajuda={tr("cliques_nos_cards_exibicoes_dos_cards")} />
        <Indicador rotulo={tr("conversao_de_visitantes")} valor={fmtP(ind.conversao)} ajuda={tr("visitantes_com_inscricao_confirmada_visi")} />
        <Indicador rotulo={tr("conclusao_da_inscricao")} valor={fmtP(ind.conclusao)} ajuda={tr("fluxos_concluidos_fluxos_iniciados_no_pe")} />
        <Indicador rotulo={tr("receita_confirmada")} valor={formatarBRL(vendas.receitaCentavos)} ajuda={tr("valor_das_inscricoes_confirmadas_no_peri")} anterior={<Comparacao ativo={comp} atual={vendas.receitaCentavos} anterior={vendasAnt.receitaCentavos} />} />
        <Indicador rotulo={tr("ticket_medio")} valor={vendas.ticketMedioCentavos === null ? "—" : formatarBRL(vendas.ticketMedioCentavos)} ajuda={tr("receita_confirmada_pedidos_pedido_s_pago", { pedidos: fmtN(vendas.pedidos) })} />
        <Indicador rotulo={tr("pago_online_stripe")} valor={formatarBRL(vendas.pagoOnlineCentavos)} ajuda={tr("parte_da_receita_confirmada_paga_pelo")} />
      </div>

      <Bloco titulo={tr("visitas_e_cliques_ao_longo_do")}>
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

      <Bloco titulo={tr("funil_de_inscricao")} nota={tr("fluxos_iniciados_no_periodo_e_suas")}>
        <div className="space-y-2">
          {[
            [tr("visitas_a_pagina"), ind.visitas],
            [tr("cliques_em_inscrever_se"), ind.cliquesInscrever],
            [tr("inscricoes_iniciadas"), ind.iniciadas],
            [tr("concluidas"), ind.concluidas],
            [tr("nao_concluidos_ate_o_momento"), ind.naoConcluidos],
          ].map(([r, v]) => (
            <div key={r as string} className="flex items-center gap-3 text-sm">
              <span className="w-56 shrink-0">{r}</span>
              <div className="h-3 flex-1 rounded bg-secondary"><div className="h-3 rounded bg-primary" style={{ width: `${ind.visitas ? Math.min(100, ((v as number) / ind.visitas) * 100) : 0}%` }} /></div>
              <span className="w-12 text-right">{fmtN(v as number)}</span>
            </div>
          ))}
        </div>
      </Bloco>

      <Bloco titulo={tr("divulgacao_da_operacao")} nota={modo === "organizador"
        ? tr("destaques_concedidos_pela_administracao")
        : tr("campanhas_de_impulsionamento_numeros_do")}>
        <Tabela vazio={tr("nenhum_impulsionamento_para_este_evento")}
          cab={[tr("operacao"), tr("objetivo"), tr("onde_aparece"), tr("area"), tr("periodo"), tr("status"), tr("exibicoes"), tr("cliques"), "CTR", tr("visitas"), tr("inscricoes")]}
          linhas={impulsos.map((c) => {
            const m = metricasCampanha(regs, c.id);
            return [nomeEvento(c.eventoId), ROTULO_OBJETIVO[c.objetivo], c.posicoes.map((p) => rotuloPosicao(base, p)).join(", "),
              rotuloAbrangencia(c.abrangencia), `${formatarDataBR(c.inicioEm)} → ${formatarDataBR(c.fimEm)}`,
              <StatusImpulsionamento key="s" s={statusExibido(base, c, new Date())} />,
              fmtN(m.exibicoes), fmtN(m.cliques), fmtP(m.ctr), fmtN(m.visitas), fmtN(m.inscricoes)];
          })} />
      </Bloco>

      <Bloco titulo={tr("origens_e_campanhas")} nota={tr("origem_desconhecida_e_mantida_quando_nao")}>
        <Tabela cab={[tr("origem"), tr("visitas"), tr("iniciadas"), tr("confirmadas"), tr("conclusao")]}
          linhas={porOrigem.map((g) => [nomeOrigem(g.chave), fmtN(g.ind.visitas), fmtN(g.ind.iniciadas), fmtN(g.ind.confirmadas), fmtP(g.ind.conclusao)])} />
      </Bloco>

      <Bloco titulo={tr("desempenho_por_secao_de_divulgacao")}>
        <Tabela cab={[tr("secao"), tr("exibicoes"), tr("cliques"), "CTR", tr("visitas"), tr("confirmadas")]}
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
        const cab = [tr("visitas"), tr("visitantes"), tr("confirmadas"), tr("conversao_volume")];
        const porModalidade = agrupar(regs, todos, (r) => { const e = evPorId.get(r.eventoId); return e ? nomeModalidade(e.modalidade) : undefined; }).sort((a, b) => b.ind.visitas - a.ind.visitas);
        return (
          <>
            <div className="grid gap-6 lg:grid-cols-3">
              <Bloco titulo={tr("mais_visitas")}><Tabela cab={[tr("evento"), tr("visitas")]} linhas={top((i) => i.visitas).map((g) => [nomeEvento(g.chave), fmtN(g.ind.visitas)])} /></Bloco>
              <Bloco titulo={tr("mais_inscricoes")}><Tabela cab={[tr("evento"), tr("confirmadas")]} linhas={top((i) => i.confirmadas).map((g) => [nomeEvento(g.chave), fmtN(g.ind.confirmadas)])} /></Bloco>
              <Bloco titulo={tr("maior_conversao")} nota={tr("so_eventos_com_10_visitantes_para")}>
                <Tabela cab={[tr("evento"), tr("conversao")]} linhas={top((i) => i.conversao ?? -1, 10).map((g) => [nomeEvento(g.chave), <>{fmtP(g.ind.conversao)} <span className="text-xs text-muted-foreground">({g.ind.confirmadas}/{g.ind.visitantes})</span></>])} />
              </Bloco>
            </div>
            <Bloco titulo={tr("comparacao_entre_organizacoes")}><Tabela cab={[tr("organizacao"), ...cab]} linhas={org.map((g) => [g.chave, ...linhaComVolume(g.ind)])} /></Bloco>
            <Bloco titulo={tr("comparacao_por_localizacao_do_evento")} nota={tr("o_filtro_usa_a_localizacao_do")}>
              <div className="mb-2 flex gap-1">
                {(["regiao", "uf", "cidade"] as const).map((a) => <Button key={a} variant={agrupamento === a ? "default" : "outline"} onClick={() => setAgrupamento(a)}>{a === "regiao" ? tr("regiao") : a === "uf" ? tr("estado") : tr("cidade")}</Button>)}
              </div>
              <Tabela cab={[tr("local"), ...cab]} linhas={geo.map((g) => [g.chave, ...linhaComVolume(g.ind)])} />
            </Bloco>
            <Bloco titulo={tr("visitas_e_inscricoes_por_modalidade")} nota={tr("dados_agregados_por_evento_preferencias")}>
              <Tabela cab={[tr("modalidade"), ...cab]} linhas={porModalidade.map((g) => [g.chave, ...linhaComVolume(g.ind)])} />
            </Bloco>
          </>
        );
      })()}

      <p className="text-xs text-muted-foreground">{tr("privacidade_os_paineis_mostram_apenas_nu")}</p>
    </div>
  );
}

function Campanhas({ evento, campanhas, regs, onCriada }: { evento: Evento; campanhas: Campanha[]; regs: RegistroAnalytics[]; onCriada: () => void }) {
  const [nome, setNome] = useState("");
  const [origem, setOrigem] = useState<OrigemCampanha>("instagram");
  const [erro, setErro] = useState("");
  const [erroNome, setErroNome] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [criada, setCriada] = useState<Campanha | null>(null);
  const [copiado, setCopiado] = useState("");
  const nomeRef = useRef<HTMLInputElement>(null);
  const copiar = async (c: Campanha) => {
    try { await navigator.clipboard.writeText(linkCampanha(c)); setCopiado(c.id); } catch { setErro(tr("nao_foi_possivel_copiar_selecione_o")); }
  };
  const gerar = async () => {
    if (salvando) return;
    setErro("");
    if (!nome.trim()) { setErroNome(tr("digite_um_nome_para_identificar_a")); nomeRef.current?.focus(); return; }
    setSalvando(true);
    try {
      const c = await criarCampanha(evento.id, nome.trim(), origem);
      setCriada(c); setCopiado(""); setNome(""); onCriada();
    } catch (e) { setErro((e as Error).message); } finally { setSalvando(false); }
  };
  const borda = erroNome ? "border-destructive" : "border-input";
  return (
    <Bloco titulo={tr("links_de_divulgacao")} nota={tr("o_canal_representa_a_origem_configurada")}>
      <div className="rounded-lg border border-border bg-card p-4">
        <h4 className="font-display text-base font-semibold">{tr("criar_link_de_divulgacao")}</h4>
        <p className="mt-1 text-sm text-muted-foreground">{tr("de_um_nome_a_campanha_e")}</p>
        <div className="mt-3 grid gap-3 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <div>
            <Label htmlFor="camp-nome" className="text-sm font-medium text-inherit">{tr("nome_da_campanha")}{" "}<span className="text-destructive">*</span></Label>
            <Input id="camp-nome" ref={nomeRef} value={nome} maxLength={60} required
              aria-invalid={!!erroNome} aria-describedby={erroNome ? "camp-nome-erro" : "camp-nome-ajuda"}
              placeholder={tr("ex_lancamento_operacao_tempestade")}
              onChange={(e) => { setNome(e.target.value); if (erroNome && e.target.value.trim()) setErroNome(""); }}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void gerar(); } }}
              className={`mt-1 h-10 w-full rounded-md border ${borda} bg-background px-3 text-sm text-foreground shadow-sm placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/40 py-0`} />
            {erroNome
              ? <p id="camp-nome-erro" role="alert" className="mt-1 text-xs text-destructive">{erroNome}</p>
              : <p id="camp-nome-ajuda" className="mt-1 text-xs text-muted-foreground">{tr("escolha_um_nome_para_identificar_esta")}</p>}
          </div>
          <div>
            <Label htmlFor="camp-canal" className="text-sm font-medium text-inherit">{tr("canal_de_divulgacao")}{" "}<span className="text-destructive">*</span></Label>
            <NativeSelect id="camp-canal" value={origem} aria-describedby="camp-canal-ajuda" onChange={(e) => setOrigem(e.target.value as OrigemCampanha)}
              className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground shadow-sm focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/40 py-0">
              {Object.entries(ROTULO_ORIGEM_CAMPANHA).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </NativeSelect>
            <p id="camp-canal-ajuda" className="mt-1 text-xs text-muted-foreground">{tr("selecione_onde_voce_pretende_compartilha")}</p>
          </div>
        </div>
        <div className="mt-3"><Button type="button" onClick={gerar} disabled={salvando} className="w-full sm:w-auto">{salvando ? tr("gerando") : tr("gerar_link_de_divulgacao")}</Button></div>
        {erro && <p role="alert" className="mt-2 text-sm text-destructive">{erro}</p>}
        {criada && (
          <div className="mt-4 rounded-md border border-border bg-background p-3 text-sm" aria-live="polite">
            <p className="font-medium">{criada.nome} <Badge>{ROTULO_ORIGEM_CAMPANHA[criada.origem]}</Badge></p>
            <Label htmlFor="camp-link" className="mt-2 block text-xs text-muted-foreground font-normal">{tr("link_gerado")}</Label>
            <div className="mt-1 flex flex-col gap-2 sm:flex-row">
              <Input id="camp-link" readOnly value={linkCampanha(criada)} onFocus={(e) => e.target.select()}
                className="h-10 w-full min-w-0 rounded-md border border-input bg-muted px-3 text-sm text-foreground py-0" />
              <Button type="button" variant="outline" onClick={() => copiar(criada)}>{copiado === criada.id ? tr("link_copiado") : tr("copiar_link")}</Button>
            </div>
          </div>
        )}
      </div>
      <div className="mt-3">
        <Tabela vazio={tr("nenhuma_campanha_para_este_evento")}
          cab={[tr("campanha"), tr("origem"), tr("visitas"), tr("inscricoes"), tr("link")]}
          linhas={campanhas.map((c) => {
            const r = regs.filter((x) => x.campanhaId === c.id);
            return [c.nome, <Badge key="b">{ROTULO_ORIGEM_CAMPANHA[c.origem]}</Badge>, fmtN(r.filter((x) => x.tipo === "visita").length), fmtN(r.filter((x) => x.tipo === "inscricao_confirmada").length),
              <Button key="c" variant="outline" className="!py-1" onClick={() => copiar(c)}>{copiado === c.id ? tr("link_copiado") : tr("copiar_link")}</Button>];
          })} />
      </div>
    </Bloco>
  );
}
