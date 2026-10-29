// Administração → Página inicial e divulgação → Impulsionamentos.
import { useEffect, useState } from "react";
import { listarMetricas } from "@/api/analytics.functions";
import type { RegistroAnalytics } from "@/lib/analytics";
import type { Abrangencia, BaseDados, Impulsionamento } from "@/lib/domain/types";
import { POSICAO_COMUNIDADE, POSICAO_LISTAGEM } from "@/lib/domain/types";
import { NACIONAL, REGIOES, UF_REGIAO, esgotado, rotuloAbrangencia } from "@/lib/divulgacao";
import {
  ROTULO_OBJETIVO, ROTULO_STATUS_IMPULSIONAMENTO, pendenciasAtivacao, rotuloPosicao, secoesCompativeis,
  sobreposicoes, statusExibido, diagnosticarPosicao, metricasCampanha, type StatusExibidoImpulsionamento,
} from "@/lib/impulsionamento";
import { alterarImpulsionamento, salvarImpulsionamento } from "@/api/impulsionamentos.functions";
import type { AcaoImpulsionamento, DadosImpulsionamento } from "@/services/impulsionamentos";
import { CartaoEvento } from "@/components/divulgacao";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { Campo, EstadoVazio, Modal } from "@/components/ui";
import { formatarDataBR } from "@/lib/domain/money";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { tr } from "@/i18n/components/impulsionamentos";

const UFS = Object.keys(UF_REGIAO).sort();
const FUSO = "America/Sao_Paulo";
const paraLocal = (iso?: string) => (iso ? new Date(new Date(iso).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : "");
const deLocal = (v: string) => (v ? new Date(v).toISOString() : "");

const TOM: Record<StatusExibidoImpulsionamento, "secondary" | "success" | "warning" | "destructive" | "accent"> = {
  rascunho: "secondary", agendado: "accent", ativo: "success", pausado: "warning", pausado_esgotado: "warning", encerrado: "secondary", suspenso: "destructive",
};

export function StatusImpulsionamento({ s }: { s: StatusExibidoImpulsionamento }) {
  return <Badge variant={TOM[s]}>{ROTULO_STATUS_IMPULSIONAMENTO[s]}</Badge>;
}

function vazio(eventoId = ""): DadosImpulsionamento {
  const inicio = new Date();
  const fim = new Date(inicio.getTime() + 7 * 86400000);
  return {
    eventoId, nome: "", objetivo: "divulgacao", posicoes: [], abrangencia: NACIONAL,
    inicioEm: inicio.toISOString(), fimEm: fim.toISOString(), fuso: FUSO, prioridade: "normal", ordem: 0, ativar: false,
  };
}

function deCampanha(c: Impulsionamento): DadosImpulsionamento {
  const { status: _s, criadoPor: _c, criadoEm: _e, atualizadoEm: _a, ...resto } = c;
  return { ...resto, ativar: false };
}

export function GestaoImpulsionamentos({ base, eventoInicial, irParaSecoes }: { base: BaseDados; eventoInicial?: string | undefined; irParaSecoes: () => void }) {
  const [editando, setEditando] = useState<DadosImpulsionamento | null>(() => (eventoInicial ? vazio(eventoInicial) : null));
  const [erro, setErro] = useState("");
  const [ocupado, setOcupado] = useState<string | null>(null);
  const agora = new Date();
  const lista = base.impulsionamentos.slice().sort((a, b) => b.criadoEm.localeCompare(a.criadoEm));
  const nomeEvento = (id: string) => base.eventos.find((e) => e.id === id)?.nome ?? tr("operacao_removida");
  const [regs, setRegs] = useState<RegistroAnalytics[] | null>(null);
  useEffect(() => { listarMetricas().then((r) => setRegs(r.registros)).catch(() => setRegs([])); }, []);

  const agir = async (c: Impulsionamento, acao: AcaoImpulsionamento) => {
    setErro(""); setOcupado(c.id);
    try { await alterarImpulsionamento(c.id, acao); } catch (e) { setErro((e as Error).message); } finally { setOcupado(null); }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-sm text-muted-foreground">{tr("campanhas_concedidas_pela_administracao")}</p>
        <Button type="button" onClick={() => setEditando(vazio())}>{tr("impulsionar_operacao")}</Button>
      </div>
      {erro && <p role="alert" className="text-sm text-destructive">{erro}</p>}
      {lista.length === 0 ? (
        <EstadoVazio titulo={tr("nenhum_impulsionamento")} descricao={tr("use_impulsionar_operacao_para_criar_a")} />
      ) : (
        <Card className="overflow-x-auto">
          <Table className="w-full min-w-[900px] text-sm">
            <TableHeader className="text-left text-xs uppercase text-muted-foreground">
              <TableRow>{[tr("operacao"), tr("campanha"), tr("posicoes"), tr("abrangencia"), tr("periodo"), tr("prioridade"), tr("status"), tr("desempenho"), tr("acoes")].map((h) => <TableHead key={h} className="px-3 py-2">{h}</TableHead>)}</TableRow>
            </TableHeader>
            <TableBody>
              {lista.map((c) => {
                const st = statusExibido(base, c, agora);
                const dup = sobreposicoes(base, c).length > 0;
                return (
                  <TableRow key={c.id} className="border-t border-border align-top">
                    <TableCell className="px-3 py-2 font-medium">{nomeEvento(c.eventoId)}</TableCell>
                    <TableCell className="px-3 py-2">{c.nome}<div className="text-xs text-muted-foreground">{ROTULO_OBJETIVO[c.objetivo]}</div></TableCell>
                    <TableCell className="px-3 py-2">{c.posicoes.map((p) => rotuloPosicao(base, p)).join(", ")}</TableCell>
                    <TableCell className="px-3 py-2">{rotuloAbrangencia(c.abrangencia)}</TableCell>
                    <TableCell className="px-3 py-2 whitespace-nowrap">{formatarDataBR(c.inicioEm)} → {formatarDataBR(c.fimEm)}</TableCell>
                    <TableCell className="px-3 py-2">{c.prioridade === "alta" ? tr("alta") : tr("normal")}{c.ordem ? ` ${tr("ordem_ordem", { ordem: c.ordem })}` : ""}</TableCell>
                    <TableCell className="px-3 py-2"><StatusImpulsionamento s={st} />{dup && <div className="mt-1 text-xs text-warning">{tr("sobrepoe_outra_campanha_da_mesma_operaca")}</div>}</TableCell>
                    <TableCell className="px-3 py-2 whitespace-nowrap text-xs">{regs === null ? (
                      <div className="space-y-1.5" role="status" aria-label={tr("carregando_metricas")}><Skeleton className="h-3 w-36" /><Skeleton className="h-3 w-28" /></div>
                    ) : (() => {
                      const m = metricasCampanha(regs, c.id);
                      return <>{tr("exibicoes_exibicoes_cliques_cliques", { exibicoes: m.exibicoes, cliques: m.cliques })}<br />{tr("ctr")}{" "}{m.ctr === null ? "—" : `${m.ctr.toFixed(1)}%`}{" "}{tr("visitas_visitas_inscricoes_inscricoes", { visitas: m.visitas, inscricoes: m.inscricoes })}</>;
                    })()}</TableCell>
                    <TableCell className="px-3 py-2">
                      <div className="flex flex-wrap gap-1">
                        {c.status !== "encerrado" && <Button type="button" variant="outline" onClick={() => setEditando(deCampanha(c))}>{tr("editar")}</Button>}
                        {(st === "ativo" || st === "agendado" || st === "pausado_esgotado") && <Button type="button" variant="outline" disabled={ocupado === c.id} onClick={() => void agir(c, "pausar")}>{tr("pausar")}</Button>}
                        {(st === "pausado" || st === "suspenso") && <Button type="button" variant="outline" disabled={ocupado === c.id} onClick={() => void agir(c, "retomar")}>{tr("retomar")}</Button>}
                        {st !== "encerrado" && st !== "rascunho" && <Button type="button" variant="ghost" disabled={ocupado === c.id} onClick={() => void agir(c, "encerrar")}>{tr("encerrar")}</Button>}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}
      {lista.length > 0 && <PreviaDiagnostico base={base} nomeEvento={nomeEvento} />}
      {editando && <EditorImpulsionamento base={base} inicial={editando} onFechar={() => setEditando(null)} irParaSecoes={() => { irParaSecoes(); }} />}
    </div>
  );
}

const etapas = () => [tr("etapa_operacao_objetivo"), tr("etapa_onde_divulgar"), tr("etapa_abrangencia"), tr("etapa_periodo_prioridade"), tr("etapa_apresentacao"), tr("etapa_revisao")];

function EditorImpulsionamento({ base, inicial, onFechar, irParaSecoes }: { base: BaseDados; inicial: DadosImpulsionamento; onFechar: () => void; irParaSecoes: () => void }) {
  const [d, setD] = useState(inicial);
  const [etapa, setEtapa] = useState(0);
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);
  const set = (p: Partial<DadosImpulsionamento>) => setD((x) => ({ ...x, ...p }));
  const agora = new Date();
  const evento = base.eventos.find((e) => e.id === d.eventoId);
  const elegiveis = base.eventos.filter((e) => e.status === "publicado" && new Date(e.fimEm) > agora);
  const secoes = secoesCompativeis(base);
  const pendencias = pendenciasAtivacao(base, d, agora);
  const sobrepostas = d.inicioEm && d.fimEm ? sobreposicoes(base, { id: d.id ?? "", ...d }) : [];
  const agendar = new Date(d.inicioEm) > agora;

  const salvar = async (ativar: boolean) => {
    setErro(""); setSalvando(true);
    try {
      const { imagemPromocional, chamada, ...resto } = d;
      await salvarImpulsionamento({
        ...resto, ativar,
        ...(imagemPromocional?.trim() ? { imagemPromocional: imagemPromocional.trim() } : {}),
        ...(chamada?.trim() ? { chamada: chamada.trim() } : {}),
      });
      onFechar();
    } catch (e) { setErro((e as Error).message); } finally { setSalvando(false); }
  };
  const alternar = (p: string) => set({ posicoes: d.posicoes.includes(p) ? d.posicoes.filter((x) => x !== p) : [...d.posicoes, p] });

  return (
    <Modal aberto largo titulo={d.id ? tr("editar_impulsionamento") : tr("impulsionar_operacao")} onFechar={onFechar}>
      <ol className="mb-4 flex flex-wrap gap-1" aria-label={tr("etapas")}>
        {etapas().map((t, i) => (
          <li key={t}><Button type="button" variant={i === etapa ? "default" : "outline"} aria-current={i === etapa ? "step" : undefined} onClick={() => setEtapa(i)}>{i + 1}. {t}</Button></li>
        ))}
      </ol>

      <div className="space-y-4">
        {etapa === 0 && (
          <>
            <Campo rotulo={tr("operacao")} htmlFor="imp-evento">
              <NativeSelect id="imp-evento" value={d.eventoId} onChange={(e) => set({ eventoId: e.target.value })}>
                <option value="">{tr("selecione")}</option>
                {elegiveis.map((e) => <option key={e.id} value={e.id}>{e.nome} — {e.cidade}/{e.uf}</option>)}
                {evento && !elegiveis.includes(evento) && <option value={evento.id}>{tr("nome_indisponivel", { nome: evento.nome })}</option>}
              </NativeSelect>
            </Campo>
            <Campo rotulo={tr("nome_interno_da_campanha")} htmlFor="imp-nome">
              <Input id="imp-nome" value={d.nome} maxLength={120} onChange={(e) => set({ nome: e.target.value })} placeholder={tr("ex_lancamento_serra_verde_sudeste")} />
            </Campo>
            <fieldset>
              <legend className="mb-1 text-sm font-medium">{tr("objetivo")}</legend>
              <RadioGroup className="block" value={d.objetivo} onValueChange={(o) => set({ objetivo: o as typeof d.objetivo })}>
                {(["divulgacao", "inscricoes"] as const).map((o) => (
                  <Label key={o} className="mr-4 inline-flex items-center gap-2 text-sm font-normal text-inherit">
                    <RadioGroupItem value={o} /> {ROTULO_OBJETIVO[o]}
                  </Label>
                ))}
              </RadioGroup>
              <p className="mt-1 text-xs text-muted-foreground">{tr("promover_inscricoes_pausa_sozinho_quando")}</p>
            </fieldset>
          </>
        )}

        {etapa === 1 && (
          <fieldset className="space-y-2">
            <legend className="mb-1 text-sm font-medium">{tr("locais_de_divulgacao")}</legend>
            <Label className="flex items-center gap-2 text-sm font-normal text-inherit">
              <Checkbox checked={d.posicoes.includes(POSICAO_LISTAGEM)} onCheckedChange={() => alternar(POSICAO_LISTAGEM)} />{tr("listagem_de_eventos_bloco_operacoes_em")}</Label>
            <Label className="flex items-center gap-2 text-sm font-normal text-inherit">
              <Checkbox checked={d.posicoes.includes(POSICAO_COMUNIDADE)} onCheckedChange={() => alternar(POSICAO_COMUNIDADE)} />{tr("comunidade_lateral_do_feed_e_dos")}</Label>
            {secoes.map((s) => (
              <Label key={s.id} className="flex items-center gap-2 text-sm font-normal text-inherit">
                <Checkbox checked={d.posicoes.includes(s.id)} onCheckedChange={() => alternar(s.id)} />{tr("pagina_inicial_titulo", { titulo: s.titulo })} <span className="text-xs text-muted-foreground">({rotuloAbrangencia(s.abrangencia)}{s.status === "rascunho" ? tr("rascunho") : ""})</span>
              </Label>
            ))}
            {secoes.length === 0 && (
              <p className="text-sm text-muted-foreground">{tr("nao_ha_secao_de_eventos_disponivel")}{" "}
                <Button variant="plain" size="none" type="button" className="underline" onClick={() => { onFechar(); irParaSecoes(); }}>{tr("criar_secao")}</Button>{" "}{tr("salve_este_impulsionamento_como_rascunho")}</p>
            )}
          </fieldset>
        )}

        {etapa === 2 && (
          <>
            <EditorAbrangencia valor={d.abrangencia} onMudar={(a) => set({ abrangencia: a })} />
            <p className="text-xs text-muted-foreground">{tr("define_onde_a_campanha_e_exibida")}</p>
          </>
        )}

        {etapa === 3 && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Campo rotulo={tr("inicio")} htmlFor="imp-ini"><Input id="imp-ini" type="datetime-local" value={paraLocal(d.inicioEm)} onChange={(e) => set({ inicioEm: deLocal(e.target.value) })} /></Campo>
            <Campo rotulo={tr("termino")} htmlFor="imp-fim"><Input id="imp-fim" type="datetime-local" value={paraLocal(d.fimEm)} onChange={(e) => set({ fimEm: deLocal(e.target.value) })} /></Campo>
            <p className="text-xs text-muted-foreground sm:col-span-2">{tr("horarios_no_fuso_de_brasilia_america")}{evento && ` ${tr("a_operacao_termina_em_fimem", { fimEm: formatarDataBR(evento.fimEm) })}`}</p>
            <Campo rotulo={tr("prioridade")} htmlFor="imp-pri">
              <NativeSelect id="imp-pri" value={d.prioridade} onChange={(e) => set({ prioridade: e.target.value as DadosImpulsionamento["prioridade"] })}>
                <option value="normal">{tr("normal")}</option><option value="alta">{tr("alta")}</option>
              </NativeSelect>
            </Campo>
            <Campo rotulo={tr("ordem_na_secao_0_sem_preferencia")} htmlFor="imp-ordem">
              <Input id="imp-ordem" type="number" min={0} max={999} value={d.ordem} onChange={(e) => set({ ordem: Math.max(0, Math.min(999, Number(e.target.value) || 0)) })} />
            </Campo>
          </div>
        )}

        {etapa === 4 && (
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-3">
              <Campo rotulo={tr("imagem_promocional_opcional_endereco_htt")} htmlFor="imp-img">
                <Input id="imp-img" value={d.imagemPromocional ?? ""} onChange={(e) => set({ imagemPromocional: e.target.value })} placeholder={tr("vazio_imagem_da_operacao")} />
              </Campo>
              <Campo rotulo={tr("chamada_curta_opcional")} htmlFor="imp-cham">
                <Textarea id="imp-cham" maxLength={120} value={d.chamada ?? ""} onChange={(e) => set({ chamada: e.target.value })} />
              </Campo>
            </div>
            <Previa base={base} d={d} />
          </div>
        )}

        {etapa === 5 && (
          <div className="grid gap-4 lg:grid-cols-2">
            <dl className="space-y-2 text-sm">
              <div><dt className="text-muted-foreground">{tr("operacao")}</dt><dd>{evento?.nome ?? "—"}</dd></div>
              <div><dt className="text-muted-foreground">{tr("locais")}</dt><dd>{d.posicoes.map((p) => rotuloPosicao(base, p)).join(", ") || "—"}</dd></div>
              <div><dt className="text-muted-foreground">{tr("abrangencia")}</dt><dd>{rotuloAbrangencia(d.abrangencia)}</dd></div>
              <div><dt className="text-muted-foreground">{tr("periodo")}</dt><dd>{tr("inicioem_fimem_brasilia", { inicioEm: formatarDataBR(d.inicioEm), fimEm: formatarDataBR(d.fimEm) })}</dd></div>
              <div><dt className="text-muted-foreground">{tr("prioridade")}</dt><dd>{d.prioridade === "alta" ? tr("alta") : tr("normal")}</dd></div>
              {pendencias.length > 0 && (
                <div role="alert" className="rounded border border-destructive/50 p-2">
                  <dt className="font-medium">{tr("antes_de_ativar")}</dt>
                  {pendencias.map((p) => <dd key={p}>• {p}</dd>)}
                </div>
              )}
              {sobrepostas.length > 0 && <p className="text-warning">{tr("ha_length_campanha_s_da_mesma", { length: sobrepostas.length })}</p>}
            </dl>
            <Previa base={base} d={d} />
          </div>
        )}
      </div>

      {erro && <p role="alert" className="mt-3 text-sm text-destructive">{erro}</p>}
      <div className="mt-6 flex flex-wrap justify-between gap-2">
        <div className="flex gap-2">
          <Button type="button" variant="outline" disabled={etapa === 0} onClick={() => setEtapa((x) => x - 1)}>{tr("voltar")}</Button>
          {etapa < etapas().length - 1 && <Button type="button" variant="outline" onClick={() => setEtapa((x) => x + 1)}>{tr("avancar")}</Button>}
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="secondary" disabled={salvando || !d.eventoId} onClick={() => void salvar(false)}>{tr("salvar_rascunho")}</Button>
          {etapa === etapas().length - 1 && (
            <Button type="button" disabled={salvando || pendencias.length > 0} onClick={() => void salvar(true)}>
              {agendar ? tr("agendar_impulsionamento") : tr("ativar_impulsionamento")}
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
}

function Previa({ base, d }: { base: BaseDados; d: DadosImpulsionamento }) {
  const e = base.eventos.find((x) => x.id === d.eventoId);
  if (!e) return <p className="text-sm text-muted-foreground">{tr("selecione_a_operacao_para_ver_a")}</p>;
  return (
    <div>
      <p className="mb-2 text-xs uppercase text-muted-foreground">{tr("previa_do_card")}</p>
      <div className="w-72 max-w-full">
        <CartaoEvento c={{ evento: e, esgotado: esgotado(base, e), chamada: d.chamada, imagem: d.imagemPromocional?.trim() || e.imagemUrl, campanhaId: "previa" }} />
      </div>
    </div>
  );
}

function EditorAbrangencia({ valor, onMudar }: { valor: Abrangencia; onMudar: (a: Abrangencia) => void }) {
  return (
    <fieldset className="grid gap-2 sm:grid-cols-3">
      <legend className="mb-1 text-sm font-medium">{tr("onde_exibir")}</legend>
      <NativeSelect aria-label={tr("escopo")} value={valor.escopo} onChange={(e) => {
        const escopo = e.target.value as Abrangencia["escopo"];
        onMudar(escopo === "nacional" ? NACIONAL : escopo === "regiao" ? { escopo, regiao: "Sudeste" } : { escopo, uf: "SP", cidade: escopo === "cidade" ? "São Paulo" : undefined });
      }}>
        <option value="nacional">{tr("todo_o_brasil")}</option><option value="regiao">{tr("regiao")}</option>
        <option value="estado">{tr("estado")}</option><option value="cidade">{tr("cidade")}</option>
      </NativeSelect>
      {valor.escopo === "regiao" && (
        <NativeSelect aria-label={tr("regiao")} value={valor.regiao} onChange={(e) => onMudar({ escopo: "regiao", regiao: e.target.value as Abrangencia["regiao"] })}>
          {REGIOES.map((r) => <option key={r}>{r}</option>)}
        </NativeSelect>
      )}
      {(valor.escopo === "estado" || valor.escopo === "cidade") && (
        <NativeSelect aria-label={tr("estado")} value={valor.uf} onChange={(e) => onMudar({ ...valor, uf: e.target.value })}>
          {UFS.map((u) => <option key={u}>{u}</option>)}
        </NativeSelect>
      )}
      {valor.escopo === "cidade" && (
        <Input aria-label={tr("cidade")} value={valor.cidade ?? ""} onChange={(e) => onMudar({ ...valor, cidade: e.target.value })} placeholder={tr("cidade")} />
      )}
    </fieldset>
  );
}

/** Simula um local e uma posição e explica por que cada campanha aparece ou não. */
function PreviaDiagnostico({ base, nomeEvento }: { base: BaseDados; nomeEvento: (id: string) => string }) {
  const [posicao, setPosicao] = useState(POSICAO_LISTAGEM);
  const [escopo, setEscopo] = useState<Abrangencia["escopo"]>("nacional");
  const [regiao, setRegiao] = useState<string>(REGIOES[0] ?? "Sudeste");
  const [uf, setUf] = useState("SP");
  const [cidade, setCidade] = useState("");
  const local: Abrangencia = escopo === "nacional" ? NACIONAL
    : escopo === "regiao" ? { escopo, regiao: regiao as NonNullable<Abrangencia["regiao"]> }
    : escopo === "estado" ? { escopo, uf } : { escopo, uf, cidade: cidade.trim() };
  const linhas = diagnosticarPosicao(base, posicao, local, new Date());
  return (
    <Card>
      <h3 className="font-display text-lg font-semibold uppercase">{tr("previa_e_diagnostico")}</h3>
      <p className="text-sm text-muted-foreground">{tr("escolha_onde_e_para_quem_simular")}</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Campo rotulo={tr("local_de_divulgacao")} htmlFor="pv-pos">
          <NativeSelect id="pv-pos" value={posicao} onChange={(e) => setPosicao(e.target.value)}>
            <option value={POSICAO_LISTAGEM}>{tr("listagem_de_eventos")}</option>
            <option value={POSICAO_COMUNIDADE}>{tr("lateral_da_comunidade")}</option>
            {secoesCompativeis(base).map((s) => <option key={s.id} value={s.id}>{s.titulo}</option>)}
          </NativeSelect>
        </Campo>
        <Campo rotulo={tr("area_do_visitante")} htmlFor="pv-esc">
          <NativeSelect id="pv-esc" value={escopo} onChange={(e) => setEscopo(e.target.value as Abrangencia["escopo"])}>
            <option value="nacional">{tr("todo_o_brasil")}</option><option value="regiao">{tr("regiao")}</option>
            <option value="estado">{tr("estado")}</option><option value="cidade">{tr("cidade")}</option>
          </NativeSelect>
        </Campo>
        {escopo === "regiao" && (
          <Campo rotulo={tr("regiao")} htmlFor="pv-reg">
            <NativeSelect id="pv-reg" value={regiao} onChange={(e) => setRegiao(e.target.value)}>{REGIOES.map((r) => <option key={r}>{r}</option>)}</NativeSelect>
          </Campo>
        )}
        {(escopo === "estado" || escopo === "cidade") && (
          <Campo rotulo={tr("estado")} htmlFor="pv-uf">
            <NativeSelect id="pv-uf" value={uf} onChange={(e) => setUf(e.target.value)}>{UFS.map((u) => <option key={u}>{u}</option>)}</NativeSelect>
          </Campo>
        )}
        {escopo === "cidade" && (
          <Campo rotulo={tr("cidade")} htmlFor="pv-cid"><Input id="pv-cid" value={cidade} onChange={(e) => setCidade(e.target.value)} placeholder={tr("ex_campinas")} /></Campo>
        )}
      </div>
      {posicao === POSICAO_LISTAGEM && <p className="mt-2 text-xs text-muted-foreground">{tr("na_listagem_a_operacao_tambem_precisa")}</p>}
      <ul className="mt-4 space-y-2">
        {linhas.length === 0 && <li className="text-sm text-muted-foreground">{tr("nenhuma_campanha_para_simular")}</li>}
        {linhas.map((l) => (
          <li key={l.campanha.id} className="rounded-md border border-border p-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={l.aparece ? "success" : "secondary"}>{l.aparece ? tr("aparece_em_ordem", { ordem: l.ordem }) : tr("nao_aparece")}</Badge>
              <span className="font-medium">{nomeEvento(l.campanha.eventoId)}</span>
              <span className="text-sm text-muted-foreground">{l.campanha.nome}</span>
            </div>
            <ul className="mt-1 list-disc pl-5 text-sm text-muted-foreground">{l.motivos.map((m) => <li key={m}>{m}</li>)}</ul>
          </li>
        ))}
      </ul>
    </Card>
  );
}
