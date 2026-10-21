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
      setErro(err instanceof Error ? err.message : "Não foi possível atualizar a situação da conta."),
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
      setErro(err instanceof Error ? err.message : "Não foi possível abrir o cadastro.");
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
      setErro(err instanceof Error ? err.message : "Não foi possível abrir o painel do Stripe.");
    }
  };

  if (config && !config.pagamentoOnline) return null; // plataforma sem pagamentos online

  const percentual = taxaDaPlataforma(carregarBase());
  const taxa = percentual ? `${percentual.toLocaleString("pt-BR")}%` : null;
  const Icone = rec ? ICONE[rec.status] : Banknote;
  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h3 className="flex items-center gap-2 font-medium"><Banknote className="h-4 w-4 shrink-0" aria-hidden="true" />Recebimentos das vendas</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {rec?.status === "ativa"
              ? `As vendas pagas online são repassadas automaticamente para a conta da organização${taxa ? `, descontada a taxa da plataforma de ${taxa}` : ""}. O Stripe deposita o saldo na conta bancária cadastrada.`
              : `Conecte uma conta Stripe para receber as vendas automaticamente${taxa ? ` (taxa da plataforma: ${taxa})` : ""}. Enquanto ela não estiver ativa, os ingressos pagos não são vendidos; inscrições gratuitas e cortesias seguem normalmente.`}
          </p>
        </div>
        {rec && (
          <div className="shrink-0">
            <Badge variant={TOM[rec.status]} aria-label={`Recebimentos: ${ROTULO_RECEBIMENTO[rec.status]}`}><Icone aria-hidden="true" />{ROTULO_RECEBIMENTO[rec.status]}</Badge>
          </div>
        )}
      </div>
      {rec && rec.status !== "ativa" && rec.pendencias.length > 0 && (
        <p className="mt-2 text-xs text-muted-foreground">O Stripe ainda pede {rec.pendencias.length} informação(ões). Continue o cadastro para concluir.</p>
      )}
      {erro && <p role="alert" className="mt-2 text-sm text-destructive">{erro}</p>}
      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        {rec?.status !== "ativa" && !cadastrando && (
          <Button type="button" className="w-full sm:w-auto" onClick={irParaCadastro} disabled={ocupado || !config}>
            {ocupado ? "Abrindo o Stripe..." : rec ? (embutido ? "Continuar cadastro" : "Continuar cadastro no Stripe") : "Configurar recebimentos"}
          </Button>
        )}
        {cadastrando && (
          <Button type="button" variant="ghost" className="w-full sm:w-auto" onClick={aoSairDoCadastro}>Fechar cadastro</Button>
        )}
        {!embutido && rec && (rec.status === "ativa" || rec.saquesAtivos || rec.transferenciasAtivas) && (
          <Button type="button" variant="outline" className="w-full sm:w-auto" onClick={abrirPainel}>
            <ExternalLink className="h-4 w-4" aria-hidden="true" />Abrir painel do Stripe
          </Button>
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
