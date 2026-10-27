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
      <h2 className="titulo-pagina">Solicitações de organizador</h2>
      {erro && <p role="alert" className="mt-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">{erro}</p>}
      {pendentes.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">Nenhuma solicitação aguardando.</p>
      ) : (
        <div className="mt-3 space-y-3">
          {pendentes.map((s) => {
            const u = base.usuarios.find((x) => x.id === s.usuarioId);
            return (
              <article key={s.id} className="grid overflow-hidden rounded-lg border border-border lg:grid-cols-[minmax(0,1fr)_340px]">
                <div className="p-5">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="warning">{s.status.replace("_", " ")}</Badge>
                    <span className="font-mono text-xs text-muted-foreground">{formatarDataHoraBR(s.criadoEm)}</span>
                  </div>
                  <p className="mt-2 font-display text-3xl font-bold uppercase leading-none">{s.nomeOrganizacao}</p>
                  <dl className="mt-4 grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
                    <div><dt className="rotulo-tecnico">Solicitante</dt><dd className="mt-0.5">{u?.nomeCompleto}</dd></div>
                    <div><dt className="rotulo-tecnico">E-mail</dt><dd className="mt-0.5 break-all">{u?.email}</dd></div>
                    <div><dt className="rotulo-tecnico">CNPJ</dt><dd className="mt-0.5 font-mono">{s.possuiCnpj ? s.cnpj : "Não possui"}</dd></div>
                    <div><dt className="rotulo-tecnico">Cidade</dt><dd className="mt-0.5">{u?.endereco?.cidade ? `${u.endereco.cidade}/${u.endereco.uf}` : "—"}</dd></div>
                  </dl>
                </div>
                <div className="space-y-2 border-t border-border bg-card/50 p-5 lg:border-l lg:border-t-0">
                  <p className="rotulo-tecnico">Decisão</p>
                  <Textarea rows={3} placeholder="Justificativa (obrigatória para ajustes ou rejeição)"
                    value={justificativa[s.id] ?? ""} onChange={(e) => setJustificativa((p) => ({ ...p, [s.id]: e.target.value }))} />
                  <Button className="w-full" onClick={() => agir(s.id, "aprovar")}>Aprovar organização</Button>
                  <div className="grid grid-cols-2 gap-2">
                    <Button variant="outline" onClick={() => agir(s.id, "ajustes")}>Pedir ajustes</Button>
                    <Button variant="destructive" onClick={() => agir(s.id, "rejeitar")}>Rejeitar</Button>
                  </div>
                  {s.status === "pendente" && <Button variant="link" size="none" className="text-xs" onClick={() => agir(s.id, "iniciar")}>Marcar como em análise</Button>}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
