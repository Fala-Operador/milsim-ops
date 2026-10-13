import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { carregarBase } from "@/services/db";
import { responderPrivacidade } from "@/api/admin.functions";
import { useAuth } from "@/contexts/AuthContext";
import { Badge, Botao, Cartao } from "@/components/ui";

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
            <Cartao key={p.id}>
              <div className="flex justify-between">
                <span className="font-medium capitalize">{p.tipo}</span>
                <Badge tom={p.status === "respondida" ? "sucesso" : "aviso"}>{p.status}</Badge>
              </div>
              <p className="text-sm text-muted-foreground">{p.detalhes}</p>
              {p.status === "aberta" && (
                <Botao
                  variante="contorno"
                  className="mt-2"
                  onClick={() => {
                    const r = prompt("Resposta ao participante:");
                    if (r) responderPrivacidade(p.id, r).then(() => setVersao((v) => v + 1));
                  }}
                >
                  Responder
                </Botao>
              )}
            </Cartao>
          ))}
        </div>
      )}
    </section>
  );
}
