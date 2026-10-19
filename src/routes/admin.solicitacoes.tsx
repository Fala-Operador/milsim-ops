import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { carregarBase } from "@/services/db";
import { analisarSolicitacao } from "@/api/admin.functions";
import { useAuth } from "@/contexts/AuthContext";
import { formatarDataHoraBR } from "@/lib/domain/money";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/admin/solicitacoes")({
  head: () => ({
    meta: [
      { title: "Solicitações de organizador — MilSim Ops" },
      { name: "description", content: "Análise de solicitações para se tornar organizador." },
      { property: "og:title", content: "Solicitações de organizador — MilSim Ops" },
      { property: "og:description", content: "Análise de solicitações de organizador." },
    ],
  }),
  component: Solicitacoes,
});

function Solicitacoes() {
  const { usuario } = useAuth();
  const [, setVersao] = useState(0);
  const [justificativa, setJustificativa] = useState<Record<string, string>>({});
  const [erro, setErro] = useState("");
  if (!usuario) return null;

  const base = carregarBase();
  const pendentes = base.solicitacoes
    .filter((s) => ["pendente", "em_analise"].includes(s.status))
    .sort((a, b) => a.criadoEm.localeCompare(b.criadoEm));

  const agir = async (id: string, acao: "iniciar" | "aprovar" | "ajustes" | "rejeitar") => {
    setErro("");
    try {
      await analisarSolicitacao(id, acao, justificativa[id]);
      setVersao((v) => v + 1);
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Falha na ação.");
    }
  };

  return (
    <section>
      <h2 className="font-display text-lg font-semibold uppercase">Solicitações de organizador</h2>
      {erro && <p role="alert" className="mt-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">{erro}</p>}
      {pendentes.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">Nenhuma solicitação aguardando.</p>
      ) : (
        <div className="mt-3 space-y-3">
          {pendentes.map((s) => {
            const u = base.usuarios.find((x) => x.id === s.usuarioId);
            return (
              <Card key={s.id}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-medium">{s.nomeOrganizacao}</p>
                    <p className="text-sm text-muted-foreground">
                      {u?.nomeCompleto} · {s.possuiCnpj ? `CNPJ ${s.cnpj}` : "sem CNPJ"} · {formatarDataHoraBR(s.criadoEm)}
                    </p>
                  </div>
                  <Badge variant="warning">{s.status.replace("_", " ")}</Badge>
                </div>
                <Textarea
                  className="mt-3"
                  rows={2}
                  placeholder="Justificativa (obrigatória para ajustes/rejeição)"
                  value={justificativa[s.id] ?? ""}
                  onChange={(e) => setJustificativa((p) => ({ ...p, [s.id]: e.target.value }))}
                />
                <div className="mt-2 flex flex-wrap gap-2">
                  {s.status === "pendente" && <Button variant="outline" onClick={() => agir(s.id, "iniciar")}>Iniciar análise</Button>}
                  <Button onClick={() => agir(s.id, "aprovar")}>Aprovar</Button>
                  <Button variant="secondary" onClick={() => agir(s.id, "ajustes")}>Solicitar ajustes</Button>
                  <Button variant="destructive" onClick={() => agir(s.id, "rejeitar")}>Rejeitar</Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </section>
  );
}
