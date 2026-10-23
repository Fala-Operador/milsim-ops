import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Camera, Plus, Send, Star, Trash2, Trophy } from "lucide-react";
import { OperacaoSelecionada } from "@/components/OperacaoSelecionada";
import { useEventoSelecionado, useEventosOrg } from "@/components/organizacao";
import { PlacarCompleto, Temporada } from "@/components/missoes/Placar";
import { paraLocal } from "@/components/editorEvento/comum";
import { useVersaoBase } from "@/hooks/useVersaoBase";
import { carregarBase } from "@/services/db";
import {
  avaliarEntrega, destacarEntrega, encerrarCampanha, excluirMissao, publicarMissao, salvarMissao, salvarPremios,
} from "@/api/missoes.functions";
import { arquivoParaDataUrl } from "@/lib/imagens";
import { formatarDataHoraBR } from "@/lib/domain/money";
import { ROTULO_SITUACAO, ROTULO_STATUS_ENTREGA, ROTULO_TIPO_ENTREGA, situacaoMissao } from "@/lib/missoes";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { Campo, EstadoVazio, Modal } from "@/components/ui";
import { useConfirmacao } from "@/contexts/ConfirmacaoContext";
import type { EntregaMissao, Evento, Missao, TipoEntregaMissao } from "@/lib/domain/types";

export const Route = createFileRoute("/organizacao/missoes")({
  head: () => ({ meta: [{ title: "Missões pré-evento — Minha organização — MilSim Ops" }] }),
  component: PaginaMissoesOrg,
});

const msg = (e: unknown) => (e instanceof Error ? e.message : "Algo deu errado.");
type Aba = "missoes" | "avaliacao" | "placar" | "temporada";

function PaginaMissoesOrg() {
  const { eventos } = useEventosOrg();
  const [eventoId, setEventoId, invalido] = useEventoSelecionado(eventos);
  const evento = eventos.find((e) => e.id === eventoId);
  const versao = useVersaoBase();
  const [aba, setAba] = useState<Aba>("missoes");
  const base = carregarBase();
  const missoes = evento ? base.missoes.filter((m) => m.eventoId === evento.id) : [];
  const ids = new Set(missoes.map((m) => m.id));
  const entregas = base.entregas.filter((e) => ids.has(e.missaoId));
  const pendentes = entregas.filter((e) => e.status === "enviada").length;
  const campanha = evento ? base.campanhasMissoes.find((c) => c.eventoId === evento.id) : undefined;

  const abas: [Aba, string][] = [["missoes", "Missões"], ["avaliacao", `Avaliação${pendentes ? ` (${pendentes})` : ""}`], ["placar", "Placar e prêmios"], ["temporada", "Temporada"]];
  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-display text-lg font-semibold uppercase">Missões pré-evento</h2>
        <p className="text-sm text-muted-foreground">Crie missões para os inscritos, avalie as entregas e premie o exército vencedor no dia do evento.</p>
      </div>
      <OperacaoSelecionada eventos={eventos} evento={evento} invalido={invalido} onSelecionar={setEventoId} />
      {!evento ? <EstadoVazio titulo="Escolha um evento" /> : (
        <>
          {campanha?.encerradaEm && <p role="status" className="rounded-md border border-border bg-secondary/40 px-3 py-2 text-sm">Campanha encerrada em {formatarDataHoraBR(campanha.encerradaEm)}: o placar está congelado e os prêmios valem no dia do evento.</p>}
          <div role="tablist" aria-label="Seções das missões" className="abas-rolaveis flex border-b border-border">
            {abas.map(([id, rotulo]) => (
              <button key={id} type="button" role="tab" aria-selected={aba === id} onClick={() => setAba(id)}
                className={`shrink-0 border-b-2 px-3 py-2 text-sm font-medium whitespace-nowrap ${aba === id ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
                {rotulo}
              </button>
            ))}
          </div>
          <div role="tabpanel">
            {aba === "missoes" && <AbaMissoes evento={evento} missoes={missoes} entregas={entregas} encerrada={!!campanha?.encerradaEm} />}
            {aba === "avaliacao" && <AbaAvaliacao evento={evento} missoes={missoes} entregas={entregas} encerrada={!!campanha?.encerradaEm} />}
            {aba === "placar" && <AbaPlacar evento={evento} versao={versao} />}
            {aba === "temporada" && <Card><Temporada organizacaoId={evento.organizacaoId} /></Card>}
          </div>
        </>
      )}
    </div>
  );
}

// ---------- Missões ----------

function AbaMissoes({ evento, missoes, entregas, encerrada }: { evento: Evento; missoes: Missao[]; entregas: EntregaMissao[]; encerrada: boolean }) {
  const [editando, setEditando] = useState<Missao | "nova" | null>(null);
  const { confirmar } = useConfirmacao();
  const [erro, setErro] = useState("");
  const acao = async (fn: () => Promise<unknown>) => { setErro(""); try { await fn(); } catch (e) { setErro(msg(e)); } };
  const nomeExercito = (id: string) => (id === "todos" ? "Todos os exércitos" : evento.exercitos.find((x) => x.id === id)?.nome ?? id);
  return (
    <div className="space-y-3">
      {!encerrada && <Button onClick={() => setEditando("nova")}><Plus className="size-4" aria-hidden="true" />Nova missão</Button>}
      {erro && <p role="alert" className="text-sm text-destructive">{erro}</p>}
      {missoes.length === 0 ? <EstadoVazio titulo="Nenhuma missão" descricao="Crie a primeira missão pré-evento. Ela nasce como rascunho e só aparece para os inscritos depois de publicada." /> : (
        <ul className="space-y-2">
          {[...missoes].sort((a, b) => a.prazo.localeCompare(b.prazo)).map((m) => {
            const s = situacaoMissao(m);
            const doMissao = entregas.filter((e) => e.missaoId === m.id);
            return (
              <li key={m.id} className="rounded-md border border-border p-3 text-sm">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium">{m.titulo}</p>
                    <p className="text-xs text-muted-foreground">
                      {ROTULO_TIPO_ENTREGA[m.tipoEntrega]} · {m.pontos ?? 0} pts · {nomeExercito(m.publico)} · prazo {formatarDataHoraBR(m.prazo)}
                      {m.metaPercentual ? ` · meta ${m.metaPercentual}% → +${m.metaBonus}` : ""}
                    </p>
                    <p className="text-xs text-muted-foreground">{doMissao.filter((e) => e.status === "concluida").length} concluída(s) · {doMissao.filter((e) => e.status === "enviada").length} em análise</p>
                  </div>
                  <Badge variant={s === "aberta" ? "success" : s === "rascunho" ? "outline" : "secondary"}>{ROTULO_SITUACAO[s]}</Badge>
                </div>
                {!encerrada && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    <Button variant="outline" className="text-xs" onClick={() => setEditando(m)}>Editar</Button>
                    {s === "rascunho" && <Button className="text-xs" onClick={() => acao(() => publicarMissao(m.id))}><Send className="size-3" aria-hidden="true" />Publicar e avisar</Button>}
                    {doMissao.length === 0 && <Button variant="ghost" className="text-xs" aria-label={`Excluir ${m.titulo}`} onClick={async () => (await confirmar({ titulo: "Excluir missão?", descricao: `A missão "${m.titulo}" será excluída.`, confirmar: "Excluir", destrutivo: true })) && acao(() => excluirMissao(m.id))}><Trash2 className="size-3" aria-hidden="true" /></Button>}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {editando && <FormMissao evento={evento} missao={editando === "nova" ? undefined : editando} onFechar={() => setEditando(null)} />}
    </div>
  );
}

function FormMissao({ evento, missao, onFechar }: { evento: Evento; missao: Missao | undefined; onFechar: () => void }) {
  const padraoPrazo = new Date(Math.min(Date.parse(evento.inicioEm), Date.now() + 7 * 86400000)).toISOString();
  const [f, setF] = useState({
    titulo: missao?.titulo ?? "", descricao: missao?.descricao ?? "", imagem: missao?.imagemUrl ?? "",
    publico: missao?.publico ?? "todos", tipoEntrega: (missao?.tipoEntrega ?? "imagem") as TipoEntregaMissao,
    pontos: String(missao?.pontos ?? 10), abreEm: missao?.abreEm ? paraLocal(missao.abreEm) : "", prazo: paraLocal(missao?.prazo ?? padraoPrazo),
    exigeAprovacao: missao?.exigeAprovacao ?? true, codigo: "", meta: !!missao?.metaPercentual,
    metaPercentual: String(missao?.metaPercentual ?? 70), metaBonus: String(missao?.metaBonus ?? 5),
  });
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((x) => ({ ...x, [k]: v }));
  const salvar = async () => {
    setErro("");
    setSalvando(true);
    try {
      await salvarMissao({
        id: missao?.id, eventoId: evento.id, titulo: f.titulo, descricao: f.descricao, imagem: f.imagem || undefined,
        publico: f.publico, tipoEntrega: f.tipoEntrega, pontos: Number(f.pontos) || 0,
        abreEm: f.abreEm ? new Date(f.abreEm).toISOString() : undefined, prazo: f.prazo ? new Date(f.prazo).toISOString() : "",
        exigeAprovacao: f.exigeAprovacao, codigoResposta: f.codigo || undefined,
        metaPercentual: f.meta ? Number(f.metaPercentual) : undefined, metaBonus: f.meta ? Number(f.metaBonus) : undefined,
      });
      onFechar();
    } catch (e) {
      setErro(msg(e));
      setSalvando(false);
    }
  };
  return (
    <Modal aberto titulo={missao ? "Editar missão" : "Nova missão"} onFechar={onFechar}>
      <div className="space-y-3">
        <Campo rotulo="Título" htmlFor="mis-titulo"><Input id="mis-titulo" maxLength={120} value={f.titulo} onChange={(e) => set("titulo", e.target.value)} /></Campo>
        <Campo rotulo={`Briefing (${f.descricao.length}/2000)`} htmlFor="mis-desc"><Textarea id="mis-desc" rows={4} maxLength={2000} value={f.descricao} onChange={(e) => set("descricao", e.target.value)} /></Campo>
        <div>
          {f.imagem && <img src={f.imagem} alt="Imagem da missão" className="mb-2 max-h-40 rounded-md object-cover" />}
          <Label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-border px-3 py-2 text-sm hover:bg-secondary">
            <Camera className="size-4" aria-hidden="true" />{f.imagem ? "Trocar imagem" : "Imagem (opcional)"}
            <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={async (e) => { const a = e.target.files?.[0]; e.target.value = ""; if (a) { try { set("imagem", await arquivoParaDataUrl(a, 1600)); } catch (er) { setErro(msg(er)); } } }} />
          </Label>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Campo rotulo="Para quem" htmlFor="mis-publico">
            <NativeSelect id="mis-publico" value={f.publico} onChange={(e) => set("publico", e.target.value)}>
              <option value="todos">Todos os exércitos</option>
              {evento.exercitos.map((x) => <option key={x.id} value={x.id}>Só {x.nome}</option>)}
            </NativeSelect>
          </Campo>
          <Campo rotulo="Tipo de entrega" htmlFor="mis-tipo">
            <NativeSelect id="mis-tipo" value={f.tipoEntrega} onChange={(e) => set("tipoEntrega", e.target.value as TipoEntregaMissao)}>
              {(Object.keys(ROTULO_TIPO_ENTREGA) as TipoEntregaMissao[]).map((t) => <option key={t} value={t}>{ROTULO_TIPO_ENTREGA[t]}</option>)}
            </NativeSelect>
          </Campo>
          <Campo rotulo="Abre em (opcional)" htmlFor="mis-abre"><Input id="mis-abre" type="datetime-local" value={f.abreEm} onChange={(e) => set("abreEm", e.target.value)} /></Campo>
          <Campo rotulo="Prazo" htmlFor="mis-prazo"><Input id="mis-prazo" type="datetime-local" value={f.prazo} onChange={(e) => set("prazo", e.target.value)} /></Campo>
          <Campo rotulo="Pontos para o exército" htmlFor="mis-pontos"><Input id="mis-pontos" type="number" min={0} max={10000} value={f.pontos} onChange={(e) => set("pontos", e.target.value)} /></Campo>
          {f.tipoEntrega === "codigo" && (
            <Campo rotulo={missao?.tipoEntrega === "codigo" ? "Código secreto (vazio = mantém)" : "Código secreto"} htmlFor="mis-codigo">
              <Input id="mis-codigo" maxLength={80} value={f.codigo} onChange={(e) => set("codigo", e.target.value)} placeholder="Ex.: tempestade arabe" />
            </Campo>
          )}
        </div>
        {f.tipoEntrega !== "codigo" && (
          <div className="flex items-center gap-2">
            <Checkbox id="mis-aprov" checked={f.exigeAprovacao} onCheckedChange={(v) => set("exigeAprovacao", v === true)} />
            <Label htmlFor="mis-aprov" className="text-sm font-normal">Exigir aprovação da organização antes de contar os pontos</Label>
          </div>
        )}
        <div className="rounded-md border border-border p-3">
          <div className="flex items-center gap-2">
            <Checkbox id="mis-meta" checked={f.meta} onCheckedChange={(v) => set("meta", v === true)} />
            <Label htmlFor="mis-meta" className="text-sm font-normal">Meta coletiva: bônus para o exército se boa parte dele cumprir</Label>
          </div>
          {f.meta && (
            <div className="mt-2 grid gap-3 sm:grid-cols-2">
              <Campo rotulo="% dos inscritos do exército" htmlFor="mis-meta-pct"><Input id="mis-meta-pct" type="number" min={1} max={100} value={f.metaPercentual} onChange={(e) => set("metaPercentual", e.target.value)} /></Campo>
              <Campo rotulo="Bônus (somado à média)" htmlFor="mis-meta-bonus"><Input id="mis-meta-bonus" type="number" min={1} max={10000} value={f.metaBonus} onChange={(e) => set("metaBonus", e.target.value)} /></Campo>
            </div>
          )}
        </div>
        <p className="text-xs text-muted-foreground">A missão é salva como rascunho. Ao publicar, os inscritos são avisados (e o post vai para a comunidade do evento ou do exército).</p>
        {erro && <p role="alert" className="text-sm text-destructive">{erro}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onFechar} disabled={salvando}>Cancelar</Button>
          <Button onClick={salvar} disabled={salvando}>{salvando ? "Salvando..." : "Salvar"}</Button>
        </div>
      </div>
    </Modal>
  );
}

// ---------- Avaliação ----------

function AbaAvaliacao({ evento, missoes, entregas, encerrada }: { evento: Evento; missoes: Missao[]; entregas: EntregaMissao[]; encerrada: boolean }) {
  const [filtro, setFiltro] = useState<"pendentes" | "todas">("pendentes");
  const lista = entregas
    .filter((e) => (filtro === "pendentes" ? e.status === "enviada" : true))
    .sort((a, b) => a.enviadoEm.localeCompare(b.enviadoEm));
  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Button variant={filtro === "pendentes" ? "default" : "outline"} onClick={() => setFiltro("pendentes")}>Em análise</Button>
        <Button variant={filtro === "todas" ? "default" : "outline"} onClick={() => setFiltro("todas")}>Todas</Button>
      </div>
      {lista.length === 0 ? <EstadoVazio titulo={filtro === "pendentes" ? "Nada para avaliar" : "Nenhuma entrega ainda"} /> : (
        <ul className="grid gap-3 md:grid-cols-2">
          {lista.map((e) => <CartaoEntrega key={e.id} entrega={e} missao={missoes.find((m) => m.id === e.missaoId)!} evento={evento} encerrada={encerrada} />)}
        </ul>
      )}
    </div>
  );
}

function CartaoEntrega({ entrega: e, missao: m, evento, encerrada }: { entrega: EntregaMissao; missao: Missao; evento: Evento; encerrada: boolean }) {
  const [comentario, setComentario] = useState("");
  const [erro, setErro] = useState("");
  const pessoa = carregarBase().usuarios.find((u) => u.id === e.usuarioId);
  const nome = pessoa?.nomeExibicao || pessoa?.nomeCompleto || "Participante";
  const exercito = evento.exercitos.find((x) => x.id === e.exercitoId)?.nome ?? "—";
  const acao = async (fn: () => Promise<unknown>) => { setErro(""); try { await fn(); setComentario(""); } catch (er) { setErro(msg(er)); } };
  const link = e.conteudo && /^https?:\/\//i.test(e.conteudo.trim()) ? e.conteudo.trim() : null;
  return (
    <li className="overflow-hidden rounded-lg border border-border">
      {e.anexoUrl && <a href={e.anexoUrl} target="_blank" rel="noopener noreferrer"><img src={e.anexoUrl} alt={`Foto enviada por ${nome}`} className="max-h-64 w-full object-cover" loading="lazy" /></a>}
      <div className="space-y-2 p-3 text-sm">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="font-medium">{nome} <span className="text-muted-foreground">· {exercito}</span></p>
            <p className="text-xs text-muted-foreground">{m.titulo} · {formatarDataHoraBR(e.enviadoEm)}</p>
          </div>
          <Badge variant={e.status === "concluida" ? "success" : e.status === "enviada" ? "warning" : e.status === "recusada" ? "destructive" : "secondary"}>{ROTULO_STATUS_ENTREGA[e.status]}</Badge>
        </div>
        {e.conteudo && (link
          ? <a href={link} target="_blank" rel="noopener noreferrer" className="break-all text-accent hover:underline">{link}</a>
          : <p className="whitespace-pre-line">{e.conteudo}</p>)}
        {e.avaliacao && <p className="text-xs text-muted-foreground">Comentário: {e.avaliacao}</p>}
        {e.status === "concluida" && <p className="text-xs text-muted-foreground">+{e.pontos ?? 0} pts{e.avaliadoPor === "sistema" ? " (automático)" : ""}</p>}
        {!encerrada && e.status === "enviada" && (
          <div className="space-y-2 border-t border-border pt-2">
            <Input aria-label="Comentário para o participante" placeholder="Comentário (obrigatório para ajustes ou recusa)" maxLength={500} value={comentario} onChange={(ev) => setComentario(ev.target.value)} />
            <div className="flex flex-wrap gap-1">
              <Button className="text-xs" onClick={() => acao(() => avaliarEntrega(e.id, "aprovar", comentario))}>Aprovar (+{m.pontos ?? 0})</Button>
              <Button variant="outline" className="text-xs" onClick={() => acao(() => avaliarEntrega(e.id, "ajustes", comentario))}>Pedir ajustes</Button>
              <Button variant="ghost" className="text-xs text-destructive" onClick={() => acao(() => avaliarEntrega(e.id, "recusar", comentario))}>Recusar</Button>
            </div>
          </div>
        )}
        {e.status === "concluida" && e.permiteDestaque && !e.destacadaEm && (
          <Button variant="outline" className="text-xs" onClick={() => acao(() => destacarEntrega(e.id))}><Star className="size-3" aria-hidden="true" />Destacar na comunidade</Button>
        )}
        {e.destacadaEm && <p className="text-xs text-accent">⭐ Destacada na comunidade</p>}
        {erro && <p role="alert" className="text-xs text-destructive">{erro}</p>}
      </div>
    </li>
  );
}

// ---------- Placar e prêmios ----------

function AbaPlacar({ evento, versao }: { evento: Evento; versao: unknown }) {
  const campanha = carregarBase().campanhasMissoes.find((c) => c.eventoId === evento.id);
  const encerrada = !!campanha?.encerradaEm;
  const { confirmar } = useConfirmacao();
  const [premios, setPremios] = useState<string[]>(() => evento.exercitos.map((_, i) => campanha?.premios.find((p) => p.colocacao === i + 1)?.descricao ?? ""));
  const [erro, setErro] = useState("");
  const [ok, setOk] = useState("");
  const acao = async (fn: () => Promise<unknown>, sucesso: string) => { setErro(""); setOk(""); try { await fn(); setOk(sucesso); } catch (e) { setErro(msg(e)); } };
  return (
    <div className="space-y-6">
      <Card><PlacarCompleto eventoId={evento.id} versao={versao} /></Card>
      <Card className="space-y-3">
        <h3 className="flex items-center gap-2 font-display text-base font-semibold uppercase"><Trophy className="size-4 text-accent" aria-hidden="true" />Prêmios no dia do evento</h3>
        <p className="text-sm text-muted-foreground">Declare antes, para todos saberem pelo que estão jogando. Ex.: "Começa com a base norte", "1 respawn extra", "Escolhe o lado do campo".</p>
        {premios.map((p, i) => (
          <Campo key={i} rotulo={`${i + 1}º lugar`} htmlFor={`premio-${i}`}>
            <Input id={`premio-${i}`} maxLength={300} disabled={encerrada} value={p} onChange={(e) => setPremios((xs) => xs.map((x, j) => (j === i ? e.target.value : x)))} />
          </Campo>
        ))}
        {erro && <p role="alert" className="text-sm text-destructive">{erro}</p>}
        {ok && <p role="status" className="text-sm text-success">{ok}</p>}
        {!encerrada && (
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => acao(() => salvarPremios(evento.id, premios.map((d, i) => ({ colocacao: i + 1, descricao: d }))), "Prêmios salvos.")}>Salvar prêmios</Button>
            <Button variant="outline" onClick={async () => (await confirmar({ titulo: "Encerrar a campanha?", descricao: "O placar congela, os prêmios são definidos e o resultado vai para a comunidade. Não dá para desfazer.", confirmar: "Encerrar e anunciar" })) && acao(() => encerrarCampanha(evento.id), "Campanha encerrada e resultado publicado.")}>
              Encerrar campanha e anunciar resultado
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}
