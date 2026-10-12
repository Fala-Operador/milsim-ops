import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { carregarBase } from "@/services/db";
import {
  analisarSolicitacao,
  aprovarAutorizacaoResponsavel,
  desativarUsuario,
  listarAuditoria,
  responderPrivacidade,
  restaurarBaseDemonstrativa,
} from "@/services/admin";
import { useAuth } from "@/contexts/AuthContext";
import { formatarBRL, formatarDataBR, formatarDataHoraBR } from "@/lib/domain/money";
import { mascararCpf } from "@/lib/domain/validators";
import { AreaTexto, Badge, Botao, Cartao, Modal, SkeletonPagina } from "@/components/ui";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Administração — MilSim Ops" },
      { name: "description", content: "Administração global: solicitações, usuários, privacidade e auditoria." },
      { property: "og:title", content: "Administração — MilSim Ops" },
      { property: "og:description", content: "Administração global." },
    ],
  }),
  component: PainelAdmin,
});

function PainelAdmin() {
  const { usuario } = useAuth();
  const navigate = useNavigate();
  const [, setVersao] = useState(0);
  const [justificativa, setJustificativa] = useState<Record<string, string>>({});
  const [confirmarRestauro, setConfirmarRestauro] = useState(false);
  const [erro, setErro] = useState("");

  useEffect(() => {
    if (usuario && usuario.perfil !== "admin") navigate({ to: "/app" });
  }, [usuario, navigate]);

  if (!usuario) return <SkeletonPagina />;
  if (usuario.perfil !== "admin") return null;

  const base = carregarBase();
  const pendentes = base.solicitacoes
    .filter((s) => ["pendente", "em_analise"].includes(s.status))
    .sort((a, b) => a.criadoEm.localeCompare(b.criadoEm));
  const auditoria = listarAuditoria().slice(0, 30);

  const agir = async (id: string, acao: "iniciar" | "aprovar" | "ajustes" | "rejeitar") => {
    setErro("");
    try {
      await analisarSolicitacao(id, usuario.id, acao, justificativa[id]);
      setVersao((v) => v + 1);
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Falha na ação.");
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-semibold uppercase">Administração</h1>
        <Botao variante="perigo" onClick={() => setConfirmarRestauro(true)}>
          Restaurar base demonstrativa
        </Botao>
      </div>
      {erro && <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">{erro}</p>}

      <section>
        <h2 className="font-display text-lg font-semibold uppercase">Visão geral</h2>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Cartao>
            <p className="text-xs uppercase text-muted-foreground">Eventos</p>
            <p className="font-display text-2xl font-semibold">{base.eventos.length}</p>
          </Cartao>
          <Cartao>
            <p className="text-xs uppercase text-muted-foreground">Inscrições ativas</p>
            <p className="font-display text-2xl font-semibold">
              {base.inscricoes.filter((i) => i.status === "confirmada").length}
            </p>
          </Cartao>
          <Cartao>
            <p className="text-xs uppercase text-muted-foreground">Receita simulada</p>
            <p className="font-display text-2xl font-semibold">
              {formatarBRL(base.movimentacoes.reduce((s, m) => s + m.valorCentavos, 0))}
            </p>
          </Cartao>
          <Cartao>
            <p className="text-xs uppercase text-muted-foreground">Usuários ativos</p>
            <p className="font-display text-2xl font-semibold">
              {base.usuarios.filter((u) => u.ativo).length}
            </p>
          </Cartao>
        </div>
      </section>

      <section>
        <h2 className="font-display text-lg font-semibold uppercase">Eventos</h2>
        {base.eventos.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">Nenhum evento cadastrado.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase text-muted-foreground">
                  <th className="py-2 pr-3">Evento</th>
                  <th className="py-2 pr-3">Data</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 pr-3">Ocupação</th>
                  <th className="py-2 pr-3">Receita</th>
                  <th className="py-2">Ações</th>
                </tr>
              </thead>
              <tbody>
                {base.eventos.map((ev) => {
                  const inscritas = base.inscricoes.filter(
                    (i) => i.eventoId === ev.id && i.status === "confirmada",
                  ).length;
                  const receita = base.movimentacoes
                    .filter((m) => m.eventoId === ev.id)
                    .reduce((s, m) => s + m.valorCentavos, 0);
                  const org = base.organizacoes.find((o) => o.id === ev.organizacaoId);
                  const tomStatus =
                    ev.status === "publicado" ? "sucesso"
                    : ev.status === "cancelado" ? "perigo"
                    : ev.status === "rascunho" ? "aviso"
                    : "neutro";
                  return (
                    <tr key={ev.id} className="border-b border-border/50">
                      <td className="py-2 pr-3">
                        <p className="font-medium">{ev.nome}</p>
                        <p className="text-xs text-muted-foreground">
                          {org?.nome ?? "—"} · {ev.cidade}/{ev.uf}
                        </p>
                      </td>
                      <td className="py-2 pr-3">{formatarDataBR(ev.inicioEm)}</td>
                      <td className="py-2 pr-3">
                        <Badge tom={tomStatus}>{ev.status.replace("_", " ")}</Badge>
                      </td>
                      <td className="py-2 pr-3">
                        {inscritas}/{ev.capacidadeTotal}
                      </td>
                      <td className="py-2 pr-3">{formatarBRL(receita)}</td>
                      <td className="py-2">
                        <Link to="/eventos/$eventoId" params={{ eventoId: ev.id }}>
                          <Botao variante="contorno">Ver</Botao>
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section>
        <h2 className="font-display text-lg font-semibold uppercase">Solicitações de organizador</h2>
        {pendentes.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">Nenhuma solicitação aguardando.</p>
        ) : (
          <div className="mt-3 space-y-3">
            {pendentes.map((s) => {
              const u = base.usuarios.find((x) => x.id === s.usuarioId);
              return (
                <Cartao key={s.id}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-medium">{s.nomeOrganizacao}</p>
                      <p className="text-sm text-muted-foreground">
                        {u?.nomeCompleto} · {s.possuiCnpj ? `CNPJ ${s.cnpj}` : "sem CNPJ"} · {formatarDataHoraBR(s.criadoEm)}
                      </p>
                    </div>
                    <Badge tom="aviso">{s.status.replace("_", " ")}</Badge>
                  </div>
                  <AreaTexto
                    className="mt-3"
                    rows={2}
                    placeholder="Justificativa (obrigatória para ajustes/rejeição)"
                    value={justificativa[s.id] ?? ""}
                    onChange={(e) => setJustificativa((p) => ({ ...p, [s.id]: e.target.value }))}
                  />
                  <div className="mt-2 flex flex-wrap gap-2">
                    {s.status === "pendente" && <Botao variante="contorno" onClick={() => agir(s.id, "iniciar")}>Iniciar análise</Botao>}
                    <Botao onClick={() => agir(s.id, "aprovar")}>Aprovar</Botao>
                    <Botao variante="secundario" onClick={() => agir(s.id, "ajustes")}>Solicitar ajustes</Botao>
                    <Botao variante="perigo" onClick={() => agir(s.id, "rejeitar")}>Rejeitar</Botao>
                  </div>
                </Cartao>
              );
            })}
          </div>
        )}
      </section>

      <section>
        <h2 className="font-display text-lg font-semibold uppercase">Usuários</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase text-muted-foreground">
                <th className="py-2 pr-3">Nome</th>
                <th className="py-2 pr-3">E-mail</th>
                <th className="py-2 pr-3">CPF</th>
                <th className="py-2 pr-3">Perfil</th>
                <th className="py-2 pr-3">Status</th>
                <th className="py-2">Ações</th>
              </tr>
            </thead>
            <tbody>
              {base.usuarios.map((u) => (
                <tr key={u.id} className="border-b border-border/50">
                  <td className="py-2 pr-3">{u.nomeCompleto}</td>
                  <td className="py-2 pr-3">{u.email}</td>
                  <td className="py-2 pr-3 font-mono text-xs">{mascararCpf(u.cpf)}</td>
                  <td className="py-2 pr-3">{u.perfil}</td>
                  <td className="py-2 pr-3">
                    <Badge tom={u.ativo ? "sucesso" : "perigo"}>{u.ativo ? "Ativo" : "Inativo"}</Badge>
                    {u.autorizacaoResponsavel === "pendente" && <Badge tom="aviso">Autorização pendente</Badge>}
                  </td>
                  <td className="py-2">
                    <div className="flex gap-1">
                      {u.autorizacaoResponsavel === "pendente" && (
                        <Botao variante="contorno" onClick={() => aprovarAutorizacaoResponsavel(u.id, usuario.id).then(() => setVersao((v) => v + 1))}>
                          Aprovar autorização
                        </Botao>
                      )}
                      {u.ativo && u.id !== usuario.id && (
                        <Botao
                          variante="perigo"
                          onClick={() => {
                            const j = prompt("Justificativa para desativar (obrigatória):");
                            if (j) desativarUsuario(u.id, usuario.id, j).then(() => setVersao((v) => v + 1)).catch((e) => setErro(e.message));
                          }}
                        >
                          Desativar
                        </Botao>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

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
                      if (r) responderPrivacidade(p.id, usuario.id, r).then(() => setVersao((v) => v + 1));
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

      <section>
        <h2 className="font-display text-lg font-semibold uppercase">Auditoria (demonstrativa)</h2>
        <p className="text-xs text-muted-foreground">
          O armazenamento local não oferece integridade de auditoria de produção.
        </p>
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

      <Modal aberto={confirmarRestauro} titulo="Restaurar base demonstrativa" onFechar={() => setConfirmarRestauro(false)}>
        <p className="text-sm text-muted-foreground">
          Isso apaga todos os dados desta aplicação (somente desta aplicação) e recria os registros
          iniciais. Ação irreversível.
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <Botao variante="fantasma" onClick={() => setConfirmarRestauro(false)}>Voltar</Botao>
          <Botao
            variante="perigo"
            onClick={async () => {
              await restaurarBaseDemonstrativa();
              window.location.href = "/";
            }}
          >
            Confirmar restauração
          </Botao>
        </div>
      </Modal>
    </div>
  );
}
