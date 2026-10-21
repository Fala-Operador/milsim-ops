import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { carregarBase } from "@/services/db";
import { responderPrivacidade } from "@/api/admin.functions";
import { useAuth } from "@/contexts/AuthContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ModalTexto } from "@/components/ui";

export const Route = createFileRoute("/admin/privacidade")({
  head: () => ({
    meta: [
      { title: "Privacidade — Admin MilSim Ops" },
      { name: "description", content: "Solicitações de privacidade dos participantes." },
      { property: "og:title", content: "Privacidade — Admin MilSim Ops" },
      { property: "og:description", content: "Solicitações de privacidade." },
    ],
  }),
  component: Privacidade,
});

function Privacidade() {
  const { usuario } = useAuth();
  const [, setVersao] = useState(0);
  const [respondendo, setRespondendo] = useState<string | null>(null);
  if (!usuario) return null;
  const base = carregarBase();

  return (
    <section>
      <h2 className="font-display text-lg font-semibold uppercase">Solicitações de privacidade</h2>
      {base.privacidade.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">Nenhuma solicitação.</p>
      ) : (
        <div className="mt-3 space-y-2">
          {base.privacidade.map((p) => (
            <Card key={p.id}>
              <div className="flex justify-between">
                <span className="font-medium capitalize">{p.tipo}</span>
                <Badge variant={p.status === "respondida" ? "success" : "warning"}>{p.status}</Badge>
              </div>
              <p className="text-sm text-muted-foreground">{p.detalhes}</p>
              {p.status === "aberta" && (
                <Button
                  variant="outline"
                  className="mt-2"
                  onClick={() => setRespondendo(p.id)}
                >
                  Responder
                </Button>
              )}
            </Card>
          ))}
        </div>
      )}
      <ModalTexto
        aberto={!!respondendo}
        titulo="Responder solicitação"
        rotulo="Resposta ao participante"
        descricao="O participante recebe esta resposta e a solicitação passa a respondida."
        confirmar="Enviar resposta"
        maximo={2000}
        onFechar={() => setRespondendo(null)}
        onConfirmar={(r) => responderPrivacidade(respondendo!, r).then(() => setVersao((v) => v + 1))}
      />
    </section>
  );
}
