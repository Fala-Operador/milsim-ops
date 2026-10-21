import { nomeModalidade } from "@/lib/modalidades";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { selecionarEventoOrganizacao } from "@/contexts/OrganizationEventContext";
import { useEffect, useState } from "react";
import { carregarBase } from "@/services/db";
import { inscricoesAtivasDoEvento } from "@/services/inscricoes";
import { validarParaPublicacao } from "@/services/organizador";
import { cancelarEvento, excluirEvento, publicarEvento } from "@/api/organizador.functions";
import { useAuth } from "@/contexts/AuthContext";
import { formatarBRL, formatarDataBR } from "@/lib/domain/money";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { Campo, Modal } from "@/components/ui";
import { eventoVazio } from "@/components/editorEvento/eventoVazio";
import { EventEditorDrawer } from "@/components/editorEvento/EventEditorDrawer";
import { AvisoLotes, useEventosOrg } from "@/components/organizacao";
import { AvisoRecebimento } from "@/components/AvisoRecebimento";
import type { Evento } from "@/lib/domain/types";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const Route = createFileRoute("/organizacao/")({
  // ?lotes=<eventoId> abre a edição do evento direto na seção de lotes de venda.
  validateSearch: (s: Record<string, unknown>): { lotes?: string } =>
    typeof s["lotes"] === "string" ? { lotes: s["lotes"] } : {},
  head: () => ({
    meta: [
      { title: "Painel da organização — MilSim Ops" },
      { name: "description", content: "Visão geral dos eventos da organização: ocupação, receita e gestão." },
      { property: "og:title", content: "Painel da organização — MilSim Ops" },
      { property: "og:description", content: "Visão geral dos eventos da organização: ocupação, receita e gestão." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PainelEventos,
});

const tomStatusEvento: Record<Evento["status"], "secondary" | "success" | "warning" | "destructive"> = {
  rascunho: "secondary",
  publicado: "success",
  inscricoes_encerradas: "warning",
  concluido: "secondary",
  cancelado: "destructive",
  arquivado: "secondary",
};

function PainelEventos() {
  const { usuario } = useAuth();
  const navigate = useNavigate();
  const { base, eventos, orgId } = useEventosOrg();
  const [, setVersao] = useState(0);
  const [cancelarEvt, setCancelarEvt] = useState<Evento | null>(null);
  const [justificativa, setJustificativa] = useState("");
  const [erro, setErro] = useState("");
  const [form, setFormEstado] = useState<{ evento: Evento; existente: boolean } | null>(null);
  const [aviso, setAviso] = useState("");
  const [excluirEvt, setExcluirEvt] = useState<Evento | null>(null);
  const [busca, setBusca] = useState("");
  const [filtroStatus, setFiltroStatus] = useState<"todos" | Evento["status"]>("todos");
  const [focarLotes, setFocarLotes] = useState(false);
  const { lotes: lotesDe } = Route.useSearch();
  const abrirEditor = (e: Evento, lotes: boolean) => {
    setAviso("");
    setFocarLotes(lotes);
    setFormEstado({ evento: structuredClone(e), existente: true });
  };
  useEffect(() => {
    const e = lotesDe && eventos.find((x) => x.id === lotesDe);
    if (e && !["cancelado", "concluido"].includes(e.status)) {
      abrirEditor(e, true);
      navigate({ to: "/organizacao", search: {}, replace: true });
    }
  }, [lotesDe, eventos, navigate]);
  const configurarLotes = (e: Evento) => abrirEditor(e, true);

  if (!usuario) return null;

  const ocupacaoDe = (id: string) => {
    const ativas = base.inscricoes.filter((i) => i.eventoId === id && i.status === "confirmada");
    const porExercito: Record<string, number> = {};
    for (const i of ativas) porExercito[i.exercitoId] = (porExercito[i.exercitoId] ?? 0) + 1;
    return { total: ativas.length, porExercito };
  };

  const ativasPorEvento = (id: string) => base.inscricoes.filter((i) => i.eventoId === id && i.status === "confirmada").length;
  const receitaEvento = (id: string) => base.movimentacoes.filter((m) => m.eventoId === id).reduce((t, m) => t + m.valorCentavos, 0);
  const totalInscritos = eventos.reduce((t, e) => t + ativasPorEvento(e.id), 0);
  const totalCapacidade = eventos.filter((e) => e.status !== "cancelado").reduce((t, e) => t + e.capacidadeTotal, 0);
  const totalReceita = eventos.reduce((t, e) => t + receitaEvento(e.id), 0);
  const agora = Date.now();
  const proximos = eventos.filter((e) => new Date(e.inicioEm).getTime() > agora && e.status !== "cancelado");
  const filtrados = eventos.filter(
    (e) => (filtroStatus === "todos" || e.status === filtroStatus) && e.nome.toLowerCase().includes(busca.toLowerCase()),
  );


  const aoExcluir = async () => {
    if (!excluirEvt) return;
    setErro("");
    try {
      await excluirEvento(excluirEvt.id);
      setExcluirEvt(null);
      setVersao((v) => v + 1);
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Falha ao excluir.");
      setExcluirEvt(null);
    }
  };

  const aoPublicar = async (ev: Evento) => {
    setErro("");
    try {
      await publicarEvento(ev.id);
      setVersao((v) => v + 1);
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Falha ao publicar.");
    }
  };

  const aoCancelarEvento = async () => {
    if (!cancelarEvt) return;
    setErro("");
    try {
      const r = await cancelarEvento(cancelarEvt.id, justificativa);
      alert(`Evento cancelado. ${r.canceladas} inscrições estornadas e participantes notificados.`);
      setCancelarEvt(null);
      setJustificativa("");
      setVersao((v) => v + 1);
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Falha ao cancelar.");
    }
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-lg font-semibold uppercase">
          {orgId ? (base.organizacoes.find((o) => o.id === orgId)?.nome ?? "Painel") : "Todas as organizações"}
        </h2>
        {(() => {
          const sem = eventos.filter((e) => !e.modalidade && e.status !== "cancelado" && e.status !== "concluido");
          return sem.length > 0 ? (
            <p role="status" className="basis-full rounded-md border border-dashed border-accent/60 px-3 py-2 text-sm">
              {sem.length === 1 ? "1 evento está" : `${sem.length} eventos estão`} sem modalidade: {sem.map((e) => e.nome || "Sem nome").join(", ")}. Edite para completar o cadastro.
            </p>
          ) : null;
        })()}
        <Button onClick={() => { setFocarLotes(false); const idOrg = orgId ?? base.organizacoes[0]?.id ?? ""; setFormEstado({ evento: eventoVazio(idOrg, base.organizacoes.find((o) => o.id === idOrg)?.telefone), existente: false }); }}>+ Criar evento</Button>
      </div>

      {aviso && <p role="status" className="mt-3 rounded-md border border-success/40 bg-success/10 px-3 py-2 text-sm">{aviso}</p>}
      {erro && <p role="alert" className="mt-3 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">{erro}</p>}

      <section aria-label="Visão geral" className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {([
          ["Eventos", String(eventos.length), `${eventos.filter((e) => e.status === "publicado").length} publicados · ${eventos.filter((e) => e.status === "rascunho").length} rascunhos`],
          ["Próximos eventos", String(proximos.length), proximos[0] ? `Próximo: ${formatarDataBR([...proximos].sort((x, y) => x.inicioEm.localeCompare(y.inicioEm))[0]!.inicioEm)}` : "Nenhum agendado"],
          ["Inscrições ativas", String(totalInscritos), totalCapacidade ? `${Math.round((totalInscritos / totalCapacidade) * 100)}% da capacidade total` : "—"],
          ["Receita registrada", formatarBRL(totalReceita), "Soma das movimentações"],
        ] as const).map(([rotulo, valor, sub]) => (
          <Card key={rotulo}>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">{rotulo}</p>
            <p className="mt-1 font-mono text-2xl font-semibold">{valor}</p>
            <p className="mt-1 text-xs text-muted-foreground">{sub}</p>
          </Card>
        ))}
      </section>

      <AvisoRecebimento organizacaoId={orgId} className="mt-6" />

      <Card className="mt-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="font-display text-lg font-semibold uppercase">Meus eventos</h3>
          <div className="grid w-full gap-2 sm:w-auto sm:grid-cols-2">
            <Input aria-label="Buscar evento" placeholder="Buscar por nome…" value={busca} onChange={(e) => setBusca(e.target.value)} />
            <NativeSelect aria-label="Filtrar por status" value={filtroStatus} onChange={(e) => setFiltroStatus(e.target.value as typeof filtroStatus)}>
              <option value="todos">Todos os status</option>
              {Object.keys(tomStatusEvento).map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
            </NativeSelect>
          </div>
        </div>
        <div className="mt-4 overflow-x-auto">
          <Table className="tabela-cards w-full text-sm">
            <TableHeader>
              <TableRow className="border-b border-border text-left text-xs uppercase text-muted-foreground">
                <TableHead className="py-2 pr-3">Evento</TableHead>
                <TableHead className="py-2 pr-3">Data</TableHead>
                <TableHead className="py-2 pr-3">Status</TableHead>
                <TableHead className="py-2 pr-3">Manual</TableHead>
                <TableHead className="py-2 pr-3">Ocupação</TableHead>
                <TableHead className="py-2 pr-3">Receita</TableHead>
                <TableHead className="py-2 text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtrados.map((e) => {
                const ativas = ativasPorEvento(e.id);
                const pct = e.capacidadeTotal ? Math.min(100, Math.round((ativas / e.capacidadeTotal) * 100)) : 0;
                return (
                  <TableRow key={e.id} className="border-b border-border/50">
                    <TableCell className="py-2 pr-3">
                      <p className="font-medium">{e.nome || "Sem nome"}</p>
                      <p className="text-xs text-muted-foreground">{e.cidade || "—"}/{e.uf} · <span className={e.modalidade ? "" : "text-warning"}>{nomeModalidade(e.modalidade)}</span></p>
                      {!["cancelado", "concluido", "arquivado"].includes(e.status) && (
                        <AvisoLotes evento={e} compacto onConfigurar={() => configurarLotes(e)} />
                      )}
                    </TableCell>
                    <TableCell data-rotulo="Data" className="py-2 pr-3 whitespace-nowrap">{formatarDataBR(e.inicioEm)}</TableCell>
                    <TableCell data-rotulo="Status" className="py-2 pr-3"><Badge variant={tomStatusEvento[e.status]}>{e.status.replace("_", " ")}</Badge></TableCell>
                    <TableCell data-rotulo="Manual" className="py-2 pr-3">
                      {e.regras ? <Badge variant="success">v{e.regras.versao}</Badge> : <span className="text-xs text-muted-foreground">sem manual</span>}
                    </TableCell>
                    <TableCell data-rotulo="Ocupação" className="py-2 pr-3 min-w-32">
                      <p className="text-xs">{ativas}/{e.capacidadeTotal}</p>
                      <div className="mt-1 h-1.5 w-24 rounded bg-muted lg:w-auto"><div className="h-1.5 rounded bg-primary" style={{ width: `${pct}%` }} /></div>
                    </TableCell>
                    <TableCell data-rotulo="Receita" className="py-2 pr-3 font-mono whitespace-nowrap">{formatarBRL(receitaEvento(e.id))}</TableCell>
                    <TableCell className="celula-acoes py-2">
                      <div className="flex flex-wrap gap-1 lg:justify-end">
                        {e.status === "rascunho" && <Button variant="ghost" onClick={() => aoPublicar(e)}>Publicar</Button>}
                        {e.status === "publicado" && <Button variant="ghost" onClick={() => setCancelarEvt(e)}>Cancelar</Button>}
                        {["publicado", "inscricoes_encerradas"].includes(e.status) && (
                          <Link to="/eventos/$eventoId" params={{ eventoId: e.id }}>
                            <Button variant="ghost">Página pública</Button>
                          </Link>
                        )}
                        <Button variant="ghost" onClick={() => { selecionarEventoOrganizacao(e.id); navigate({ to: "/organizacao/checkin" }); }}>Abrir check-in</Button>
                        <Button variant="outline" onClick={() => abrirEditor(e, false)} disabled={["cancelado", "concluido"].includes(e.status)}>Editar</Button>
                        <Button variant="destructive" onClick={() => setExcluirEvt(e)}>Excluir</Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
              {filtrados.length === 0 && (
                <TableRow className="!border-0"><TableCell colSpan={7} className="py-6 text-center text-muted-foreground">Nenhum evento encontrado.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      {form && (
        <EventEditorDrawer
          key={form.evento.id}
          inicial={form.evento}
          existente={form.existente}
          {...(focarLotes ? { etapaInicial: 4 } : {})}
          ocupacao={ocupacaoDe(form.evento.id)}
          ocupacaoLote={(loteId, tipoId) => base.inscricoes.filter((i) => i.eventoId === form.evento.id && i.status === "confirmada" && i.loteId === loteId && i.tipoId === tipoId).length}
          organizacoes={base.organizacoes.filter((o) => usuario.perfil === "admin" || o.id === form.evento.organizacaoId).map((o) => ({ id: o.id, nome: o.nome }))}
          podeEscolherOrg={usuario.perfil === "admin"}
          onFechar={() => { setFormEstado(null); setVersao((v) => v + 1); }}
          onConcluido={(m) => setAviso(m)}
        />
      )}

      <Modal aberto={!!excluirEvt} titulo="Excluir evento" onFechar={() => setExcluirEvt(null)}>
        {excluirEvt && (
          <div className="space-y-3 text-sm">
            <p>Tem certeza que deseja excluir <strong>{excluirEvt.nome || "este evento"}</strong>? Esta ação não pode ser desfeita.</p>
            {ativasPorEvento(excluirEvt.id) > 0 && (
              <p className="rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-warning">
                Este evento tem {ativasPorEvento(excluirEvt.id)} inscrições confirmadas e não pode ser excluído. Use “Cancelar” para estornar os participantes.
              </p>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setExcluirEvt(null)}>Voltar</Button>
              <Button variant="destructive" onClick={aoExcluir} disabled={ativasPorEvento(excluirEvt.id) > 0}>Excluir</Button>
            </div>
          </div>
        )}
      </Modal>

      <Modal aberto={!!cancelarEvt} titulo="Cancelar evento" onFechar={() => setCancelarEvt(null)}>
        {cancelarEvt && (
          <div className="space-y-3 text-sm">
            <p className="rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-warning">
              Impacto: {inscricoesAtivasDoEvento(carregarBase(), cancelarEvt.id).length} inscrições ativas serão
              canceladas com estorno integral e os participantes serão notificados na plataforma.
            </p>
            <Campo rotulo="Justificativa (obrigatória)" htmlFor="just">
              <Textarea id="just" value={justificativa} onChange={(e) => setJustificativa(e.target.value)} />
            </Campo>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setCancelarEvt(null)}>Voltar</Button>
              <Button variant="destructive" onClick={aoCancelarEvento}>Confirmar cancelamento</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
