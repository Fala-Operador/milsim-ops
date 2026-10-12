import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { carregarBase, mutarBase, gerarId } from "@/services/db";
import { resumoFinanceiro, inscricoesAtivasDoEvento } from "@/services/inscricoes";
import {
  cancelarEvento,
  criarCortesia,
  criarCupom,
  publicarEvento,
  salvarEvento,
  validarParaPublicacao,
} from "@/services/organizador";
import { useAuth } from "@/contexts/AuthContext";
import { formatarBRL, formatarDataBR } from "@/lib/domain/money";
import { mascararCpf } from "@/lib/domain/validators";
import { AreaTexto, Badge, Botao, Campo, Cartao, Entrada, Modal, Selecao, SkeletonPagina } from "@/components/ui";
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
  const [aba, setAba] = useState<"inscritos" | "financeiro" | "cupons" | "cortesias">("inscritos");

  useEffect(() => {
    if (usuario && usuario.perfil !== "organizador" && usuario.perfil !== "admin") {
      navigate({ to: "/app" });
    }
  }, [usuario, navigate]);

  if (!usuario) return <SkeletonPagina />;
  const base = carregarBase();
  const orgId = usuario.perfil === "admin" ? undefined : usuario.organizacaoId;
  const eventos = base.eventos.filter((e) => !orgId || e.organizacaoId === orgId);
  const eventoSel = eventos.find((e) => e.id === selecionado) ?? null;

  const novoEvento = async () => {
    const ev: Evento = {
      id: gerarId("evt"),
      organizacaoId: orgId ?? base.organizacoes[0]?.id ?? "",
      nome: "Nova operação (rascunho)",
      descricaoResumida: "",
      enredo: "",
      inicioEm: new Date(Date.now() + 30 * 86400000).toISOString(),
      fimEm: new Date(Date.now() + 31 * 86400000).toISOString(),
      fuso: "America/Sao_Paulo",
      local: "",
      endereco: "",
      cidade: "",
      uf: "SP",
      capacidadeTotal: 50,
      exercitos: [{ id: gerarId("ex"), nome: "Exército A", capacidade: 25 }],
      tipos: [{ id: gerarId("tp"), nome: "Ingresso Padrão", precoBaseCentavos: 10000, quantidadeMaxima: 50 }],
      lotes: [],
      cronograma: [],
      status: "rascunho",
      criadoEm: new Date().toISOString(),
    };
    await salvarEvento(ev, usuario.id, usuario.perfil);
    setSelecionado(ev.id);
    setVersao((v) => v + 1);
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
        <Botao onClick={novoEvento}>Criar evento (rascunho)</Botao>
      </div>

      {erro && <p role="alert" className="mt-3 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">{erro}</p>}

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="space-y-2">
          <h2 className="font-display text-lg font-semibold uppercase">Eventos</h2>
          {eventos.map((e) => (
            <button
              key={e.id}
              onClick={() => setSelecionado(e.id)}
              className={`w-full rounded-md border p-3 text-left text-sm ${selecionado === e.id ? "border-primary bg-secondary" : "border-border bg-card"}`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium">{e.nome}</span>
                <Badge tom={tomStatusEvento[e.status]}>{e.status.replace("_", " ")}</Badge>
              </div>
              <p className="text-xs text-muted-foreground">{formatarDataBR(e.inicioEm)} · {e.cidade}/{e.uf}</p>
            </button>
          ))}
        </div>

        <div className="lg:col-span-2">
          {!eventoSel ? (
            <Cartao><p className="text-sm text-muted-foreground">Selecione um evento para gerenciar.</p></Cartao>
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
      </div>

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
