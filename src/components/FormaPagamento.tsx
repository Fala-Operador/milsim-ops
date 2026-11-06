// Escolha da forma de pagamento antes do checkout do Stripe: as opções (cartões de rádio) e a
// janela usada onde o checkout abre a partir de um botão (Meus ingressos, impulsos). As opções
// vêm dos meios ativos no Stripe que aceitam o total; com uma só, não há escolha.
import { useState, type ReactNode } from "react";
import { Barcode, CreditCard, QrCode } from "lucide-react";
import { metodosPagamentoFn } from "@/api/sessao.functions";
import { metodosParaValor, type MetodoPagamento } from "@/lib/stripe";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Modal } from "@/components/ui";
import { tr } from "@/i18n/components/FormaPagamento";

const ICONE: Record<MetodoPagamento, typeof CreditCard> = { card: CreditCard, pix: QrCode, boleto: Barcode };

export function rotuloFormaPagamento(m: MetodoPagamento): string {
  return m === "pix" ? tr("metodo_pix") : m === "boleto" ? tr("metodo_boleto") : tr("metodo_card");
}

function detalhe(m: MetodoPagamento): string {
  return m === "pix" ? tr("metodo_pix_detalhe") : m === "boleto" ? tr("metodo_boleto_detalhe") : tr("metodo_card_detalhe");
}

export const tituloFormaPagamento = () => tr("forma_de_pagamento");
export const avisoEscolhaFormaPagamento = () => tr("escolha_a_forma_de_pagamento");

/** Cartões de rádio com as formas de pagamento oferecidas. */
export function OpcoesFormaPagamento({ opcoes, valor, onChange, idBase = "forma" }: {
  opcoes: MetodoPagamento[];
  valor: MetodoPagamento | undefined;
  onChange: (m: MetodoPagamento) => void;
  idBase?: string;
}) {
  return (
    <RadioGroup value={valor ?? ""} onValueChange={(v) => onChange(v as MetodoPagamento)} aria-label={tr("forma_de_pagamento")} className="grid gap-2 sm:grid-cols-2">
      {opcoes.map((m) => {
        const Icone = ICONE[m];
        return (
          <Label key={m} htmlFor={`${idBase}-${m}`}
            className="flex cursor-pointer items-start gap-3 rounded-md border p-4 font-normal transition-colors hover:bg-secondary/60 has-[[data-state=checked]]:border-accent has-[[data-state=checked]]:bg-accent/5">
            <RadioGroupItem id={`${idBase}-${m}`} value={m} className="mt-0.5" />
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2 font-semibold"><Icone className="size-4 shrink-0" aria-hidden />{rotuloFormaPagamento(m)}</span>
              <span className="mt-0.5 block text-xs text-muted-foreground">{detalhe(m)}</span>
            </span>
          </Label>
        );
      })}
    </RadioGroup>
  );
}

interface Pedido {
  opcoes: MetodoPagamento[];
  seguir: (m: MetodoPagamento) => Promise<void>;
}

/**
 * Pergunta a forma de pagamento antes de abrir o checkout. `pedirForma(total, seguir)` consulta
 * os meios ativos: com mais de um para o total, abre a janela e chama `seguir` com o escolhido;
 * senão chama `seguir` direto (sem forma, o checkout usa os meios do painel). Erros de `seguir`
 * aparecem na janela; `janela` deve ser renderizado pela página.
 */
export function useEscolhaFormaPagamento(): {
  pedirForma: (totalCentavos: number, seguir: (m: MetodoPagamento | undefined) => Promise<void>) => Promise<void>;
  janela: ReactNode;
} {
  const [pedido, setPedido] = useState<Pedido | null>(null);
  const pedirForma = async (totalCentavos: number, seguir: (m: MetodoPagamento | undefined) => Promise<void>) => {
    const opcoes = metodosParaValor(await metodosPagamentoFn(), totalCentavos);
    if (opcoes.length > 1) setPedido({ opcoes, seguir });
    else await seguir(undefined);
  };
  const janela = pedido ? <JanelaFormaPagamento pedido={pedido} onFechar={() => setPedido(null)} /> : null;
  return { pedirForma, janela };
}

function JanelaFormaPagamento({ pedido, onFechar }: { pedido: Pedido; onFechar: () => void }) {
  const [metodo, setMetodo] = useState<MetodoPagamento | undefined>();
  const [abrindo, setAbrindo] = useState(false);
  const [erro, setErro] = useState("");
  const ir = async () => {
    if (!metodo) { setErro(tr("escolha_a_forma_de_pagamento")); return; }
    setErro(""); setAbrindo(true);
    try {
      await pedido.seguir(metodo);
    } catch (e) {
      setErro(e instanceof Error ? e.message : tr("nao_foi_possivel_abrir_o_pagamento"));
      setAbrindo(false);
    }
  };
  return (
    <Modal aberto titulo={tr("forma_de_pagamento")} onFechar={() => { if (!abrindo) onFechar(); }}>
      <div className="space-y-4">
        <OpcoesFormaPagamento opcoes={pedido.opcoes} valor={metodo} onChange={(m) => { setMetodo(m); setErro(""); }} idBase="janela-forma" />
        {erro && <p role="alert" className="text-sm text-destructive">{erro}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" disabled={abrindo} onClick={onFechar}>{tr("cancelar")}</Button>
          <Button type="button" disabled={abrindo} onClick={() => void ir()}>{abrindo ? tr("abrindo_pagamento") : tr("ir_para_o_pagamento")}</Button>
        </div>
      </div>
    </Modal>
  );
}
