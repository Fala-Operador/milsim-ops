import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { carregarBase } from "@/services/db";
import { solicitarPrivacidade } from "@/api/conta.functions";
import { useAuth } from "@/contexts/AuthContext";
import { formatarDataBR } from "@/lib/domain/money";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { Campo } from "@/components/ui";
import type { SolicitacaoPrivacidade } from "@/lib/domain/types";
import { tr } from "@/i18n/routes/app.privacidade";

export const Route = createFileRoute("/app/privacidade")({
  head: () => ({
    meta: [
      { title: tr("privacidade_milsim_ops") },
      { name: "description", content: tr("solicite_acesso_correcao_exportacao_ou_e") },
      { property: "og:title", content: tr("privacidade_milsim_ops") },
      { property: "og:description", content: tr("solicitacoes_de_privacidade") },
    ],
  }),
  component: Privacidade,
});

function Privacidade() {
  const { usuario } = useAuth();
  const [tipo, setTipo] = useState<SolicitacaoPrivacidade["tipo"]>("acesso");
  const [detalhes, setDetalhes] = useState("");
  const [, setVersao] = useState(0);
  const [erro, setErro] = useState("");
  if (!usuario) return null;
  const minhas = carregarBase().privacidade.filter((p) => p.usuarioId === usuario.id);

  const enviar = async () => {
    setErro("");
    try {
      await solicitarPrivacidade(tipo, detalhes);
      setDetalhes("");
      setVersao((v) => v + 1);
    } catch (e) {
      setErro(e instanceof Error ? e.message : tr("falha_ao_enviar_a_solicitacao"));
    }
  };

  return (
    <div className="space-y-4">
      <h1 className="titulo-pagina">{tr("privacidade")}</h1>
      <p className="subtitulo-pagina">{tr("as_solicitacoes_sao_analisadas_e_respond")}</p>
      <Card>
        <div className="space-y-3">
          <Campo rotulo={tr("tipo_de_solicitacao")} htmlFor="tipo">
            <NativeSelect id="tipo" value={tipo} onChange={(e) => setTipo(e.target.value as SolicitacaoPrivacidade["tipo"])}>
              <option value="acesso">{tr("acesso_aos_dados")}</option>
              <option value="correcao">{tr("correcao")}</option>
              <option value="exportacao">{tr("exportacao")}</option>
              <option value="exclusao">{tr("exclusao")}</option>
            </NativeSelect>
          </Campo>
          <Campo rotulo={tr("detalhes")} htmlFor="det">
            <Textarea id="det" value={detalhes} onChange={(e) => setDetalhes(e.target.value)} />
          </Campo>
          {erro && <p role="alert" className="text-sm text-destructive">{erro}</p>}
          <Button onClick={enviar}>{tr("enviar_solicitacao")}</Button>
        </div>
      </Card>
      <ul className="space-y-2">
        {minhas.map((p) => (
          <li key={p.id}>
            <Card>
              <div className="flex justify-between">
                <span className="font-medium capitalize">{p.tipo}</span>
                <Badge variant={p.status === "respondida" ? "success" : "warning"}>{p.status === "respondida" ? tr("respondida") : tr("aberta")}</Badge>
              </div>
              <p className="text-xs text-muted-foreground">{formatarDataBR(p.criadoEm)}</p>
              {p.resposta && <p className="mt-2 text-sm">{tr("resposta_resposta", { resposta: p.resposta })}</p>}
            </Card>
          </li>
        ))}
      </ul>
    </div>
  );
}
