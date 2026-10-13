import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { carregarBase } from "@/services/db";
import { solicitarPrivacidade } from "@/api/conta.functions";
import { useAuth } from "@/contexts/AuthContext";
import { formatarDataBR } from "@/lib/domain/money";
import { AreaTexto, Badge, Botao, Campo, Cartao, Selecao } from "@/components/ui";
import type { SolicitacaoPrivacidade } from "@/lib/domain/types";

export const Route = createFileRoute("/app/privacidade")({
  head: () => ({
    meta: [
      { title: "Privacidade — MilSim Ops" },
      { name: "description", content: "Solicite acesso, correção, exportação ou exclusão dos seus dados." },
      { property: "og:title", content: "Privacidade — MilSim Ops" },
      { property: "og:description", content: "Solicitações de privacidade." },
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
      setErro(e instanceof Error ? e.message : "Falha ao enviar a solicitação.");
    }
  };

  return (
    <div className="space-y-4">
      <h1 className="font-display text-2xl font-semibold uppercase">Privacidade</h1>
      <p className="text-sm text-muted-foreground">
        As solicitações são analisadas e respondidas pela administração da plataforma.
      </p>
      <Cartao>
        <div className="space-y-3">
          <Campo rotulo="Tipo de solicitação" htmlFor="tipo">
            <Selecao id="tipo" value={tipo} onChange={(e) => setTipo(e.target.value as SolicitacaoPrivacidade["tipo"])}>
              <option value="acesso">Acesso aos dados</option>
              <option value="correcao">Correção</option>
              <option value="exportacao">Exportação</option>
              <option value="exclusao">Exclusão</option>
            </Selecao>
          </Campo>
          <Campo rotulo="Detalhes" htmlFor="det">
            <AreaTexto id="det" value={detalhes} onChange={(e) => setDetalhes(e.target.value)} />
          </Campo>
          {erro && <p role="alert" className="text-sm text-destructive">{erro}</p>}
          <Botao onClick={enviar}>Enviar solicitação</Botao>
        </div>
      </Cartao>
      <ul className="space-y-2">
        {minhas.map((p) => (
          <li key={p.id}>
            <Cartao>
              <div className="flex justify-between">
                <span className="font-medium capitalize">{p.tipo}</span>
                <Badge tom={p.status === "respondida" ? "sucesso" : "aviso"}>{p.status === "respondida" ? "Respondida" : "Aberta"}</Badge>
              </div>
              <p className="text-xs text-muted-foreground">{formatarDataBR(p.criadoEm)}</p>
              {p.resposta && <p className="mt-2 text-sm">Resposta: {p.resposta}</p>}
            </Cartao>
          </li>
        ))}
      </ul>
    </div>
  );
}
