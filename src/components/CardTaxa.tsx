import { useEffect, useState } from "react";
import { erroTaxa } from "@/lib/repasses";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Campo } from "@/components/ui";
import { tr } from "@/i18n/components/CardTaxa";

/** Campo de uma taxa percentual (0% a 50%): taxa da plataforma no admin e do comprador na organização. */
export function CardTaxa({ id, titulo, descricao, atual, salvar, exemplo }: {
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
  const erroCampo = valor.trim() === "" ? tr("informe_a_taxa_em_porcentagem") : erroTaxa(percentual);

  const aoSalvar = async () => {
    setErro("");
    setAviso("");
    if (erroCampo) return setErro(erroCampo);
    setSalvando(true);
    try {
      await salvar(percentual);
      setAviso(tr("taxa_atualizada_ela_vale_para_as"));
    } catch (err) {
      setErro(err instanceof Error ? err.message : tr("nao_foi_possivel_salvar_a_taxa"));
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Card>
      <h3 className="font-medium">{titulo}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{descricao}</p>
      <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end">
        <Campo rotulo={tr("taxa")} htmlFor={id}>
          <Input id={id} inputMode="decimal" value={valor} onChange={(e) => { setValor(e.target.value); setErro(""); setAviso(""); }} className="sm:max-w-40" aria-describedby={`${id}-ajuda`} />
        </Campo>
        <Button type="button" onClick={aoSalvar} disabled={salvando || percentual === atual} className="w-full sm:w-auto">
          {salvando ? tr("salvando") : tr("salvar_taxa")}
        </Button>
      </div>
      <p id={`${id}-ajuda`} className="mt-2 text-xs text-muted-foreground">
        {erroCampo ? tr("entre_0_e_50_com_ate") : exemplo(percentual)}
      </p>
      {erro && <p role="alert" className="mt-2 text-sm text-destructive">{erro}</p>}
      {aviso && <p role="status" className="mt-2 text-sm text-success">{aviso}</p>}
    </Card>
  );
}
