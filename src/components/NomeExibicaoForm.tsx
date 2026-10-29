import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { nomeExibicao } from "@/services/comunidade";
import { atualizarNomeExibicao } from "@/api/comunidade.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Campo } from "@/components/ui";
import { tr } from "@/i18n/components/NomeExibicaoForm";

/** Nome de exibição usado na comunidade (o nome completo segue nos contextos administrativos). */
export function NomeExibicaoForm() {
  const { usuario } = useAuth();
  const [nome, setNome] = useState(usuario?.nomeExibicao ?? "");
  const [aviso, setAviso] = useState("");
  if (!usuario) return null;
  return (
    <div className="max-w-sm space-y-2">
      <Campo rotulo={tr("nome_de_exibicao_na_comunidade")} htmlFor="nome-exib">
        <Input id="nome-exib" maxLength={40} placeholder={nomeExibicao({ ...usuario, nomeExibicao: undefined })} value={nome} onChange={(e) => setNome(e.target.value)} />
      </Campo>
      <Button
        variant="outline"
        onClick={async () => {
          try {
            await atualizarNomeExibicao(nome);
            setAviso(tr("nome_de_exibicao_salvo"));
          } catch (e) {
            setAviso(e instanceof Error ? e.message : tr("erro_ao_salvar"));
          }
        }}
      >{tr("salvar_nome")}</Button>
      {aviso && <p role="status" className="text-sm text-muted-foreground">{aviso}</p>}
    </div>
  );
}
