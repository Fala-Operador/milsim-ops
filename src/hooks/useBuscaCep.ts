// Autopreenchimento por CEP: consulta sozinho quando o campo chega a 8 dígitos.
// Não reconsulta o mesmo CEP nem o CEP com que o formulário abriu (edição de dados já salvos),
// e descarta a resposta de um CEP que a pessoa já trocou.
import { useEffect, useRef, useState } from "react";
import { consultarCep, ErroCep, type EnderecoCep } from "@/services/geolocalizacao";
import { tr } from "@/i18n/hooks/useBuscaCep";

export type EstadoBuscaCep =
  | { status: "ocioso" }
  | { status: "buscando" }
  | { status: "encontrado" }
  | { status: "erro"; mensagem: string };

export function useBuscaCep(cep: string | undefined, aoEncontrar: (endereco: EnderecoCep) => void): EstadoBuscaCep {
  const digitos = (cep ?? "").replace(/\D/g, "");
  const [estado, setEstado] = useState<EstadoBuscaCep>({ status: "ocioso" });
  // CEP inicial conta como já consultado: abrir um formulário preenchido não sobrescreve nada.
  const consultado = useRef<string | null>(digitos.length === 8 ? digitos : null);
  const retorno = useRef(aoEncontrar);
  retorno.current = aoEncontrar;

  useEffect(() => {
    if (digitos.length !== 8) {
      consultado.current = null;
      setEstado({ status: "ocioso" });
      return;
    }
    if (consultado.current === digitos) return;
    consultado.current = digitos;
    const ctrl = new AbortController();
    let concluida = false;
    setEstado({ status: "buscando" });
    consultarCep(digitos, ctrl.signal)
      .then((endereco) => {
        concluida = true;
        retorno.current(endereco);
        setEstado({ status: "encontrado" });
      })
      .catch((e: unknown) => {
        concluida = true;
        if (ctrl.signal.aborted) return;
        setEstado({ status: "erro", mensagem: e instanceof ErroCep ? e.message : tr("nao_foi_possivel_consultar_o_cep") });
      });
    return () => {
      ctrl.abort();
      // Interrompida antes de responder (CEP trocado, remontagem): pode consultar de novo.
      if (!concluida) consultado.current = null;
    };
  }, [digitos]);

  return estado;
}

/** Texto curto para mostrar abaixo do campo de CEP. */
export function textoBuscaCep(e: EstadoBuscaCep): string {
  if (e.status === "buscando") return tr("buscando_endereco");
  if (e.status === "encontrado") return tr("endereco_preenchido_pelo_cep_confira_e");
  if (e.status === "erro") return tr("mensagem_preencha_o_endereco_manualmente", { mensagem: e.mensagem });
  return "";
}
