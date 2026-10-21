import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { configuracaoRepasse } from "@/api/repasses.functions";
import { carregarBase } from "@/services/db";
import { useVersaoBase } from "@/hooks/useVersaoBase";
import { contaParaRepasse, MSG_ORG_SEM_RECEBIMENTO } from "@/lib/repasses";
import { cn } from "@/lib/utils";

/** Aviso à organização: sem conta de recebimento ativa, ingressos pagos não são vendidos. */
export function AvisoRecebimento({ organizacaoId, className }: { organizacaoId: string | undefined; className?: string }) {
  const versao = useVersaoBase();
  const [online, setOnline] = useState(false);
  useEffect(() => {
    configuracaoRepasse().then((c) => setOnline(c.pagamentoOnline)).catch(() => setOnline(false));
  }, []);
  const org = useMemo(() => carregarBase().organizacoes.find((o) => o.id === organizacaoId), [organizacaoId, versao]);
  if (!online || !org || contaParaRepasse(org)) return null;
  return (
    <p role="status" className={cn("rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-warning", className)}>
      {MSG_ORG_SEM_RECEBIMENTO}{" "}
      <Link to="/organizacao/financeiro" className="underline underline-offset-2 hover:text-foreground">Configurar recebimentos</Link>
    </p>
  );
}
