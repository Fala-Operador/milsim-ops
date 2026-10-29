import { OperacaoSelecionada } from "@/components/OperacaoSelecionada";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { criarCortesia } from "@/api/organizador.functions";
import { useNavigate } from "@tanstack/react-router";
import { CuponsEvento } from "@/components/CuponsEvento";
import { useAuth } from "@/contexts/AuthContext";
import { useConfirmacao } from "@/contexts/ConfirmacaoContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Campo } from "@/components/ui";
import { RecebimentosOrganizacao } from "@/components/RecebimentosOrganizacao";
import { CardTaxa } from "@/components/CardTaxa";
import { definirTaxaComprador } from "@/api/repasses.functions";
import { taxaDaPlataforma, taxaDoComprador, taxaPlataforma } from "@/lib/repasses";
import { formatarBRL } from "@/lib/domain/money";
import { AvisoLotes, Financeiro, useEventoSelecionado, useEventosOrg } from "@/components/organizacao";
import { tr } from "@/i18n/routes/organizacao.financeiro";
import { localeAtual } from "@/i18n/dicionario";

export const Route = createFileRoute("/organizacao/financeiro")({
  // Volta do cadastro de recebimentos no Stripe: ?recebimento=retorno|renovar
  validateSearch: (s: Record<string, unknown>): { recebimento?: string | undefined } => ({
    recebimento: typeof s["recebimento"] === "string" ? s["recebimento"] : undefined,
  }),
  head: () => ({
    meta: [
      { title: tr("financeiro_minha_organizacao_milsim_ops") },
      { name: "description", content: tr("resumo_financeiro_cupons_e_cortesias_por") },
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
  const { avisar } = useConfirmacao();

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
      void avisar({ titulo: tr("cortesia_criada"), descricao: tr("link_de_uso_unico_inscricao_id", { id: evento.id, codigo }) });
      setCortesiaForm({ nome: "", email: "", tipoId: "", validade: "" });
      setVersao((v) => v + 1);
    } catch (err) {
      setErro(err instanceof Error ? err.message : tr("falha_ao_criar_cortesia"));
    }
  };

  if (!usuario) return null;
  // A conta de recebimento é da organização: a do organizador ou, para o admin, a do evento aberto.
  const organizacao = base.organizacoes.find((o) => o.id === (usuario.organizacaoId ?? evento?.organizacaoId));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="titulo-pagina">{tr("financeiro")}</h2>
      </div>
      <OperacaoSelecionada eventos={eventos} evento={eventos.find((e) => e.id === eventoId)} invalido={invalido} onSelecionar={setEventoId} />

      {erro && <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">{erro}</p>}

      {/* Resumo e movimentações do evento primeiro; a conta de recebimento e os painéis do Stripe logo abaixo. */}
      {eventos.length === 0 ? (
        <Card><p className="text-sm text-muted-foreground">{tr("nenhum_evento_criado_ainda_crie_um")}</p></Card>
      ) : (
        evento && (
          <section className="pt-2">
            <h3 className="text-lg font-semibold">{tr("vendas_do_evento")}</h3>
            <Financeiro eventoId={evento.id} />
          </section>
        )
      )}

      {organizacao && (
        <section className="border-t border-border pt-6">
          <RecebimentosOrganizacao organizacao={organizacao} retorno={retornoRecebimento} />
        </section>
      )}

      <div className="grid gap-4 border-t border-border pt-6 lg:grid-cols-2">
      {organizacao && <CardTaxaPlataforma percentual={taxaDaPlataforma(base)} taxaComprador={taxaDoComprador(organizacao)} />}

      {organizacao && (
        <CardTaxa
          id="taxa-comprador"
          titulo={tr("taxa_de_servico_comprador")}
          descricao={tr("percentual_somado_ao_valor_do_ingresso")}
          atual={taxaDoComprador(organizacao)}
          salvar={(p) => definirTaxaComprador(organizacao.id, p).then(() => setVersao((v) => v + 1))}
          exemplo={(p) => tr("exemplo_num_ingresso_de_valor_o", { valor: formatarBRL(15000), valor2: formatarBRL(15000 + taxaPlataforma(15000, p)), valor3: formatarBRL(taxaPlataforma(15000, p)) })}
        />
      )}
      </div>

      {evento && (
        <>
          <section className="border-t border-border pt-6">
            <AvisoLotes evento={evento} onConfigurar={() => navigate({ to: "/organizacao", search: { lotes: evento.id } })} />
          </section>

          <section className="border-t border-border pt-6">
            <CuponsEvento evento={evento} cupons={base.cupons.filter((c) => c.eventoId === evento.id)} />
          </section>

          <section className="border-t border-border pt-6">
            <h3 className="font-display text-base font-semibold uppercase">{tr("cortesias")}</h3>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <Campo rotulo={tr("nome_do_convidado")} htmlFor="ct-nome">
                <Input id="ct-nome" value={cortesiaForm.nome} onChange={(e) => setCortesiaForm((p) => ({ ...p, nome: e.target.value }))} />
              </Campo>
              <Campo rotulo={tr("e_mail_do_convidado")} htmlFor="ct-email">
                <Input id="ct-email" type="email" value={cortesiaForm.email} onChange={(e) => setCortesiaForm((p) => ({ ...p, email: e.target.value }))} />
              </Campo>
              <Campo rotulo={tr("tipo_de_ingresso")} htmlFor="ct-tipo">
                <NativeSelect id="ct-tipo" value={cortesiaForm.tipoId} onChange={(e) => setCortesiaForm((p) => ({ ...p, tipoId: e.target.value }))}>
                  <option value="">{tr("selecione")}</option>
                  {evento.tipos.filter((t) => !t.arquivado).map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}
                </NativeSelect>
              </Campo>
              <Campo rotulo={tr("validade_do_convite")} htmlFor="ct-val">
                <Input id="ct-val" type="date" value={cortesiaForm.validade} onChange={(e) => setCortesiaForm((p) => ({ ...p, validade: e.target.value }))} />
              </Campo>
              <div className="sm:col-span-2 flex justify-end">
                <Button onClick={aoCriarCortesia} disabled={!cortesiaForm.tipoId}>{tr("emitir_cortesia")}</Button>
              </div>
            </div>
            <ul className="mt-3 space-y-1 text-sm">
              {base.cortesias.filter((c) => c.eventoId === evento.id).map((c) => (
                <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-border/70 py-2">
                  <span>{c.nomeConvidado} — {c.emailConvidado}</span>
                  <span className="flex items-center gap-2">
                    <Badge variant={c.status === "resgatada" ? "success" : c.status === "pendente" ? "warning" : "destructive"}>{({ pendente: tr("cortesia_pendente"), resgatada: tr("cortesia_resgatada"), expirada: tr("cortesia_expirada"), revogada: tr("cortesia_revogada") } as Record<string, string>)[c.status] ?? c.status}</Badge>
                    <Button
                      variant="ghost"
                      onClick={() => navigator.clipboard?.writeText(`${location.origin}/inscricao/${evento.id}?cortesia=${c.codigo}`)}
                    >{tr("copiar_link")}</Button>
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </div>
  );
}

/**
 * Taxa da plataforma, só leitura (quem define é a administração, em /admin/pagamentos).
 * Incide sobre o valor do ingresso já com descontos; a taxa de serviço do comprador fica fora
 * da conta e vai inteira para a organização.
 */
function CardTaxaPlataforma({ percentual, taxaComprador }: { percentual: number; taxaComprador: number }) {
  const exemplo = 15000;
  const taxa = taxaPlataforma(exemplo, percentual);
  const servico = taxaPlataforma(exemplo, taxaComprador);
  const pct = (p: number) => `${p.toLocaleString(localeAtual(), { maximumFractionDigits: 2 })}%`;
  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-medium">{tr("taxa_da_plataforma")}</h3>
          <p className="mt-1 max-w-prose text-sm text-muted-foreground">{tr("retida_pela_milsim_ops_em_cada")}</p>
        </div>
        <p className="shrink-0 font-display text-3xl font-semibold" aria-label={tr("taxa_da_plataforma_percentual", { percentual: pct(percentual) })}>{pct(percentual)}</p>
      </div>
      <p className="mt-3 rounded-md border border-border bg-elevated px-3 py-2 text-sm">
        {percentual > 0 ? (
          <>{tr("exemplo_num_ingresso_de_exemplo_a", { exemplo: formatarBRL(exemplo), taxa: formatarBRL(taxa) })}{" "}
            <strong>{formatarBRL(exemplo - taxa)}</strong>
            {servico > 0 && <>{tr("mais_servico_da_taxa_de_servico", { servico: formatarBRL(servico) })}</>}.
          </>
        ) : (
          <>{tr("no_momento_nao_ha_taxa_a")}</>
        )}
      </p>
      <p className="mt-2 text-xs text-muted-foreground">{tr("definida_pela_administracao_da_plataform")}</p>
    </Card>
  );
}
