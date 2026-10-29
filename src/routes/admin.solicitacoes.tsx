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
import { tr } from "@/i18n/routes/admin.solicitacoes";

export const Route = createFileRoute("/admin/solicitacoes")({
  head: () => ({
    meta: [
      { title: tr("solicitacoes_de_organizador_milsim_ops") },
      { name: "description", content: tr("analise_de_solicitacoes_para_se_tornar") },
      { property: "og:title", content: tr("solicitacoes_de_organizador_milsim_ops") },
      { property: "og:description", content: tr("analise_de_solicitacoes_de_organizador") },
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
      setErro(err instanceof Error ? err.message : tr("falha_na_acao"));
    }
  };

  return (
    <section>
      <h2 className="titulo-pagina">{tr("solicitacoes_de_organizador")}</h2>
      {erro && <p role="alert" className="mt-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">{erro}</p>}
      {pendentes.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">{tr("nenhuma_solicitacao_aguardando")}</p>
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
                    <div><dt className="rotulo-tecnico">{tr("solicitante")}</dt><dd className="mt-0.5">{u?.nomeCompleto}</dd></div>
                    <div><dt className="rotulo-tecnico">{tr("e_mail")}</dt><dd className="mt-0.5 break-all">{u?.email}</dd></div>
                    <div><dt className="rotulo-tecnico">{tr("cnpj")}</dt><dd className="mt-0.5 font-mono">{s.possuiCnpj ? s.cnpj : tr("nao_possui")}</dd></div>
                    <div><dt className="rotulo-tecnico">{tr("cidade")}</dt><dd className="mt-0.5">{u?.endereco?.cidade ? `${u.endereco.cidade}/${u.endereco.uf}` : "—"}</dd></div>
                  </dl>
                </div>
                <div className="space-y-2 border-t border-border bg-card/50 p-5 lg:border-l lg:border-t-0">
                  <p className="rotulo-tecnico">{tr("decisao")}</p>
                  <Textarea rows={3} placeholder={tr("justificativa_obrigatoria_para_ajustes_o")}
                    value={justificativa[s.id] ?? ""} onChange={(e) => setJustificativa((p) => ({ ...p, [s.id]: e.target.value }))} />
                  <Button className="w-full" onClick={() => agir(s.id, "aprovar")}>{tr("aprovar_organizacao")}</Button>
                  <div className="grid grid-cols-2 gap-2">
                    <Button variant="outline" onClick={() => agir(s.id, "ajustes")}>{tr("pedir_ajustes")}</Button>
                    <Button variant="destructive" onClick={() => agir(s.id, "rejeitar")}>{tr("rejeitar")}</Button>
                  </div>
                  {s.status === "pendente" && <Button variant="link" size="none" className="text-xs" onClick={() => agir(s.id, "iniciar")}>{tr("marcar_como_em_analise")}</Button>}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
