import { createFileRoute } from "@tanstack/react-router";
import { EstadoVazio } from "@/components/ui";
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
      <h2 className="titulo-pagina">Auditoria</h2>
      <p className="subtitulo-pagina">Últimas 50 ações administrativas, da mais recente para a mais antiga.</p>
      <p className="mt-3 border-l-2 border-warning pl-3 text-xs text-muted-foreground">O armazenamento local não oferece integridade de auditoria de produção.</p>
      {auditoria.length === 0 ? (
        <div className="mt-6"><EstadoVazio titulo="Nenhum registro" descricao="As ações administrativas aparecem aqui assim que acontecem." /></div>
      ) : (
        <ol className="mt-6 divide-y divide-border border-y border-border text-sm">
          {auditoria.map((a) => (
            <li key={a.id} className="grid gap-x-4 gap-y-1 py-3 sm:grid-cols-[150px_minmax(0,1fr)]">
              <time className="font-mono text-xs leading-5 text-muted-foreground">{formatarDataHoraBR(a.criadoEm)}</time>
              <div className="min-w-0">
                <p><span className="rounded-sm bg-secondary px-1.5 py-0.5 font-mono text-xs font-semibold">{a.acao}</span> <span className="text-muted-foreground">em</span> <span className="font-medium">{a.entidade}</span> <span className="font-mono text-xs text-muted-foreground">{a.entidadeId}</span></p>
                {a.justificativa && <p className="mt-1 text-muted-foreground">{a.justificativa}</p>}
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
