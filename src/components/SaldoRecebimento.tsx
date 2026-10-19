// Saldo e saques da conta Stripe da organização, lidos do Stripe a cada abertura (cache curto
// no servidor). Nada disso fica na base nem na visão.
import { useEffect, useState } from "react";
import { Landmark, RefreshCw } from "lucide-react";
import { saldoRecebimento } from "@/api/repasses.functions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatarBRL, formatarDataBR } from "@/lib/domain/money";
import { ROTULO_SAQUE, type SaldoRecebimento as Saldo, type StatusSaque } from "@/lib/repasses";

const TOM_SAQUE: Record<StatusSaque, "success" | "warning" | "destructive" | "secondary"> = {
  paid: "success", pending: "secondary", in_transit: "warning", canceled: "secondary", failed: "destructive",
};

export function SaldoRecebimento({ organizacaoId }: { organizacaoId: string }) {
  const [saldo, setSaldo] = useState<Saldo | null | undefined>(undefined);
  const [erro, setErro] = useState("");
  const [ocupado, setOcupado] = useState(false);

  const carregar = async (atualizar: boolean) => {
    setErro("");
    setOcupado(true);
    try {
      setSaldo((await saldoRecebimento(organizacaoId, atualizar)) ?? null);
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Não foi possível consultar o saldo no Stripe.");
    } finally {
      setOcupado(false);
    }
  };

  useEffect(() => {
    void carregar(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizacaoId]);

  if (saldo === null) return null; // conta ainda não ativa
  return (
    <div>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="flex items-center gap-2 font-medium"><Landmark className="h-4 w-4 shrink-0" aria-hidden="true" />Saldo e saques</h3>
        <Button type="button" variant="ghost" className="w-full sm:w-auto" onClick={() => carregar(true)} disabled={ocupado}>
          <RefreshCw className={`h-4 w-4 ${ocupado ? "animate-spin" : ""}`} aria-hidden="true" />Atualizar
        </Button>
      </div>
      {erro && <p role="alert" className="mt-2 text-sm text-destructive">{erro}</p>}
      {saldo === undefined && !erro && <p className="mt-2 text-sm text-muted-foreground">Consultando o Stripe...</p>}
      {saldo && (
        <>
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            <Valor rotulo="Disponível para saque" valor={formatarBRL(saldo.disponivelCentavos)} />
            <Valor rotulo="A liberar" valor={formatarBRL(saldo.aLiberarCentavos)} />
            <Valor
              rotulo="Próximo saque"
              valor={saldo.proximoSaque ? formatarBRL(saldo.proximoSaque.valorCentavos) : "—"}
              detalhe={saldo.proximoSaque ? `previsto para ${formatarDataBR(saldo.proximoSaque.chegada)}` : undefined}
            />
          </div>
          <dl className="mt-3 grid gap-1 text-sm sm:grid-cols-2">
            <div className="min-w-0"><dt className="text-xs text-muted-foreground">Cronograma de saque</dt><dd className="break-words">{saldo.cronograma}</dd></div>
            <div className="min-w-0"><dt className="text-xs text-muted-foreground">Conta bancária</dt><dd className="break-words">{saldo.banco ?? "Não informada"}</dd></div>
          </dl>
          <h4 className="mt-4 text-sm font-medium">Últimos saques</h4>
          {saldo.saques.length === 0 ? (
            <p className="mt-1 text-sm text-muted-foreground">Nenhum saque ainda.</p>
          ) : (
            <ul className="mt-1 space-y-1 text-sm">
              {saldo.saques.map((s) => (
                <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 rounded border border-border/50 px-3 py-1.5">
                  <span className="text-muted-foreground">{formatarDataBR(s.chegada)}</span>
                  <span className="flex items-center gap-2">
                    <span className="font-mono">{formatarBRL(s.valorCentavos)}</span>
                    <Badge variant={TOM_SAQUE[s.status]}>{ROTULO_SAQUE[s.status]}</Badge>
                  </span>
                  {s.falha && <span className="w-full break-words text-xs text-destructive">{s.falha}</span>}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}

function Valor({ rotulo, valor, detalhe }: { rotulo: string; valor: string; detalhe?: string | undefined }) {
  return (
    <div className="rounded-md border border-border bg-elevated p-3">
      <p className="text-xs text-muted-foreground">{rotulo}</p>
      <p className="font-mono text-lg font-semibold">{valor}</p>
      {detalhe && <p className="text-xs text-muted-foreground">{detalhe}</p>}
    </div>
  );
}
