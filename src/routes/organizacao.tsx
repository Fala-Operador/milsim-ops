import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { carregarBase } from "@/services/db";
import { resumoFinanceiro, inscricoesAtivasDoEvento } from "@/services/inscricoes";
import {
  cancelarEvento,
  criarCortesia,
  criarCupom,
  excluirEvento,
  publicarEvento,
  salvarEvento,
  validarParaPublicacao,
} from "@/services/organizador";
import { useAuth } from "@/contexts/AuthContext";
import { formatarBRL, formatarDataBR } from "@/lib/domain/money";
import { mascararCpf } from "@/lib/domain/validators";
import { AreaTexto, Badge, Botao, Campo, Cartao, Entrada, Modal, Selecao, SkeletonPagina } from "@/components/ui";
import { FormEvento, eventoVazio } from "@/components/FormEvento";
import type { Evento } from "@/lib/domain/types";

export const Route = createFileRoute("/organizacao")({
  head: () => ({
    meta: [
      { title: "Minha organização — MilSim Ops" },
      { name: "description", content: "Painel do organizador: eventos, inscritos, cupons, cortesias e financeiro simulado." },
      { property: "og:title", content: "Minha organização — MilSim Ops" },
      { property: "og:description", content: "Painel do organizador." },
    ],
  }),
  component: PainelOrganizacao,
});

const tomStatusEvento: Record<Evento["status"], "padrao" | "sucesso" | "aviso" | "perigo"> = {
  rascunho: "padrao",
  publicado: "sucesso",
  inscricoes_encerradas: "aviso",
  concluido: "padrao",
  cancelado: "perigo",
  arquivado: "padrao",
};

function PainelOrganizacao() {
  const { usuario } = useAuth();
  const navigate = useNavigate();
  const [, setVersao] = useState(0);
  const [selecionado, setSelecionado] = useState<string | null>(null);
  const [cancelarEvt, setCancelarEvt] = useState<Evento | null>(null);
  const [justificativa, setJustificativa] = useState("");
  const [erro, setErro] = useState("");
  const [cupomForm, setCupomForm] = useState({ codigo: "", desconto: "10", limite: "10", validoAte: "" });
  const [cortesiaForm, setCortesiaForm] = useState({ nome: "", email: "", tipoId: "", validade: "" });
  const [form, setForm] = useState<Evento | null>(null);
  const [excluirEvt, setExcluirEvt] = useState<Evento | null>(null);
  const [busca, setBusca] = useState("");
  const [filtroStatus, setFiltroStatus] = useState<"todos" | Evento["status"]>("todos");
  const [aba, setAba] = useState<"inscritos" | "financeiro" | "cupons" | "cortesias">("inscritos");

  useEffect(() => {
    if (usuario && usuario.perfil !== "organizador" && usuario.perfil !== "admin") {
      navigate({ to: "/app" });
    }
  }, [usuario, navigate]);

  const [montado, setMontado] = useState(false);
  useEffect(() => setMontado(true), []);
  if (!usuario || !montado) return <SkeletonPagina />;
  const base = carregarBase();
  const orgId = usuario.perfil === "admin" ? undefined : usuario.organizacaoId;
  const eventos = base.eventos.filter((e) => !orgId || e.organizacaoId === orgId);
  const eventoSel = eventos.find((e) => e.id === selecionado) ?? null;

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

  const aoSalvarForm = async (ev: Evento) => {
    await salvarEvento(ev, usuario.id, usuario.perfil);
    setForm(null);
    setSelecionado(ev.id);
    setVersao((v) => v + 1);
  };

  const aoExcluir = async () => {
    if (!excluirEvt) return;
    setErro("");
    try {
      await excluirEvento(excluirEvt.id, usuario.id, usuario.perfil);
      if (selecionado === excluirEvt.id) setSelecionado(null);
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
      await publicarEvento(ev.id, usuario.id, usuario.perfil);
      setVersao((v) => v + 1);
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Falha ao publicar.");
    }
  };

  const aoCancelarEvento = async () => {
    if (!cancelarEvt) return;
    setErro("");
    try {
      const r = await cancelarEvento(cancelarEvt.id, justificativa, usuario.id, usuario.perfil);
      alert(`Evento cancelado. ${r.canceladas} inscrições estornadas (simulado) e participantes notificados.`);
      setCancelarEvt(null);
      setJustificativa("");
      setVersao((v) => v + 1);
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Falha ao cancelar.");
    }
  };

  const aoCriarCupom = async (eventoId: string) => {
    setErro("");
    try {
      const evento = base.eventos.find((e) => e.id === eventoId)!;
      await criarCupom({
        eventoId,
        codigo: cupomForm.codigo,
        descontoPercentual: Number(cupomForm.desconto),
        validoDe: new Date().toISOString(),
        validoAte: cupomForm.validoAte ? new Date(cupomForm.validoAte).toISOString() : new Date(Date.now() + 30 * 86400000).toISOString(),
        limiteUsos: Number(cupomForm.limite),
        tiposElegiveis: evento.tipos.map((t) => t.id),
        ativo: true,
      });
      setCupomForm({ codigo: "", desconto: "10", limite: "10", validoAte: "" });
      setVersao((v) => v + 1);
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Falha ao criar cupom.");
    }
  };

  const aoCriarCortesia = async (eventoId: string) => {
    setErro("");
    try {
      const codigo = await criarCortesia({
        eventoId,
        nomeConvidado: cortesiaForm.nome,
        emailConvidado: cortesiaForm.email,
        tipoId: cortesiaForm.tipoId,
        validade: cortesiaForm.validade ? new Date(cortesiaForm.validade).toISOString() : new Date(Date.now() + 15 * 86400000).toISOString(),
      });
      alert(`Cortesia criada. Link fictício de uso único: /inscricao/${eventoId}?cortesia=${codigo}`);
      setCortesiaForm({ nome: "", email: "", tipoId: "", validade: "" });
      setVersao((v) => v + 1);
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Falha ao criar cortesia.");
    }
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-semibold uppercase">
          {orgId ? (base.organizacoes.find((o) => o.id === orgId)?.nome ?? "Minha organização") : "Todas as organizações"}
        </h1>
        <Botao onClick={() => setForm(eventoVazio(orgId ?? base.organizacoes[0]?.id ?? ""))}>+ Criar evento</Botao>
      </div>

      {erro && <p role="alert" className="mt-3 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">{erro}</p>}

      <section aria-label="Visão geral" className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {([
          ["Eventos", String(eventos.length), `${eventos.filter((e) => e.status === "publicado").length} publicados · ${eventos.filter((e) => e.status === "rascunho").length} rascunhos`],
          ["Próximos eventos", String(proximos.length), proximos[0] ? `Próximo: ${formatarDataBR(proximos.sort((x, y) => x.inicioEm.localeCompare(y.inicioEm))[0]!.inicioEm)}` : "Nenhum agendado"],
          ["Inscrições ativas", String(totalInscritos), totalCapacidade ? `${Math.round((totalInscritos / totalCapacidade) * 100)}% da capacidade total` : "—"],
          ["Receita simulada", formatarBRL(totalReceita), "Soma das movimentações"],
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
          <h2 className="font-display text-lg font-semibold uppercase">Meus eventos</h2>
          <div className="flex flex-wrap gap-2">
            <Entrada aria-label="Buscar evento" placeholder="Buscar por nome…" value={busca} onChange={(e) => setBusca(e.target.value)} className="w-48" />
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
                  <tr key={e.id} className={`border-b border-border/50 ${selecionado === e.id ? "bg-secondary" : ""}`}>
                    <td className="py-2 pr-3">
                      <p className="font-medium">{e.nome || "Sem nome"}</p>
                      <p className="text-xs text-muted-foreground">{e.cidade || "—"}/{e.uf}</p>
                    </td>
                    <td className="py-2 pr-3 whitespace-nowrap">{formatarDataBR(e.inicioEm)}</td>
                    <td className="py-2 pr-3"><Badge tom={tomStatusEvento[e.status]}>{e.status.replace("_", " ")}</Badge></td>
                    <td className="py-2 pr-3 min-w-32">
                      <p className="text-xs">{ativas}/{e.capacidadeTotal}</p>
                      <div className="mt-1 h-1.5 rounded bg-muted"><div className="h-1.5 rounded bg-primary" style={{ width: `${pct}%` }} /></div>
                    </td>
                    <td className="py-2 pr-3 font-mono whitespace-nowrap">{formatarBRL(receitaEvento(e.id))}</td>
                    <td className="py-2">
                      <div className="flex justify-end gap-1">
                        <Botao variante="fantasma" onClick={() => setSelecionado(e.id)}>Gerenciar</Botao>
                        <Botao variante="contorno" onClick={() => setForm(structuredClone(e))} disabled={["cancelado", "concluido"].includes(e.status)}>Editar</Botao>
                        <Botao variante="perigo" onClick={() => setExcluirEvt(e)}>Excluir</Botao>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtrados.length === 0 && (
                <tr><td colSpan={6} className="py-6 text-center text-muted-foreground">Nenhum evento encontrado.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Cartao>

      <div className="mt-6">
          {!eventoSel ? (
            <Cartao><p className="text-sm text-muted-foreground">Clique em “Gerenciar” em um evento para ver inscritos, financeiro, cupons e cortesias.</p></Cartao>
          ) : (
            <div className="space-y-4">
              <Cartao>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="font-display text-xl font-semibold uppercase">{eventoSel.nome}</h2>
                  <div className="flex gap-2">
                    {eventoSel.status === "rascunho" && (
                      <Botao onClick={() => aoPublicar(eventoSel)}>Publicar</Botao>
                    )}
                    {eventoSel.status === "publicado" && (
                      <Botao variante="perigo" onClick={() => setCancelarEvt(eventoSel)}>Cancelar evento</Botao>
                    )}
                    {["publicado", "inscricoes_encerradas"].includes(eventoSel.status) && (
                      <Link to="/eventos/$eventoId" params={{ eventoId: eventoSel.id }}>
                        <Botao variante="contorno">Ver página pública</Botao>
                      </Link>
                    )}
                  </div>
                </div>
                {eventoSel.status === "rascunho" && (
                  <ul className="mt-2 list-inside list-disc text-xs text-muted-foreground">
                    {validarParaPublicacao(eventoSel).map((e) => <li key={e}>{e}</li>)}
                  </ul>
                )}
                <div className="mt-4 flex gap-1 border-b border-border text-sm">
                  {(["inscritos", "financeiro", "cupons", "cortesias"] as const).map((a) => (
                    <button
                      key={a}
                      onClick={() => setAba(a)}
                      className={`px-3 py-2 capitalize ${aba === a ? "border-b-2 border-primary font-medium" : "text-muted-foreground"}`}
                    >
                      {a}
                    </button>
                  ))}
                </div>

                {aba === "inscritos" && (
                  <TabelaInscritos eventoId={eventoSel.id} />
                )}

                {aba === "financeiro" && <Financeiro eventoId={eventoSel.id} />}

                {aba === "cupons" && (
                  <div className="mt-4 space-y-3">
                    <div className="grid gap-2 sm:grid-cols-4">
                      <Entrada placeholder="CÓDIGO" value={cupomForm.codigo} onChange={(e) => setCupomForm((p) => ({ ...p, codigo: e.target.value }))} />
                      <Entrada type="number" min={1} max={100} placeholder="% desconto" value={cupomForm.desconto} onChange={(e) => setCupomForm((p) => ({ ...p, desconto: e.target.value }))} />
                      <Entrada type="number" min={1} placeholder="Limite de usos" value={cupomForm.limite} onChange={(e) => setCupomForm((p) => ({ ...p, limite: e.target.value }))} />
                      <Botao onClick={() => aoCriarCupom(eventoSel.id)}>Criar cupom</Botao>
                    </div>
                    <ul className="space-y-1 text-sm">
                      {base.cupons.filter((c) => c.eventoId === eventoSel.id).map((c) => (
                        <li key={c.id} className="flex justify-between rounded-md border border-border bg-elevated px-3 py-2">
                          <span className="font-mono">{c.codigo}</span>
                          <span className="text-muted-foreground">{c.descontoPercentual}% · {c.usos}/{c.limiteUsos} usos · até {formatarDataBR(c.validoAte)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {aba === "cortesias" && (
                  <div className="mt-4 space-y-3">
                    <div className="grid gap-2 sm:grid-cols-2">
                      <Entrada placeholder="Nome do convidado" value={cortesiaForm.nome} onChange={(e) => setCortesiaForm((p) => ({ ...p, nome: e.target.value }))} />
                      <Entrada type="email" placeholder="E-mail do convidado" value={cortesiaForm.email} onChange={(e) => setCortesiaForm((p) => ({ ...p, email: e.target.value }))} />
                      <Selecao value={cortesiaForm.tipoId} onChange={(e) => setCortesiaForm((p) => ({ ...p, tipoId: e.target.value }))}>
                        <option value="">Tipo de ingresso</option>
                        {eventoSel.tipos.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}
                      </Selecao>
                      <Botao onClick={() => aoCriarCortesia(eventoSel.id)} disabled={!cortesiaForm.tipoId}>Emitir cortesia</Botao>
                    </div>
                    <ul className="space-y-1 text-sm">
                      {base.cortesias.filter((c) => c.eventoId === eventoSel.id).map((c) => (
                        <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-elevated px-3 py-2">
                          <span>{c.nomeConvidado} — {c.emailConvidado}</span>
                          <span className="flex items-center gap-2">
                            <Badge tom={c.status === "resgatada" ? "sucesso" : c.status === "pendente" ? "aviso" : "perigo"}>{c.status}</Badge>
                            <Botao
                              variante="fantasma"
                              onClick={() => navigator.clipboard?.writeText(`${location.origin}/inscricao/${eventoSel.id}?cortesia=${c.codigo}`)}
                            >
                              Copiar link
                            </Botao>
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </Cartao>
            </div>
          )}
        </div>
      

      <Modal aberto={!!form} titulo={form && eventos.some((e) => e.id === form.id) ? "Editar evento" : "Criar evento"} onFechar={() => setForm(null)}>
        {form && <FormEvento key={form.id} inicial={form} onSalvar={aoSalvarForm} onCancelar={() => setForm(null)} />}
      </Modal>

      <Modal aberto={!!excluirEvt} titulo="Excluir evento" onFechar={() => setExcluirEvt(null)}>
        {excluirEvt && (
          <div className="space-y-3 text-sm">
            <p>Tem certeza que deseja excluir <strong>{excluirEvt.nome || "este evento"}</strong>? Esta ação não pode ser desfeita.</p>
            {ativasPorEvento(excluirEvt.id) > 0 && (
              <p className="rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-warning">
                Este evento tem {ativasPorEvento(excluirEvt.id)} inscrições confirmadas e não pode ser excluído. Use “Cancelar evento” para estornar os participantes.
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
              canceladas com estorno integral simulado e os participantes serão notificados na plataforma.
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

function TabelaInscritos({ eventoId }: { eventoId: string }) {
  const base = carregarBase();
  const evento = base.eventos.find((e) => e.id === eventoId)!;
  const inscricoes = base.inscricoes.filter((i) => i.eventoId === eventoId);
  return (
    <div className="mt-4 overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs uppercase text-muted-foreground">
            <th className="py-2 pr-3">Participante</th>
            <th className="py-2 pr-3">CPF</th>
            <th className="py-2 pr-3">Tipo</th>
            <th className="py-2 pr-3">Exército</th>
            <th className="py-2 pr-3">Origem</th>
            <th className="py-2">Status</th>
          </tr>
        </thead>
        <tbody>
          {inscricoes.map((i) => {
            const u = base.usuarios.find((x) => x.id === i.usuarioId);
            return (
              <tr key={i.id} className="border-b border-border/50">
                <td className="py-2 pr-3">{u?.nomeCompleto ?? "Participante fictício"}</td>
                <td className="py-2 pr-3 font-mono text-xs">{u ? mascararCpf(u.cpf) : "***"}</td>
                <td className="py-2 pr-3">{evento.tipos.find((t) => t.id === i.tipoId)?.nome}</td>
                <td className="py-2 pr-3">{evento.exercitos.find((e) => e.id === i.exercitoId)?.nome}</td>
                <td className="py-2 pr-3">{i.origem}</td>
                <td className="py-2">
                  <Badge tom={i.status === "confirmada" ? "sucesso" : "perigo"}>{i.status}</Badge>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <Botao
        variante="contorno"
        className="mt-3"
        onClick={() => {
          const linhas = inscricoes.map((i) => {
            const u = base.usuarios.find((x) => x.id === i.usuarioId);
            return [u?.nomeCompleto ?? "fictício", i.codigo, i.status, i.origem].join(";");
          });
          const csv = "nome;codigo;status;origem\n" + linhas.join("\n");
          const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
          const a = document.createElement("a");
          a.href = url;
          a.download = "inscritos.csv";
          a.click();
          URL.revokeObjectURL(url);
        }}
      >
        Exportar relatório (CSV)
      </Botao>
    </div>
  );
}

function Financeiro({ eventoId }: { eventoId: string }) {
  const r = resumoFinanceiro(eventoId);
  const itens: Array<[string, string]> = [
    ["Inscritos ativos", String(r.inscritosAtivos)],
    ["Valor bruto simulado", formatarBRL(r.bruto)],
    ["Descontos concedidos", formatarBRL(r.descontos)],
    ["Ajustes simulados", formatarBRL(r.ajustes)],
    ["Estornos simulados", formatarBRL(r.estornos)],
    ["Total líquido simulado", formatarBRL(r.liquido)],
    ["Cortesias emitidas / resgatadas", `${r.cortesiasEmitidas} / ${r.cortesiasResgatadas}`],
    ["Cupons utilizados", String(r.cuponsUtilizados)],
    ["Integralmente descontadas", String(r.integralmenteDescontadas)],
  ];
  return (
    <div className="mt-4">
      <p className="text-xs text-muted-foreground">
        Valores demonstrativos, derivados dos registros de origem. Não incluem taxas de gateway.
      </p>
      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        {itens.map(([rotulo, valor]) => (
          <div key={rotulo} className="rounded-md border border-border bg-elevated p-3">
            <p className="text-xs text-muted-foreground">{rotulo}</p>
            <p className="font-mono text-lg font-semibold">{valor}</p>
          </div>
        ))}
      </div>
      <h3 className="mt-4 text-sm font-medium">Movimentações</h3>
      <ul className="mt-1 space-y-1 text-sm">
        {r.movimentacoes.map((m) => (
          <li key={m.id} className="flex justify-between rounded border border-border/50 px-3 py-1.5">
            <span className="text-muted-foreground">{m.descricao}</span>
            <span className={`font-mono ${m.valorCentavos < 0 ? "text-destructive" : "text-success"}`}>
              {formatarBRL(m.valorCentavos)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
