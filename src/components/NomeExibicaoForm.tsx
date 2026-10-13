import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { nomeExibicao } from "@/services/comunidade";
import { atualizarNomeExibicao } from "@/api/comunidade.functions";
import { Botao, Campo, Entrada } from "@/components/ui";

/** Nome de exibição usado na comunidade (o nome completo segue nos contextos administrativos). */
export function NomeExibicaoForm() {
  const { usuario } = useAuth();
  const [nome, setNome] = useState(usuario?.nomeExibicao ?? "");
  const [aviso, setAviso] = useState("");
  if (!usuario) return null;
  return (
    <div className="max-w-sm space-y-2">
      <Campo rotulo="Nome de exibição na comunidade" htmlFor="nome-exib">
        <Entrada id="nome-exib" maxLength={40} placeholder={nomeExibicao({ ...usuario, nomeExibicao: undefined })} value={nome} onChange={(e) => setNome(e.target.value)} />
      </Campo>
      <Botao
        variante="contorno"
        onClick={async () => {
          try {
            await atualizarNomeExibicao(nome);
            setAviso("Nome de exibição salvo.");
          } catch (e) {
            setAviso(e instanceof Error ? e.message : "Erro ao salvar.");
          }
        }}
      >
        Salvar nome
      </Botao>
      {aviso && <p role="status" className="text-sm text-muted-foreground">{aviso}</p>}
    </div>
  );
}
