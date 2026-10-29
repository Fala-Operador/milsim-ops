// Conta de recebimento da organização (Stripe Connect Express): cadastro, situação, saldo e
// saques. Com a chave publicável configurada, tudo acontece dentro do site (componentes
// embutidos do Stripe); sem ela, o cadastro e o painel abrem no site do Stripe.
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Banknote, Check, Clock, ExternalLink, TriangleAlert } from "lucide-react";
import { abrirPainelStripe, atualizarRecebimento, cadastrarRecebimento, configuracaoRepasse } from "@/api/repasses.functions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CadastroStripeEmbutido, PaineisStripe } from "@/components/PaineisStripe";
import { SaldoRecebimento } from "@/components/SaldoRecebimento";
import { ROTULO_RECEBIMENTO, taxaDaPlataforma } from "@/lib/repasses";
import { carregarBase } from "@/services/db";
import type { Organizacao, StatusRecebimento } from "@/lib/domain/types";
import { tr } from "@/i18n/components/RecebimentosOrganizacao";
import { localeAtual } from "@/i18n/dicionario";

const TOM: Record<StatusRecebimento, "success" | "warning" | "destructive"> = { ativa: "success", em_analise: "warning", pendente: "warning", restrita: "destructive" };
const ICONE: Record<StatusRecebimento, typeof Check> = { ativa: Check, em_analise: Clock, pendente: Clock, restrita: TriangleAlert };

export function RecebimentosOrganizacao({ organizacao, retorno }: { organizacao: Organizacao; retorno?: string | undefined }) {
  const navigate = useNavigate();
  const [config, setConfig] = useState<{ pagamentoOnline: boolean; componentesStripe?: boolean } | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [cadastrando, setCadastrando] = useState(false);
  const [erro, setErro] = useState("");
  const rec = organizacao.recebimento;
  const conferido = useRef<string | null>(null);

  useEffect(() => {
    configuracaoRepasse().then(setConfig).catch(() => setConfig({ pagamentoOnline: false }));
  }, []);

  const embutido = !!config?.componentesStripe;

  // Saída do cadastro embutido: fecha o formulário e confere a situação da conta no Stripe.
  const aoSairDoCadastro = () => {
    setCadastrando(false);
    atualizarRecebimento(organizacao.id).catch((err) =>
      setErro(err instanceof Error ? err.message : tr("nao_foi_possivel_atualizar_a_situacao")),
    );
  };

  const irParaCadastro = async () => {
    setErro("");
    if (embutido) {
      setCadastrando(true);
      return;
    }
    setOcupado(true);
    try {
      const { url } = await cadastrarRecebimento(organizacao.id);
      window.location.assign(url);
    } catch (err) {
      setErro(err instanceof Error ? err.message : tr("nao_foi_possivel_abrir_o_cadastro"));
      setOcupado(false);
    }
  };

  // Volta do cadastro no Stripe (ou conta ainda não ativa): atualiza a situação uma vez.
  // Link vencido ("renovar"): gera um novo e volta para o Stripe.
  useEffect(() => {
    const chave = `${organizacao.id}|${retorno ?? ""}`;
    if (conferido.current === chave || !rec?.contaId) return;
    conferido.current = chave;
    if (retorno) navigate({ to: "/organizacao/financeiro", search: { recebimento: undefined }, replace: true });
    if (retorno === "renovar") void irParaCadastro();
    else if (retorno || rec.status !== "ativa") atualizarRecebimento(organizacao.id).catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizacao.id, retorno, rec?.contaId]);

  const abrirPainel = async () => {
    setErro("");
    try {
      const { url } = await abrirPainelStripe(organizacao.id);
      window.open(url, "_blank", "noopener");
    } catch (err) {
      setErro(err instanceof Error ? err.message : tr("nao_foi_possivel_abrir_o_painel"));
    }
  };

  if (config && !config.pagamentoOnline) return null; // plataforma sem pagamentos online

  const percentual = taxaDaPlataforma(carregarBase());
  const taxa = percentual ? `${percentual.toLocaleString(localeAtual())}%` : null;
  const Icone = rec ? ICONE[rec.status] : Banknote;
  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h3 className="flex items-center gap-2 font-medium"><Banknote className="h-4 w-4 shrink-0" aria-hidden="true" />{tr("recebimentos_das_vendas")}</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {rec?.status === "ativa"
              ? (taxa ? tr("repasse_ativo_com_taxa", { taxa }) : tr("repasse_ativo_sem_taxa"))
              : (taxa ? tr("conecte_conta_com_taxa", { taxa }) : tr("conecte_conta_sem_taxa"))}
          </p>
        </div>
        {rec && (
          <div className="shrink-0">
            <Badge variant={TOM[rec.status]} aria-label={tr("recebimentos_valor", { valor: ROTULO_RECEBIMENTO[rec.status] })}><Icone aria-hidden="true" />{ROTULO_RECEBIMENTO[rec.status]}</Badge>
          </div>
        )}
      </div>
      {rec && rec.status !== "ativa" && rec.pendencias.length > 0 && (
        <p className="mt-2 text-xs text-muted-foreground">{tr("o_stripe_ainda_pede_length_informacao", { length: rec.pendencias.length })}</p>
      )}
      {erro && <p role="alert" className="mt-2 text-sm text-destructive">{erro}</p>}
      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        {rec?.status !== "ativa" && !cadastrando && (
          <Button type="button" className="w-full sm:w-auto" onClick={irParaCadastro} disabled={ocupado || !config}>
            {ocupado ? tr("abrindo_o_stripe") : rec ? (embutido ? tr("continuar_cadastro") : tr("continuar_cadastro_no_stripe")) : tr("configurar_recebimentos")}
          </Button>
        )}
        {cadastrando && (
          <Button type="button" variant="ghost" className="w-full sm:w-auto" onClick={aoSairDoCadastro}>{tr("fechar_cadastro")}</Button>
        )}
        {!embutido && rec && (rec.status === "ativa" || rec.saquesAtivos || rec.transferenciasAtivas) && (
          <Button type="button" variant="outline" className="w-full sm:w-auto" onClick={abrirPainel}>
            <ExternalLink className="h-4 w-4" aria-hidden="true" />{tr("abrir_painel_do_stripe")}</Button>
        )}
      </div>
      {cadastrando && <CadastroStripeEmbutido organizacaoId={organizacao.id} aoSair={aoSairDoCadastro} />}
      {config && rec?.status === "ativa" && (
        <>
          <div className="mt-4 border-t border-border pt-4">
            <SaldoRecebimento organizacaoId={organizacao.id} />
          </div>
          {config.componentesStripe && (
            <div className="mt-4 border-t border-border pt-4">
              <PaineisStripe organizacaoId={organizacao.id} />
            </div>
          )}
        </>
      )}
    </div>
  );
}
