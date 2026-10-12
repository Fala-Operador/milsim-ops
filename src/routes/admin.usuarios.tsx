import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { carregarBase } from "@/services/db";
import { aprovarAutorizacaoResponsavel, desativarUsuario } from "@/services/admin";
import { useAuth } from "@/contexts/AuthContext";
import { mascararCpf } from "@/lib/domain/validators";
import { Badge, Botao } from "@/components/ui";

export const Route = createFileRoute("/admin/usuarios")({
  head: () => ({
    meta: [
      { title: "Usuários — Admin MilSim Ops" },
      { name: "description", content: "Gestão de usuários da plataforma." },
      { property: "og:title", content: "Usuários — Admin MilSim Ops" },
      { property: "og:description", content: "Gestão de usuários." },
    ],
  }),
  component: Usuarios,
});

function Usuarios() {
  const { usuario } = useAuth();
  const [, setVersao] = useState(0);
  const [erro, setErro] = useState("");
  if (!usuario) return null;
  const base = carregarBase();

  return (
    <section>
      <h2 className="font-display text-lg font-semibold uppercase">Usuários</h2>
      {erro && <p role="alert" className="mt-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">{erro}</p>}
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
  );
}
