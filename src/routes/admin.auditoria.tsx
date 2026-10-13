import { createFileRoute } from "@tanstack/react-router";
import { listarAuditoria } from "@/services/admin";
import { formatarDataHoraBR } from "@/lib/domain/money";

export const Route = createFileRoute("/admin/auditoria")({
  head: () => ({
    meta: [
      { title: "Auditoria — Admin MilSim Ops" },
      { name: "description", content: "Registro de ações administrativas." },
      { property: "og:title", content: "Auditoria — Admin MilSim Ops" },
      { property: "og:description", content: "Registro de ações administrativas." },
    ],
  }),
  component: Auditoria,
});

function Auditoria() {
  const auditoria = listarAuditoria().slice(0, 50);
  return (
    <section>
      <h2 className="font-display text-lg font-semibold uppercase">Auditoria</h2>
      <p className="text-xs text-muted-foreground">O armazenamento local não oferece integridade de auditoria de produção.</p>
      {auditoria.length === 0 && <p className="mt-2 text-sm text-muted-foreground">Nenhum registro.</p>}
      <ul className="mt-2 space-y-1 text-sm">
        {auditoria.map((a) => (
          <li key={a.id} className="rounded border border-border/50 px-3 py-1.5">
            <span className="font-mono text-xs text-muted-foreground">{formatarDataHoraBR(a.criadoEm)}</span>{" "}
            <span className="font-medium">{a.acao}</span> em {a.entidade} ({a.entidadeId})
            {a.justificativa && <span className="text-muted-foreground"> — {a.justificativa}</span>}
          </li>
        ))}
      </ul>
    </section>
  );
}
