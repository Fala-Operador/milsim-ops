import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Check, Clock, TriangleAlert } from "lucide-react";
import { carregarBase } from "@/services/db";
import { configuracaoRepasse, definirTaxaPlataforma } from "@/api/repasses.functions";
import { useAuth } from "@/contexts/AuthContext";
import { useVersaoBase } from "@/hooks/useVersaoBase";
import { erroTaxa, ROTULO_RECEBIMENTO, taxaDaPlataforma, taxaPlataforma } from "@/lib/repasses";
import { formatarBRL } from "@/lib/domain/money";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Campo } from "@/components/ui";
import type { StatusRecebimento } from "@/lib/domain/types";

export const Route = createFileRoute("/admin/pagamentos")({
  head: () => ({
    meta: [
      { title: "Pagamentos — Admin MilSim Ops" },
      { name: "description", content: "Taxa da plataforma e contas de recebimento das organizações." },
    ],
  }),
  component: Pagamentos,
});

const TOM: Record<StatusRecebimento, "success" | "warning" | "destructive"> = { ativa: "success", em_analise: "warning", pendente: "warning", restrita: "destructive" };
const ICONE: Record<StatusRecebimento, typeof Check> = { ativa: Check, em_analise: Clock, pendente: Clock, restrita: TriangleAlert };

function Pagamentos() {
  const { usuario } = useAuth();
  useVersaoBase();
  const base = carregarBase();
  const atual = taxaDaPlataforma(base);
  const config = base.configuracoes.find((c) => c.id === "plataforma");
  const [valor, setValor] = useState(String(atual).replace(".", ","));
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [pagamentoOnline, setPagamentoOnline] = useState<boolean | null>(null);
  const [avisoChaves, setAvisoChaves] = useState("");

  useEffect(() => {
    configuracaoRepasse()
      .then((c) => {
        setPagamentoOnline(c.pagamentoOnline);
        setAvisoChaves(c.avisoChaves ?? "");
      })
      .catch(() => setPagamentoOnline(null));
  }, [usuario?.id]);
  // Mantém o campo em dia quando a taxa muda (outra aba, outro admin).
  useEffect(() => setValor(String(atual).replace(".", ",")), [atual]);

  if (!usuario) return null;
  const percentual = Number(valor.trim().replace(",", "."));
  const erroCampo = valor.trim() === "" ? "Informe a taxa em porcentagem." : erroTaxa(percentual);

  const salvar = async () => {
    setErro("");
    setAviso("");
    if (erroCampo) return setErro(erroCampo);
    setSalvando(true);
    try {
      await definirTaxaPlataforma(percentual);
      setAviso("Taxa atualizada. Ela vale para as próximas vendas; as reservas já feitas mantêm a taxa anterior.");
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Não foi possível salvar a taxa.");
    } finally {
      setSalvando(false);
    }
  };

  const organizacoes = [...base.organizacoes].sort((a, b) => a.nome.localeCompare(b.nome));
  return (
    <section className="space-y-4">
      <h2 className="font-display text-lg font-semibold uppercase">Pagamentos</h2>
      {pagamentoOnline === false && (
        <p role="status" className="rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-warning">
          Os pagamentos online estão desligados: falta configurar a chave secreta do Stripe no servidor. A taxa pode ser definida mesmo assim.
        </p>
      )}
      {avisoChaves && (
        <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          Os painéis do Stripe dentro do site estão desligados: {avisoChaves} Enquanto isso, o cadastro de recebimentos abre no site do Stripe.
        </p>
      )}

      <Card>
        <h3 className="font-medium">Taxa da plataforma</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Percentual retido em cada ingresso vendido online e repassado à organização pelo Stripe Connect. Vendas de organizações
          sem conta de recebimento ativa ficam integralmente com a plataforma.
        </p>
        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end">
          <Campo rotulo="Taxa (%)" htmlFor="taxa">
            <Input id="taxa" inputMode="decimal" value={valor} onChange={(e) => { setValor(e.target.value); setErro(""); setAviso(""); }} className="sm:max-w-40" aria-describedby="taxa-ajuda" />
          </Campo>
          <Button type="button" onClick={salvar} disabled={salvando || percentual === atual} className="w-full sm:w-auto">
            {salvando ? "Salvando..." : "Salvar taxa"}
          </Button>
        </div>
        <p id="taxa-ajuda" className="mt-2 text-xs text-muted-foreground">
          {erroCampo
            ? "Entre 0% e 50%, com até duas casas decimais."
            : `Exemplo: num ingresso de ${formatarBRL(15000)}, a plataforma retém ${formatarBRL(taxaPlataforma(15000, percentual))} e a organização recebe ${formatarBRL(15000 - taxaPlataforma(15000, percentual))}.`}
        </p>
        {config && <p className="mt-1 text-xs text-muted-foreground">Última alteração: {new Date(config.atualizadoEm).toLocaleString("pt-BR")}.</p>}
        {erro && <p role="alert" className="mt-2 text-sm text-destructive">{erro}</p>}
        {aviso && <p role="status" className="mt-2 text-sm text-success">{aviso}</p>}
      </Card>

      <Card>
        <h3 className="font-medium">Contas de recebimento das organizações</h3>
        <ul className="mt-3 space-y-2">
          {organizacoes.map((o) => {
            const r = o.recebimento;
            const Icone = r ? ICONE[r.status] : Clock;
            return (
              <li key={o.id} className="flex flex-col gap-1 rounded-md border border-border px-3 py-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                <span className="min-w-0 break-words text-sm font-medium">{o.nome}</span>
                {r ? (
                  <Badge variant={TOM[r.status]} aria-label={`Recebimentos: ${ROTULO_RECEBIMENTO[r.status]}`}><Icone aria-hidden="true" />{ROTULO_RECEBIMENTO[r.status]}</Badge>
                ) : (
                  <Badge aria-label="Recebimentos: não configurado"><Icone aria-hidden="true" />Não configurado</Badge>
                )}
              </li>
            );
          })}
          {organizacoes.length === 0 && <li className="text-sm text-muted-foreground">Nenhuma organização cadastrada.</li>}
        </ul>
      </Card>
    </section>
  );
}
