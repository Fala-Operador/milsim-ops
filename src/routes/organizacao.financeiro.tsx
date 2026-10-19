import { OperacaoSelecionada } from "@/components/OperacaoSelecionada";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { criarCortesia } from "@/api/organizador.functions";
import { useNavigate } from "@tanstack/react-router";
import { CuponsEvento } from "@/components/CuponsEvento";
import { useAuth } from "@/contexts/AuthContext";
import { Badge, Botao, Campo, Cartao, Entrada, Selecao } from "@/components/ui";
import { RecebimentosOrganizacao } from "@/components/RecebimentosOrganizacao";
import { AvisoLotes, Financeiro, useEventoSelecionado, useEventosOrg } from "@/components/organizacao";

export const Route = createFileRoute("/organizacao/financeiro")({
  // Volta do cadastro de recebimentos no Stripe: ?recebimento=retorno|renovar
  validateSearch: (s: Record<string, unknown>): { recebimento?: string | undefined } => ({
    recebimento: typeof s["recebimento"] === "string" ? s["recebimento"] : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Financeiro — Minha organização — MilSim Ops" },
      { name: "description", content: "Resumo financeiro, cupons e cortesias por evento." },
    ],
  }),
  component: PaginaFinanceiro,
});

function PaginaFinanceiro() {
  const { usuario } = useAuth();
  const navigate = useNavigate();
  const { base, eventos } = useEventosOrg();
  const { recebimento: retornoRecebimento } = Route.useSearch();
  const [eventoId, setEventoId, invalido] = useEventoSelecionado(eventos);
  const [, setVersao] = useState(0);
  const [erro, setErro] = useState("");
  const [cortesiaForm, setCortesiaForm] = useState({ nome: "", email: "", tipoId: "", validade: "" });

  const evento = eventos.find((e) => e.id === eventoId) ?? null;
  // Troca de evento limpa formulários e mensagens do evento anterior.
  useEffect(() => {
    setErro("");
    setCortesiaForm({ nome: "", email: "", tipoId: "", validade: "" });
  }, [eventoId]);

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
      alert(`Cortesia criada. Link de uso único: /inscricao/${evento.id}?cortesia=${codigo}`);
      setCortesiaForm({ nome: "", email: "", tipoId: "", validade: "" });
      setVersao((v) => v + 1);
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Falha ao criar cortesia.");
    }
  };

  if (!usuario) return null;
  // A conta de recebimento é da organização: a do organizador ou, para o admin, a do evento aberto.
  const organizacao = base.organizacoes.find((o) => o.id === (usuario.organizacaoId ?? evento?.organizacaoId));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-lg font-semibold uppercase">Financeiro</h2>
      </div>
      {organizacao && (
        <Cartao>
          <RecebimentosOrganizacao organizacao={organizacao} retorno={retornoRecebimento} />
        </Cartao>
      )}
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
              <AvisoLotes evento={evento} onConfigurar={() => navigate({ to: "/organizacao", search: { lotes: evento.id } })} />
            </Cartao>

            <Cartao>
              <CuponsEvento evento={evento} cupons={base.cupons.filter((c) => c.eventoId === evento.id)} />
            </Cartao>

            <Cartao>
              <h3 className="font-display text-base font-semibold uppercase">Cortesias</h3>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <Campo rotulo="Nome do convidado" htmlFor="ct-nome">
                  <Entrada id="ct-nome" value={cortesiaForm.nome} onChange={(e) => setCortesiaForm((p) => ({ ...p, nome: e.target.value }))} />
                </Campo>
                <Campo rotulo="E-mail do convidado" htmlFor="ct-email">
                  <Entrada id="ct-email" type="email" value={cortesiaForm.email} onChange={(e) => setCortesiaForm((p) => ({ ...p, email: e.target.value }))} />
                </Campo>
                <Campo rotulo="Tipo de ingresso" htmlFor="ct-tipo">
                  <Selecao id="ct-tipo" value={cortesiaForm.tipoId} onChange={(e) => setCortesiaForm((p) => ({ ...p, tipoId: e.target.value }))}>
                    <option value="">Selecione</option>
                    {evento.tipos.filter((t) => !t.arquivado).map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}
                  </Selecao>
                </Campo>
                <Campo rotulo="Validade do convite" htmlFor="ct-val">
                  <Entrada id="ct-val" type="date" value={cortesiaForm.validade} onChange={(e) => setCortesiaForm((p) => ({ ...p, validade: e.target.value }))} />
                </Campo>
                <div className="sm:col-span-2 flex justify-end">
                  <Botao onClick={aoCriarCortesia} disabled={!cortesiaForm.tipoId}>Emitir cortesia</Botao>
                </div>
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
