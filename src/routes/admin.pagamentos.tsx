import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Check, Clock, TriangleAlert } from "lucide-react";
import { carregarBase } from "@/services/db";
import { configuracaoRepasse, definirTaxaComprador, definirTaxaPlataforma } from "@/api/repasses.functions";
import { useAuth } from "@/contexts/AuthContext";
import { useVersaoBase } from "@/hooks/useVersaoBase";
import { erroTaxa, ROTULO_RECEBIMENTO, taxaDaPlataforma, taxaDoComprador, taxaPlataforma } from "@/lib/repasses";
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
      { name: "description", content: "Taxas da plataforma e do comprador e contas de recebimento das organizações." },
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
  const config = base.configuracoes.find((c) => c.id === "plataforma");
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

  if (!usuario) return null;
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

      <CardTaxa
        id="taxa"
        titulo="Taxa da plataforma (organização)"
        descricao="Percentual retido em cada ingresso vendido online e repassado à organização pelo Stripe Connect. Vendas de organizações sem conta de recebimento ativa ficam integralmente com a plataforma."
        atual={taxaDaPlataforma(base)}
        salvar={definirTaxaPlataforma}
        exemplo={(p) => `Exemplo: num ingresso de ${formatarBRL(15000)}, a plataforma retém ${formatarBRL(taxaPlataforma(15000, p))} e a organização recebe ${formatarBRL(15000 - taxaPlataforma(15000, p))}.`}
      />
      <CardTaxa
        id="taxa-comprador"
        titulo="Taxa de serviço (comprador)"
        descricao="Percentual somado ao valor do ingresso e pago pelo comprador, que aparece como um item separado no pagamento. Fica com a plataforma e não muda o que a organização recebe. Use 0% para não cobrar."
        atual={taxaDoComprador(base)}
        salvar={definirTaxaComprador}
        exemplo={(p) => `Exemplo: num ingresso de ${formatarBRL(15000)}, o comprador paga ${formatarBRL(15000 + taxaPlataforma(15000, p))} (${formatarBRL(taxaPlataforma(15000, p))} de taxa de serviço).`}
      />
      {config && <p className="text-xs text-muted-foreground">Última alteração das taxas: {new Date(config.atualizadoEm).toLocaleString("pt-BR")}.</p>}

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

/** Campo de uma taxa percentual da plataforma (0% a 50%), salva pela administração. */
function CardTaxa({ id, titulo, descricao, atual, salvar, exemplo }: {
  id: string;
  titulo: string;
  descricao: string;
  atual: number;
  salvar: (percentual: number) => Promise<unknown>;
  exemplo: (percentual: number) => string;
}) {
  const [valor, setValor] = useState(String(atual).replace(".", ","));
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState("");
  const [salvando, setSalvando] = useState(false);
  // Mantém o campo em dia quando a taxa muda (outra aba, outro admin).
  useEffect(() => setValor(String(atual).replace(".", ",")), [atual]);

  const percentual = Number(valor.trim().replace(",", "."));
  const erroCampo = valor.trim() === "" ? "Informe a taxa em porcentagem." : erroTaxa(percentual);

  const aoSalvar = async () => {
    setErro("");
    setAviso("");
    if (erroCampo) return setErro(erroCampo);
    setSalvando(true);
    try {
      await salvar(percentual);
      setAviso("Taxa atualizada. Ela vale para as próximas vendas; as reservas já feitas mantêm a taxa anterior.");
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Não foi possível salvar a taxa.");
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Card>
      <h3 className="font-medium">{titulo}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{descricao}</p>
      <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end">
        <Campo rotulo="Taxa (%)" htmlFor={id}>
          <Input id={id} inputMode="decimal" value={valor} onChange={(e) => { setValor(e.target.value); setErro(""); setAviso(""); }} className="sm:max-w-40" aria-describedby={`${id}-ajuda`} />
        </Campo>
        <Button type="button" onClick={aoSalvar} disabled={salvando || percentual === atual} className="w-full sm:w-auto">
          {salvando ? "Salvando..." : "Salvar taxa"}
        </Button>
      </div>
      <p id={`${id}-ajuda`} className="mt-2 text-xs text-muted-foreground">
        {erroCampo ? "Entre 0% e 50%, com até duas casas decimais." : exemplo(percentual)}
      </p>
      {erro && <p role="alert" className="mt-2 text-sm text-destructive">{erro}</p>}
      {aviso && <p role="status" className="mt-2 text-sm text-success">{aviso}</p>}
    </Card>
  );
}
