import { createFileRoute } from "@tanstack/react-router";
import { EstadoVazio } from "@/components/ui";
import { listarAuditoria } from "@/services/admin";
import { formatarDataHoraBR } from "@/lib/domain/money";
import { tr } from "@/i18n/routes/admin.auditoria";

export const Route = createFileRoute("/admin/auditoria")({
  head: () => ({
    meta: [
      { title: tr("auditoria_admin_milsim_ops") },
      { name: "description", content: tr("registro_de_acoes_administrativas") },
      { property: "og:title", content: tr("auditoria_admin_milsim_ops") },
      { property: "og:description", content: tr("registro_de_acoes_administrativas") },
    ],
  }),
  component: Auditoria,
});

function Auditoria() {
  const auditoria = listarAuditoria().slice(0, 50);
  return (
    <section>
      <h2 className="titulo-pagina">{tr("auditoria")}</h2>
      <p className="subtitulo-pagina">{tr("ultimas_50_acoes_administrativas_da_mais")}</p>
      <p className="mt-3 border-l-2 border-warning pl-3 text-xs text-muted-foreground">{tr("o_armazenamento_local_nao_oferece_integr")}</p>
      {auditoria.length === 0 ? (
        <div className="mt-6"><EstadoVazio titulo={tr("nenhum_registro")} descricao={tr("as_acoes_administrativas_aparecem_aqui_a")} /></div>
      ) : (
        <ol className="mt-6 divide-y divide-border border-y border-border text-sm">
          {auditoria.map((a) => (
            <li key={a.id} className="grid gap-x-4 gap-y-1 py-3 sm:grid-cols-[150px_minmax(0,1fr)]">
              <time className="font-mono text-xs leading-5 text-muted-foreground">{formatarDataHoraBR(a.criadoEm)}</time>
              <div className="min-w-0">
                <p><span className="rounded-sm bg-secondary px-1.5 py-0.5 font-mono text-xs font-semibold">{a.acao}</span> <span className="text-muted-foreground">{tr("em")}</span> <span className="font-medium">{a.entidade}</span> <span className="font-mono text-xs text-muted-foreground">{a.entidadeId}</span></p>
                {a.justificativa && <p className="mt-1 text-muted-foreground">{a.justificativa}</p>}
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
