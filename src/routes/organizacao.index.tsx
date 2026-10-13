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
import { AreaTexto, Badge, Botao, Campo, Cartao, Entrada, Modal, Selecao } from "@/components/ui";
import { eventoVazio } from "@/components/FormEvento";
import { EventEditorDrawer } from "@/components/editorEvento/EventEditorDrawer";
import { AvisoLotes, useEventosOrg } from "@/components/organizacao";
import type { Evento } from "@/lib/domain/types";

export const Route = createFileRoute("/organizacao/")({
  // ?lotes=<eventoId> abre a edição do evento direto na seção de lotes de venda.
  validateSearch: (s: Record<string, unknown>): { lotes?: string } =>
    typeof s["lotes"] === "string" ? { lotes: s["lotes"] } : {},
  head: () => ({
    meta: [
      { title: "Painel da organização — MilSim Ops" },
      { name: "description", content: "Visão geral dos eventos da organização: ocupação, receita e gestão." },
    ],
  }),
  component: PainelEventos,
});

const tomStatusEvento: Record<Evento["status"], "padrao" | "sucesso" | "aviso" | "perigo"> = {
  rascunho: "padrao",
  publicado: "sucesso",
  inscricoes_encerradas: "aviso",
  concluido: "padrao",
  cancelado: "perigo",
  arquivado: "padrao",
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
        <Botao onClick={() => { setFocarLotes(false); setFormEstado({ evento: eventoVazio(orgId ?? base.organizacoes[0]?.id ?? ""), existente: false }); }}>+ Criar evento</Botao>
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
          <Cartao key={rotulo}>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">{rotulo}</p>
            <p className="mt-1 font-mono text-2xl font-semibold">{valor}</p>
            <p className="mt-1 text-xs text-muted-foreground">{sub}</p>
          </Cartao>
        ))}
      </section>

      <Cartao className="mt-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="font-display text-lg font-semibold uppercase">Meus eventos</h3>
          <div className="grid w-full gap-2 sm:w-auto sm:grid-cols-2">
            <Entrada aria-label="Buscar evento" placeholder="Buscar por nome…" value={busca} onChange={(e) => setBusca(e.target.value)} />
            <Selecao aria-label="Filtrar por status" value={filtroStatus} onChange={(e) => setFiltroStatus(e.target.value as typeof filtroStatus)}>
              <option value="todos">Todos os status</option>
              {Object.keys(tomStatusEvento).map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
            </Selecao>
          </div>
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase text-muted-foreground">
                <th className="py-2 pr-3">Evento</th>
                <th className="py-2 pr-3">Data</th>
                <th className="py-2 pr-3">Status</th>
                <th className="py-2 pr-3">Manual</th>
                <th className="py-2 pr-3">Ocupação</th>
                <th className="py-2 pr-3">Receita</th>
                <th className="py-2 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map((e) => {
                const ativas = ativasPorEvento(e.id);
                const pct = e.capacidadeTotal ? Math.min(100, Math.round((ativas / e.capacidadeTotal) * 100)) : 0;
                return (
                  <tr key={e.id} className="border-b border-border/50">
                    <td className="py-2 pr-3">
                      <p className="font-medium">{e.nome || "Sem nome"}</p>
                      <p className="text-xs text-muted-foreground">{e.cidade || "—"}/{e.uf} · <span className={e.modalidade ? "" : "text-warning"}>{nomeModalidade(e.modalidade)}</span></p>
                      {!["cancelado", "concluido", "arquivado"].includes(e.status) && (
                        <AvisoLotes evento={e} compacto onConfigurar={() => configurarLotes(e)} />
                      )}
                    </td>
                    <td className="py-2 pr-3 whitespace-nowrap">{formatarDataBR(e.inicioEm)}</td>
                    <td className="py-2 pr-3"><Badge tom={tomStatusEvento[e.status]}>{e.status.replace("_", " ")}</Badge></td>
                    <td className="py-2 pr-3">
                      {e.regras ? <Badge tom="sucesso">v{e.regras.versao}</Badge> : <span className="text-xs text-muted-foreground">sem manual</span>}
                    </td>
                    <td className="py-2 pr-3 min-w-32">
                      <p className="text-xs">{ativas}/{e.capacidadeTotal}</p>
                      <div className="mt-1 h-1.5 rounded bg-muted"><div className="h-1.5 rounded bg-primary" style={{ width: `${pct}%` }} /></div>
                    </td>
                    <td className="py-2 pr-3 font-mono whitespace-nowrap">{formatarBRL(receitaEvento(e.id))}</td>
                    <td className="py-2">
                      <div className="flex flex-wrap justify-end gap-1">
                        {e.status === "rascunho" && <Botao variante="fantasma" onClick={() => aoPublicar(e)}>Publicar</Botao>}
                        {e.status === "publicado" && <Botao variante="fantasma" onClick={() => setCancelarEvt(e)}>Cancelar</Botao>}
                        {["publicado", "inscricoes_encerradas"].includes(e.status) && (
                          <Link to="/eventos/$eventoId" params={{ eventoId: e.id }}>
                            <Botao variante="fantasma">Página pública</Botao>
                          </Link>
                        )}
                        <Botao variante="fantasma" onClick={() => { selecionarEventoOrganizacao(e.id); navigate({ to: "/organizacao/checkin" }); }}>Abrir check-in</Botao>
                        <Botao variante="contorno" onClick={() => abrirEditor(e, false)} disabled={["cancelado", "concluido"].includes(e.status)}>Editar</Botao>
                        <Botao variante="perigo" onClick={() => setExcluirEvt(e)}>Excluir</Botao>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtrados.length === 0 && (
                <tr><td colSpan={7} className="py-6 text-center text-muted-foreground">Nenhum evento encontrado.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Cartao>

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
              <Botao variante="fantasma" onClick={() => setExcluirEvt(null)}>Voltar</Botao>
              <Botao variante="perigo" onClick={aoExcluir} disabled={ativasPorEvento(excluirEvt.id) > 0}>Excluir</Botao>
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
              <AreaTexto id="just" value={justificativa} onChange={(e) => setJustificativa(e.target.value)} />
            </Campo>
            <div className="flex justify-end gap-2">
              <Botao variante="fantasma" onClick={() => setCancelarEvt(null)}>Voltar</Botao>
              <Botao variante="perigo" onClick={aoCancelarEvento}>Confirmar cancelamento</Botao>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
