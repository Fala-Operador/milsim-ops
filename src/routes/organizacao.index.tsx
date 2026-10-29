import { FaixaIndicadores } from "@/components/FaixaIndicadores";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Plus } from "lucide-react";
import { nomeModalidade } from "@/lib/modalidades";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { selecionarEventoOrganizacao } from "@/contexts/OrganizationEventContext";
import { useEffect, useState } from "react";
import { carregarBase } from "@/services/db";
import { inscricoesAtivasDoEvento } from "@/services/inscricoes";
import { validarParaPublicacao } from "@/services/organizador";
import { cancelarEvento, excluirEvento, publicarEvento } from "@/api/organizador.functions";
import { useAuth } from "@/contexts/AuthContext";
import { useConfirmacao } from "@/contexts/ConfirmacaoContext";
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
import { tr } from "@/i18n/routes/organizacao.index";
import { ROTULO_STATUS_EVENTO } from "@/components/OperacaoSelecionada";

export const Route = createFileRoute("/organizacao/")({
  // ?lotes=<eventoId> abre a edição do evento direto na seção de lotes de venda.
  validateSearch: (s: Record<string, unknown>): { lotes?: string } =>
    typeof s["lotes"] === "string" ? { lotes: s["lotes"] } : {},
  head: () => ({
    meta: [
      { title: tr("painel_da_organizacao_milsim_ops") },
      { name: "description", content: tr("visao_geral_dos_eventos_da_organizacao") },
      { property: "og:title", content: tr("painel_da_organizacao_milsim_ops") },
      { property: "og:description", content: tr("visao_geral_dos_eventos_da_organizacao") },
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
  const { avisar } = useConfirmacao();
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
      setErro(err instanceof Error ? err.message : tr("falha_ao_excluir"));
      setExcluirEvt(null);
    }
  };

  const aoPublicar = async (ev: Evento) => {
    setErro("");
    try {
      await publicarEvento(ev.id);
      setVersao((v) => v + 1);
    } catch (err) {
      setErro(err instanceof Error ? err.message : tr("falha_ao_publicar"));
    }
  };

  const aoCancelarEvento = async () => {
    if (!cancelarEvt) return;
    setErro("");
    try {
      const r = await cancelarEvento(cancelarEvt.id, justificativa);
      void avisar({ titulo: tr("evento_cancelado"), descricao: tr("canceladas_inscricoes_estornadas_e_parti", { canceladas: r.canceladas }) });
      setCancelarEvt(null);
      setJustificativa("");
      setVersao((v) => v + 1);
    } catch (err) {
      setErro(err instanceof Error ? err.message : tr("falha_ao_cancelar"));
    }
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="titulo-pagina">
          {orgId ? (base.organizacoes.find((o) => o.id === orgId)?.nome ?? tr("painel")) : tr("todas_as_organizacoes")}
        </h2>
        {(() => {
          const sem = eventos.filter((e) => !e.modalidade && e.status !== "cancelado" && e.status !== "concluido");
          return sem.length > 0 ? (
            <p role="status" className="order-last basis-full border-l-2 border-warning bg-warning/10 px-3 py-2 text-sm">
              {sem.length === 1 ? tr("1_evento_esta") : tr("length_eventos_estao", { length: sem.length })}{" "}{tr("sem_modalidade")}{" "}{sem.map((e) => e.nome || tr("sem_nome")).join(", ")}{tr("edite_para_completar_o_cadastro")}</p>
          ) : null;
        })()}
        <Button onClick={() => { setFocarLotes(false); const idOrg = orgId ?? base.organizacoes[0]?.id ?? ""; setFormEstado({ evento: eventoVazio(idOrg, base.organizacoes.find((o) => o.id === idOrg)?.telefone), existente: false }); }}><Plus className="h-4 w-4" aria-hidden />{tr("criar_evento")}</Button>
      </div>

      {aviso && <p role="status" className="mt-3 rounded-md border border-success/40 bg-success/10 px-3 py-2 text-sm">{aviso}</p>}
      {erro && <p role="alert" className="mt-3 whitespace-pre-line rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">{erro}</p>}

      <FaixaIndicadores className="mt-6 lg:grid-cols-4" itens={[
        { rotulo: tr("eventos"), valor: String(eventos.length), detalhe: tr("length_publicados_length2_rascunhos", { length: eventos.filter((e) => e.status === "publicado").length, length2: eventos.filter((e) => e.status === "rascunho").length }) },
        { rotulo: tr("proximos"), valor: String(proximos.length), detalhe: proximos[0] ? tr("proximo_inicioem", { inicioEm: formatarDataBR([...proximos].sort((x, y) => x.inicioEm.localeCompare(y.inicioEm))[0]!.inicioEm) }) : tr("nenhum_agendado") },
        { rotulo: tr("inscricoes_ativas"), valor: String(totalInscritos), detalhe: totalCapacidade ? tr("valor_da_capacidade_total", { valor: Math.round((totalInscritos / totalCapacidade) * 100) }) : "—" },
        { rotulo: tr("receita"), valor: formatarBRL(totalReceita), detalhe: tr("soma_das_movimentacoes") },
      ]} />

      <AvisoRecebimento organizacaoId={orgId} className="mt-6" />

      <section className="mt-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="font-display text-lg font-semibold uppercase">{tr("meus_eventos")}</h3>
          <div className="grid w-full gap-2 sm:w-auto sm:grid-cols-2">
            <Input aria-label={tr("buscar_evento")} placeholder={tr("buscar_por_nome")} value={busca} onChange={(e) => setBusca(e.target.value)} />
            <NativeSelect aria-label={tr("filtrar_por_status")} value={filtroStatus} onChange={(e) => setFiltroStatus(e.target.value as typeof filtroStatus)}>
              <option value="todos">{tr("todos_os_status")}</option>
              {Object.keys(tomStatusEvento).map((s) => <option key={s} value={s}>{ROTULO_STATUS_EVENTO[s] ?? s}</option>)}
            </NativeSelect>
          </div>
        </div>
        <div className="mt-4 overflow-x-auto">
          <Table className="tabela-cards w-full text-sm">
            <TableHeader>
              <TableRow className="border-b border-border text-left text-xs uppercase text-muted-foreground">
                <TableHead className="py-2 pr-3">{tr("evento")}</TableHead>
                <TableHead className="py-2 pr-3">{tr("data")}</TableHead>
                <TableHead className="py-2 pr-3">{tr("status")}</TableHead>
                <TableHead className="py-2 pr-3">{tr("manual")}</TableHead>
                <TableHead className="py-2 pr-3">{tr("ocupacao")}</TableHead>
                <TableHead className="py-2 pr-3">{tr("receita")}</TableHead>
                <TableHead className="py-2 text-right">{tr("acoes")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtrados.map((e) => {
                const ativas = ativasPorEvento(e.id);
                const pct = e.capacidadeTotal ? Math.min(100, Math.round((ativas / e.capacidadeTotal) * 100)) : 0;
                return (
                  <TableRow key={e.id} className="border-b border-border/50">
                    <TableCell className="py-2 pr-3">
                      <p className="font-medium">{e.nome || tr("sem_nome")}</p>
                      <p className="text-xs text-muted-foreground">{e.cidade || "—"}/{e.uf} · <span className={e.modalidade ? "" : "text-warning"}>{nomeModalidade(e.modalidade)}</span></p>
                      {!["cancelado", "concluido", "arquivado"].includes(e.status) && (
                        <AvisoLotes evento={e} compacto onConfigurar={() => configurarLotes(e)} />
                      )}
                    </TableCell>
                    <TableCell data-rotulo={tr("data")} className="py-2 pr-3 whitespace-nowrap">{formatarDataBR(e.inicioEm)}</TableCell>
                    <TableCell data-rotulo={tr("status")} className="py-2 pr-3"><Badge variant={tomStatusEvento[e.status]}>{ROTULO_STATUS_EVENTO[e.status] ?? e.status}</Badge></TableCell>
                    <TableCell data-rotulo={tr("manual")} className="py-2 pr-3">
                      {e.regras ? <Badge variant="success">v{e.regras.versao}</Badge> : <span className="text-xs text-muted-foreground">{tr("sem_manual")}</span>}
                    </TableCell>
                    <TableCell data-rotulo={tr("ocupacao")} className="py-2 pr-3 min-w-32">
                      <p className="text-xs">{ativas}/{e.capacidadeTotal}</p>
                      <div className="mt-1 h-1.5 w-24 rounded bg-muted lg:w-auto"><div className="h-1.5 rounded bg-primary" style={{ width: `${pct}%` }} /></div>
                    </TableCell>
                    <TableCell data-rotulo={tr("receita")} className="py-2 pr-3 font-mono whitespace-nowrap">{formatarBRL(receitaEvento(e.id))}</TableCell>
                    <TableCell className="celula-acoes py-2">
                      <div className="flex items-center gap-1 lg:justify-end">
                        <Button variant="outline" size="sm" onClick={() => abrirEditor(e, false)} disabled={["cancelado", "concluido"].includes(e.status)}>{tr("editar")}</Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" aria-label={tr("mais_acoes_de_nome", { nome: e.nome })}><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48">
                            {e.status === "rascunho" && <DropdownMenuItem onClick={() => aoPublicar(e)}>{tr("publicar")}</DropdownMenuItem>}
                            {["publicado", "inscricoes_encerradas"].includes(e.status) && <DropdownMenuItem asChild><Link to="/eventos/$eventoId" params={{ eventoId: e.id }}>{tr("ver_pagina_publica")}</Link></DropdownMenuItem>}
                            <DropdownMenuItem onClick={() => { selecionarEventoOrganizacao(e.id); navigate({ to: "/organizacao/checkin" }); }}>{tr("abrir_check_in")}</DropdownMenuItem>
                            {e.status === "publicado" && <DropdownMenuItem onClick={() => setCancelarEvt(e)}>{tr("cancelar_evento")}</DropdownMenuItem>}
                            <DropdownMenuItem className="text-destructive" onClick={() => setExcluirEvt(e)}>{tr("excluir")}</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
              {filtrados.length === 0 && (
                <TableRow className="!border-0"><TableCell colSpan={7} className="py-6 text-center text-muted-foreground">{tr("nenhum_evento_encontrado")}</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </section>

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

      <Modal aberto={!!excluirEvt} titulo={tr("excluir_evento")} onFechar={() => setExcluirEvt(null)}>
        {excluirEvt && (
          <div className="space-y-3 text-sm">
            <p>{tr("tem_certeza_que_deseja_excluir")}{" "}<strong>{excluirEvt.nome || tr("este_evento")}</strong>{tr("esta_acao_nao_pode_ser_desfeita")}</p>
            {ativasPorEvento(excluirEvt.id) > 0 && (
              <p className="rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-warning">{tr("este_evento_tem_id_inscricoes_confirmada", { id: ativasPorEvento(excluirEvt.id) })}</p>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setExcluirEvt(null)}>{tr("voltar")}</Button>
              <Button variant="destructive" onClick={aoExcluir} disabled={ativasPorEvento(excluirEvt.id) > 0}>{tr("excluir")}</Button>
            </div>
          </div>
        )}
      </Modal>

      <Modal aberto={!!cancelarEvt} titulo={tr("cancelar_evento")} onFechar={() => setCancelarEvt(null)}>
        {cancelarEvt && (
          <div className="space-y-3 text-sm">
            <p className="rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-warning">{tr("impacto_length_inscricoes_ativas_serao_c", { length: inscricoesAtivasDoEvento(carregarBase(), cancelarEvt.id).length })}</p>
            <Campo rotulo={tr("justificativa_obrigatoria")} htmlFor="just">
              <Textarea id="just" value={justificativa} onChange={(e) => setJustificativa(e.target.value)} />
            </Campo>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setCancelarEvt(null)}>{tr("voltar")}</Button>
              <Button variant="destructive" onClick={aoCancelarEvento}>{tr("confirmar_cancelamento")}</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
