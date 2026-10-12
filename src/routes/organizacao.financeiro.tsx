import { OperacaoSelecionada } from "@/components/OperacaoSelecionada";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { criarCortesia, criarCupom } from "@/services/organizador";
import { useAuth } from "@/contexts/AuthContext";
import { formatarDataBR } from "@/lib/domain/money";
import { Badge, Botao, Cartao, Entrada, Selecao } from "@/components/ui";
import { Financeiro, useEventoSelecionado, useEventosOrg } from "@/components/organizacao";

export const Route = createFileRoute("/organizacao/financeiro")({
  head: () => ({
    meta: [
      { title: "Financeiro — Minha organização — MilSim Ops" },
      { name: "description", content: "Resumo financeiro simulado, cupons e cortesias por evento." },
    ],
  }),
  component: PaginaFinanceiro,
});

function PaginaFinanceiro() {
  const { usuario } = useAuth();
  const { base, eventos } = useEventosOrg();
  const [eventoId, setEventoId, invalido] = useEventoSelecionado(eventos);
  const [, setVersao] = useState(0);
  const [erro, setErro] = useState("");
  const [cupomForm, setCupomForm] = useState({ codigo: "", desconto: "10", limite: "10", validoAte: "" });
  const [cortesiaForm, setCortesiaForm] = useState({ nome: "", email: "", tipoId: "", validade: "" });

  const evento = eventos.find((e) => e.id === eventoId) ?? null;
  // Troca de evento limpa formulários e mensagens do evento anterior.
  useEffect(() => {
    setErro("");
    setCupomForm({ codigo: "", desconto: "10", limite: "10", validoAte: "" });
    setCortesiaForm({ nome: "", email: "", tipoId: "", validade: "" });
  }, [eventoId]);

  const aoCriarCupom = async () => {
    if (!evento) return;
    setErro("");
    try {
      await criarCupom({
        eventoId: evento.id,
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

  const aoCriarCortesia = async () => {
    if (!evento) return;
    setErro("");
    try {
      const codigo = await criarCortesia({
        eventoId: evento.id,
        nomeConvidado: cortesiaForm.nome,
        emailConvidado: cortesiaForm.email,
        tipoId: cortesiaForm.tipoId,
        validade: cortesiaForm.validade ? new Date(cortesiaForm.validade).toISOString() : new Date(Date.now() + 15 * 86400000).toISOString(),
      });
      alert(`Cortesia criada. Link fictício de uso único: /inscricao/${evento.id}?cortesia=${codigo}`);
      setCortesiaForm({ nome: "", email: "", tipoId: "", validade: "" });
      setVersao((v) => v + 1);
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Falha ao criar cortesia.");
    }
  };

  if (!usuario) return null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-lg font-semibold uppercase">Financeiro</h2>
      </div>
      <OperacaoSelecionada eventos={eventos} evento={eventos.find((e) => e.id === eventoId)} invalido={invalido} onSelecionar={setEventoId} />

      {erro && <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">{erro}</p>}

      {eventos.length === 0 ? (
        <Cartao><p className="text-sm text-muted-foreground">Nenhum evento criado ainda. Crie um evento no Painel.</p></Cartao>
      ) : (
        evento && (
          <>
            <Cartao>
              <Financeiro eventoId={evento.id} />
            </Cartao>

            <Cartao>
              <h3 className="font-display text-base font-semibold uppercase">Cupons de desconto</h3>
              <div className="mt-3 grid gap-2 sm:grid-cols-4">
                <Entrada placeholder="CÓDIGO" value={cupomForm.codigo} onChange={(e) => setCupomForm((p) => ({ ...p, codigo: e.target.value }))} />
                <Entrada type="number" min={1} max={100} placeholder="% desconto" value={cupomForm.desconto} onChange={(e) => setCupomForm((p) => ({ ...p, desconto: e.target.value }))} />
                <Entrada type="number" min={1} placeholder="Limite de usos" value={cupomForm.limite} onChange={(e) => setCupomForm((p) => ({ ...p, limite: e.target.value }))} />
                <Botao onClick={aoCriarCupom}>Criar cupom</Botao>
              </div>
              <ul className="mt-3 space-y-1 text-sm">
                {base.cupons.filter((c) => c.eventoId === evento.id).map((c) => (
                  <li key={c.id} className="flex justify-between rounded-md border border-border bg-elevated px-3 py-2">
                    <span className="font-mono">{c.codigo}</span>
                    <span className="text-muted-foreground">{c.descontoPercentual}% · {c.usos}/{c.limiteUsos} usos · até {formatarDataBR(c.validoAte)}</span>
                  </li>
                ))}
              </ul>
            </Cartao>

            <Cartao>
              <h3 className="font-display text-base font-semibold uppercase">Cortesias</h3>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <Entrada placeholder="Nome do convidado" value={cortesiaForm.nome} onChange={(e) => setCortesiaForm((p) => ({ ...p, nome: e.target.value }))} />
                <Entrada type="email" placeholder="E-mail do convidado" value={cortesiaForm.email} onChange={(e) => setCortesiaForm((p) => ({ ...p, email: e.target.value }))} />
                <Selecao value={cortesiaForm.tipoId} onChange={(e) => setCortesiaForm((p) => ({ ...p, tipoId: e.target.value }))}>
                  <option value="">Tipo de ingresso</option>
                  {evento.tipos.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}
                </Selecao>
                <Botao onClick={aoCriarCortesia} disabled={!cortesiaForm.tipoId}>Emitir cortesia</Botao>
              </div>
              <ul className="mt-3 space-y-1 text-sm">
                {base.cortesias.filter((c) => c.eventoId === evento.id).map((c) => (
                  <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-elevated px-3 py-2">
                    <span>{c.nomeConvidado} — {c.emailConvidado}</span>
                    <span className="flex items-center gap-2">
                      <Badge tom={c.status === "resgatada" ? "sucesso" : c.status === "pendente" ? "aviso" : "perigo"}>{c.status}</Badge>
                      <Botao
                        variante="fantasma"
                        onClick={() => navigator.clipboard?.writeText(`${location.origin}/inscricao/${evento.id}?cortesia=${c.codigo}`)}
                      >
                        Copiar link
                      </Botao>
                    </span>
                  </li>
                ))}
              </ul>
            </Cartao>
          </>
        )
      )}
    </div>
  );
}
