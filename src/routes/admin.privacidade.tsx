import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { carregarBase } from "@/services/db";
import { responderPrivacidade } from "@/api/admin.functions";
import { useAuth } from "@/contexts/AuthContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ModalTexto, TextoLivre } from "@/components/ui";
import { tr } from "@/i18n/routes/admin.privacidade";

export const Route = createFileRoute("/admin/privacidade")({
  head: () => ({
    meta: [
      { title: tr("privacidade_admin_milsim_ops") },
      { name: "description", content: tr("solicitacoes_de_privacidade_dos_particip") },
      { property: "og:title", content: tr("privacidade_admin_milsim_ops") },
      { property: "og:description", content: tr("solicitacoes_de_privacidade") },
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
      <h2 className="titulo-pagina">{tr("solicitacoes_de_privacidade_2")}</h2>
      {base.privacidade.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">{tr("nenhuma_solicitacao")}</p>
      ) : (
        <div className="mt-3 space-y-2">
          {base.privacidade.map((p) => (
            <Card key={p.id}>
              <div className="flex justify-between">
                <span className="font-medium capitalize">{p.tipo}</span>
                <Badge variant={p.status === "respondida" ? "success" : "warning"}>{p.status}</Badge>
              </div>
              <TextoLivre texto={p.detalhes} className="text-sm text-muted-foreground" />
              {p.status === "aberta" && (
                <Button
                  variant="outline"
                  className="mt-2"
                  onClick={() => setRespondendo(p.id)}
                >{tr("responder")}</Button>
              )}
            </Card>
          ))}
        </div>
      )}
      <ModalTexto
        aberto={!!respondendo}
        titulo={tr("responder_solicitacao")}
        rotulo={tr("resposta_ao_participante")}
        descricao={tr("o_participante_recebe_esta_resposta_e")}
        confirmar={tr("enviar_resposta")}
        maximo={2000}
        onFechar={() => setRespondendo(null)}
        onConfirmar={(r) => responderPrivacidade(respondendo!, r).then(() => setVersao((v) => v + 1))}
      />
    </section>
  );
}
