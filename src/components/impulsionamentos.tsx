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
  const nomeEvento = (id: string) => base.eventos.find((e) => e.id === id)?.nome ?? "Operação removida";
  const [regs, setRegs] = useState<RegistroAnalytics[] | null>(null);
  useEffect(() => { listarMetricas().then((r) => setRegs(r.registros)).catch(() => setRegs([])); }, []);

  const agir = async (c: Impulsionamento, acao: AcaoImpulsionamento) => {
    setErro(""); setOcupado(c.id);
    try { await alterarImpulsionamento(c.id, acao); } catch (e) { setErro((e as Error).message); } finally { setOcupado(null); }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-sm text-muted-foreground">
          Campanhas concedidas pela administração. Aparecem sozinhas nas seções escolhidas, antes da curadoria editorial,
          ordenadas por prioridade e ordem; cada operação aparece uma vez por seção.
        </p>
        <Button type="button" onClick={() => setEditando(vazio())}>Impulsionar operação</Button>
      </div>
      {erro && <p role="alert" className="text-sm text-destructive">{erro}</p>}
      {lista.length === 0 ? (
        <EstadoVazio titulo="Nenhum impulsionamento" descricao="Use “Impulsionar operação” para criar a primeira campanha." />
      ) : (
        <Card className="overflow-x-auto">
          <Table className="w-full min-w-[900px] text-sm">
            <TableHeader className="text-left text-xs uppercase text-muted-foreground">
              <TableRow>{["Operação", "Campanha", "Posições", "Abrangência", "Período", "Prioridade", "Status", "Desempenho", "Ações"].map((h) => <TableHead key={h} className="px-3 py-2">{h}</TableHead>)}</TableRow>
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
                    <TableCell className="px-3 py-2">{c.prioridade === "alta" ? "Alta" : "Normal"}{c.ordem ? ` · ordem ${c.ordem}` : ""}</TableCell>
                    <TableCell className="px-3 py-2"><StatusImpulsionamento s={st} />{dup && <div className="mt-1 text-xs text-warning">Sobrepõe outra campanha da mesma operação</div>}</TableCell>
                    <TableCell className="px-3 py-2 whitespace-nowrap text-xs">{regs === null ? "Carregando…" : (() => {
                      const m = metricasCampanha(regs, c.id);
                      return <>{m.exibicoes} exibições · {m.cliques} cliques<br />CTR {m.ctr === null ? "—" : `${m.ctr.toFixed(1)}%`} · {m.visitas} visitas · {m.inscricoes} inscrições</>;
                    })()}</TableCell>
                    <TableCell className="px-3 py-2">
                      <div className="flex flex-wrap gap-1">
                        {c.status !== "encerrado" && <Button type="button" variant="outline" onClick={() => setEditando(deCampanha(c))}>Editar</Button>}
                        {(st === "ativo" || st === "agendado" || st === "pausado_esgotado") && <Button type="button" variant="outline" disabled={ocupado === c.id} onClick={() => void agir(c, "pausar")}>Pausar</Button>}
                        {(st === "pausado" || st === "suspenso") && <Button type="button" variant="outline" disabled={ocupado === c.id} onClick={() => void agir(c, "retomar")}>Retomar</Button>}
                        {st !== "encerrado" && st !== "rascunho" && <Button type="button" variant="ghost" disabled={ocupado === c.id} onClick={() => void agir(c, "encerrar")}>Encerrar</Button>}
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

const ETAPAS = ["Operação e objetivo", "Onde divulgar", "Abrangência", "Período e prioridade", "Apresentação", "Revisão"] as const;

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
    <Modal aberto largo titulo={d.id ? "Editar impulsionamento" : "Impulsionar operação"} onFechar={onFechar}>
      <ol className="mb-4 flex flex-wrap gap-1" aria-label="Etapas">
        {ETAPAS.map((t, i) => (
          <li key={t}><Button type="button" variant={i === etapa ? "default" : "outline"} aria-current={i === etapa ? "step" : undefined} onClick={() => setEtapa(i)}>{i + 1}. {t}</Button></li>
        ))}
      </ol>

      <div className="space-y-4">
        {etapa === 0 && (
          <>
            <Campo rotulo="Operação" htmlFor="imp-evento">
              <NativeSelect id="imp-evento" value={d.eventoId} onChange={(e) => set({ eventoId: e.target.value })}>
                <option value="">Selecione…</option>
                {elegiveis.map((e) => <option key={e.id} value={e.id}>{e.nome} — {e.cidade}/{e.uf}</option>)}
                {evento && !elegiveis.includes(evento) && <option value={evento.id}>{evento.nome} (indisponível)</option>}
              </NativeSelect>
            </Campo>
            <Campo rotulo="Nome interno da campanha" htmlFor="imp-nome">
              <Input id="imp-nome" value={d.nome} maxLength={120} onChange={(e) => set({ nome: e.target.value })} placeholder="Ex.: Lançamento Serra Verde — Sudeste" />
            </Campo>
            <fieldset>
              <legend className="mb-1 text-sm font-medium">Objetivo</legend>
              <RadioGroup className="block" value={d.objetivo} onValueChange={(o) => set({ objetivo: o as typeof d.objetivo })}>
                {(["divulgacao", "inscricoes"] as const).map((o) => (
                  <Label key={o} className="mr-4 inline-flex items-center gap-2 text-sm font-normal text-inherit">
                    <RadioGroupItem value={o} /> {ROTULO_OBJETIVO[o]}
                  </Label>
                ))}
              </RadioGroup>
              <p className="mt-1 text-xs text-muted-foreground">Promover inscrições pausa sozinho quando a operação esgota; divulgação continua exibindo “Esgotado”.</p>
            </fieldset>
          </>
        )}

        {etapa === 1 && (
          <fieldset className="space-y-2">
            <legend className="mb-1 text-sm font-medium">Locais de divulgação</legend>
            <Label className="flex items-center gap-2 text-sm font-normal text-inherit">
              <Checkbox checked={d.posicoes.includes(POSICAO_LISTAGEM)} onCheckedChange={() => alternar(POSICAO_LISTAGEM)} />
              Listagem de eventos — bloco “Operações em destaque”
            </Label>
            <Label className="flex items-center gap-2 text-sm font-normal text-inherit">
              <Checkbox checked={d.posicoes.includes(POSICAO_COMUNIDADE)} onCheckedChange={() => alternar(POSICAO_COMUNIDADE)} />
              Comunidade — lateral do feed e dos fóruns
            </Label>
            {secoes.map((s) => (
              <Label key={s.id} className="flex items-center gap-2 text-sm font-normal text-inherit">
                <Checkbox checked={d.posicoes.includes(s.id)} onCheckedChange={() => alternar(s.id)} />
                Página inicial — {s.titulo} <span className="text-xs text-muted-foreground">({rotuloAbrangencia(s.abrangencia)}{s.status === "rascunho" ? ", rascunho" : ""})</span>
              </Label>
            ))}
            {secoes.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Não há seção de eventos disponível na página inicial.{" "}
                <Button variant="plain" size="none" type="button" className="underline" onClick={() => { onFechar(); irParaSecoes(); }}>Criar seção</Button>{" "}
                (salve este impulsionamento como rascunho antes, para não perdê-lo).
              </p>
            )}
          </fieldset>
        )}

        {etapa === 2 && (
          <>
            <EditorAbrangencia valor={d.abrangencia} onMudar={(a) => set({ abrangencia: a })} />
            <p className="text-xs text-muted-foreground">Define onde a campanha é exibida. A localização real da operação não muda e continua visível no card.</p>
          </>
        )}

        {etapa === 3 && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Campo rotulo="Início" htmlFor="imp-ini"><Input id="imp-ini" type="datetime-local" value={paraLocal(d.inicioEm)} onChange={(e) => set({ inicioEm: deLocal(e.target.value) })} /></Campo>
            <Campo rotulo="Término" htmlFor="imp-fim"><Input id="imp-fim" type="datetime-local" value={paraLocal(d.fimEm)} onChange={(e) => set({ fimEm: deLocal(e.target.value) })} /></Campo>
            <p className="text-xs text-muted-foreground sm:col-span-2">Horários no fuso de Brasília (America/Sao_Paulo).{evento && ` A operação termina em ${formatarDataBR(evento.fimEm)}.`}</p>
            <Campo rotulo="Prioridade" htmlFor="imp-pri">
              <NativeSelect id="imp-pri" value={d.prioridade} onChange={(e) => set({ prioridade: e.target.value as DadosImpulsionamento["prioridade"] })}>
                <option value="normal">Normal</option><option value="alta">Alta</option>
              </NativeSelect>
            </Campo>
            <Campo rotulo="Ordem na seção (0 = sem preferência)" htmlFor="imp-ordem">
              <Input id="imp-ordem" type="number" min={0} max={999} value={d.ordem} onChange={(e) => set({ ordem: Math.max(0, Math.min(999, Number(e.target.value) || 0)) })} />
            </Campo>
          </div>
        )}

        {etapa === 4 && (
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-3">
              <Campo rotulo="Imagem promocional (opcional, endereço https)" htmlFor="imp-img">
                <Input id="imp-img" value={d.imagemPromocional ?? ""} onChange={(e) => set({ imagemPromocional: e.target.value })} placeholder="Vazio = imagem da operação" />
              </Campo>
              <Campo rotulo="Chamada curta (opcional)" htmlFor="imp-cham">
                <Textarea id="imp-cham" maxLength={120} value={d.chamada ?? ""} onChange={(e) => set({ chamada: e.target.value })} />
              </Campo>
            </div>
            <Previa base={base} d={d} />
          </div>
        )}

        {etapa === 5 && (
          <div className="grid gap-4 lg:grid-cols-2">
            <dl className="space-y-2 text-sm">
              <div><dt className="text-muted-foreground">Operação</dt><dd>{evento?.nome ?? "—"}</dd></div>
              <div><dt className="text-muted-foreground">Locais</dt><dd>{d.posicoes.map((p) => rotuloPosicao(base, p)).join(", ") || "—"}</dd></div>
              <div><dt className="text-muted-foreground">Abrangência</dt><dd>{rotuloAbrangencia(d.abrangencia)}</dd></div>
              <div><dt className="text-muted-foreground">Período</dt><dd>{formatarDataBR(d.inicioEm)} → {formatarDataBR(d.fimEm)} (Brasília)</dd></div>
              <div><dt className="text-muted-foreground">Prioridade</dt><dd>{d.prioridade === "alta" ? "Alta" : "Normal"}</dd></div>
              {pendencias.length > 0 && (
                <div role="alert" className="rounded border border-destructive/50 p-2">
                  <dt className="font-medium">Antes de ativar</dt>
                  {pendencias.map((p) => <dd key={p}>• {p}</dd>)}
                </div>
              )}
              {sobrepostas.length > 0 && <p className="text-warning">Há {sobrepostas.length} campanha(s) da mesma operação no mesmo período e local. O card aparece uma vez só.</p>}
            </dl>
            <Previa base={base} d={d} />
          </div>
        )}
      </div>

      {erro && <p role="alert" className="mt-3 text-sm text-destructive">{erro}</p>}
      <div className="mt-6 flex flex-wrap justify-between gap-2">
        <div className="flex gap-2">
          <Button type="button" variant="outline" disabled={etapa === 0} onClick={() => setEtapa((x) => x - 1)}>Voltar</Button>
          {etapa < ETAPAS.length - 1 && <Button type="button" variant="outline" onClick={() => setEtapa((x) => x + 1)}>Avançar</Button>}
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="secondary" disabled={salvando || !d.eventoId} onClick={() => void salvar(false)}>Salvar rascunho</Button>
          {etapa === ETAPAS.length - 1 && (
            <Button type="button" disabled={salvando || pendencias.length > 0} onClick={() => void salvar(true)}>
              {agendar ? "Agendar impulsionamento" : "Ativar impulsionamento"}
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
}

function Previa({ base, d }: { base: BaseDados; d: DadosImpulsionamento }) {
  const e = base.eventos.find((x) => x.id === d.eventoId);
  if (!e) return <p className="text-sm text-muted-foreground">Selecione a operação para ver a prévia.</p>;
  return (
    <div>
      <p className="mb-2 text-xs uppercase text-muted-foreground">Prévia do card</p>
      <div className="w-72 max-w-full">
        <CartaoEvento c={{ evento: e, esgotado: esgotado(base, e), chamada: d.chamada, imagem: d.imagemPromocional?.trim() || e.imagemUrl, campanhaId: "previa" }} />
      </div>
    </div>
  );
}

function EditorAbrangencia({ valor, onMudar }: { valor: Abrangencia; onMudar: (a: Abrangencia) => void }) {
  return (
    <fieldset className="grid gap-2 sm:grid-cols-3">
      <legend className="mb-1 text-sm font-medium">Onde exibir</legend>
      <NativeSelect aria-label="Escopo" value={valor.escopo} onChange={(e) => {
        const escopo = e.target.value as Abrangencia["escopo"];
        onMudar(escopo === "nacional" ? NACIONAL : escopo === "regiao" ? { escopo, regiao: "Sudeste" } : { escopo, uf: "SP", cidade: escopo === "cidade" ? "São Paulo" : undefined });
      }}>
        <option value="nacional">Todo o Brasil</option><option value="regiao">Região</option>
        <option value="estado">Estado</option><option value="cidade">Cidade</option>
      </NativeSelect>
      {valor.escopo === "regiao" && (
        <NativeSelect aria-label="Região" value={valor.regiao} onChange={(e) => onMudar({ escopo: "regiao", regiao: e.target.value as Abrangencia["regiao"] })}>
          {REGIOES.map((r) => <option key={r}>{r}</option>)}
        </NativeSelect>
      )}
      {(valor.escopo === "estado" || valor.escopo === "cidade") && (
        <NativeSelect aria-label="Estado" value={valor.uf} onChange={(e) => onMudar({ ...valor, uf: e.target.value })}>
          {UFS.map((u) => <option key={u}>{u}</option>)}
        </NativeSelect>
      )}
      {valor.escopo === "cidade" && (
        <Input aria-label="Cidade" value={valor.cidade ?? ""} onChange={(e) => onMudar({ ...valor, cidade: e.target.value })} placeholder="Cidade" />
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
      <h3 className="font-display text-lg font-semibold uppercase">Prévia e diagnóstico</h3>
      <p className="text-sm text-muted-foreground">Escolha onde e para quem simular. Mostra a ordem do bloco em destaque e o motivo de cada campanha ficar de fora.</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Campo rotulo="Local de divulgação" htmlFor="pv-pos">
          <NativeSelect id="pv-pos" value={posicao} onChange={(e) => setPosicao(e.target.value)}>
            <option value={POSICAO_LISTAGEM}>Listagem de eventos</option>
            <option value={POSICAO_COMUNIDADE}>Lateral da comunidade</option>
            {secoesCompativeis(base).map((s) => <option key={s.id} value={s.id}>{s.titulo}</option>)}
          </NativeSelect>
        </Campo>
        <Campo rotulo="Área do visitante" htmlFor="pv-esc">
          <NativeSelect id="pv-esc" value={escopo} onChange={(e) => setEscopo(e.target.value as Abrangencia["escopo"])}>
            <option value="nacional">Todo o Brasil</option><option value="regiao">Região</option>
            <option value="estado">Estado</option><option value="cidade">Cidade</option>
          </NativeSelect>
        </Campo>
        {escopo === "regiao" && (
          <Campo rotulo="Região" htmlFor="pv-reg">
            <NativeSelect id="pv-reg" value={regiao} onChange={(e) => setRegiao(e.target.value)}>{REGIOES.map((r) => <option key={r}>{r}</option>)}</NativeSelect>
          </Campo>
        )}
        {(escopo === "estado" || escopo === "cidade") && (
          <Campo rotulo="Estado" htmlFor="pv-uf">
            <NativeSelect id="pv-uf" value={uf} onChange={(e) => setUf(e.target.value)}>{UFS.map((u) => <option key={u}>{u}</option>)}</NativeSelect>
          </Campo>
        )}
        {escopo === "cidade" && (
          <Campo rotulo="Cidade" htmlFor="pv-cid"><Input id="pv-cid" value={cidade} onChange={(e) => setCidade(e.target.value)} placeholder="Ex.: Campinas" /></Campo>
        )}
      </div>
      {posicao === POSICAO_LISTAGEM && <p className="mt-2 text-xs text-muted-foreground">Na listagem, a operação também precisa atender à busca e aos filtros do visitante.</p>}
      <ul className="mt-4 space-y-2">
        {linhas.length === 0 && <li className="text-sm text-muted-foreground">Nenhuma campanha para simular.</li>}
        {linhas.map((l) => (
          <li key={l.campanha.id} className="rounded-md border border-border p-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={l.aparece ? "success" : "secondary"}>{l.aparece ? `Aparece em ${l.ordem}º` : "Não aparece"}</Badge>
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
