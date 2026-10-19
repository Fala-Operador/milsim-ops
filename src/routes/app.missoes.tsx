import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { carregarBase } from "@/services/db";
import { enviarEntregaMissao } from "@/api/conta.functions";
import { useAuth } from "@/contexts/AuthContext";
import { formatarDataBR } from "@/lib/domain/money";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { EstadoVazio } from "@/components/ui";
import type { StatusMissao } from "@/lib/domain/types";

export const Route = createFileRoute("/app/missoes")({
  head: () => ({
    meta: [
      { title: "Missões — MilSim Ops" },
      { name: "description", content: "Missões destinadas a você e suas entregas." },
      { property: "og:title", content: "Missões — MilSim Ops" },
      { property: "og:description", content: "Missões e entregas." },
    ],
  }),
  component: PaginaMissoes,
});

const rotuloStatus: Record<StatusMissao, string> = {
  disponivel: "Disponível",
  enviada: "Enviada",
  concluida: "Concluída",
  ajustes_solicitados: "Ajustes solicitados",
  prazo_encerrado: "Prazo encerrado",
};

function PaginaMissoes() {
  const { usuario } = useAuth();
  const [, setVersao] = useState(0);
  const [texto, setTexto] = useState<Record<string, string>>({});
  const [erro, setErro] = useState("");
  const base = carregarBase();
  if (!usuario) return null;

  const minhasInscricoes = base.inscricoes.filter(
    (i) => i.usuarioId === usuario.id && i.status === "confirmada",
  );

  // O participante vê somente missões destinadas a ele e suas próprias entregas
  const visiveis = base.missoes.filter((m) =>
    minhasInscricoes.some(
      (i) => i.eventoId === m.eventoId && (m.publico === "todos" || m.publico === i.exercitoId),
    ),
  );

  const entregaDe = (missaoId: string) =>
    base.entregas.find((e) => e.missaoId === missaoId && e.usuarioId === usuario.id);

  const enviar = async (missaoId: string, tipo: string) => {
    setErro("");
    try {
      await enviarEntregaMissao(missaoId, tipo === "texto" ? texto[missaoId] : undefined);
      setVersao((v) => v + 1);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao enviar a entrega.");
    }
  };

  return (
    <div>
      <h1 className="font-display text-2xl font-semibold uppercase">Missões</h1>
      {erro && <p role="alert" className="mt-2 text-sm text-destructive">{erro}</p>}
      {visiveis.length === 0 ? (
        <div className="mt-4">
          <EstadoVazio titulo="Nenhuma missão para você" descricao="Missões aparecem quando você tem inscrição confirmada." />
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          {visiveis.map((m) => {
            const entrega = entregaDe(m.id);
            const prazoEncerrado = new Date() > new Date(m.prazo);
            const status: StatusMissao = entrega?.status ?? (prazoEncerrado ? "prazo_encerrado" : "disponivel");
            const evento = base.eventos.find((e) => e.id === m.eventoId);
            return (
              <Card key={m.id}>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h2 className="font-medium">{m.titulo}</h2>
                    <p className="text-xs text-muted-foreground">{evento?.nome} · prazo {formatarDataBR(m.prazo)}</p>
                  </div>
                  <Badge variant={status === "concluida" ? "success" : status === "ajustes_solicitados" ? "warning" : "secondary"}>
                    {rotuloStatus[status]}
                  </Badge>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">{m.descricao}</p>
                {entrega?.avaliacao && (
                  <p className="mt-2 rounded-md border border-border bg-elevated p-2 text-sm">
                    Avaliação: {entrega.avaliacao}
                  </p>
                )}
                {(status === "disponivel" || status === "ajustes_solicitados") && (
                  <div className="mt-3 space-y-2">
                    {m.tipoEntrega === "texto" && (
                      <Textarea
                        placeholder="Sua resposta"
                        value={texto[m.id] ?? ""}
                        onChange={(e) => setTexto((p) => ({ ...p, [m.id]: e.target.value }))}
                      />
                    )}
                    {m.tipoEntrega === "imagem" && (
                      <input type="file" accept="image/*" aria-label="Enviar imagem da missão" className="text-sm" />
                    )}
                    <Button onClick={() => enviar(m.id, m.tipoEntrega)}>
                      {m.tipoEntrega === "confirmacao" ? "Confirmar" : "Enviar entrega"}
                    </Button>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
