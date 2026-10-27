import { FaixaIndicadores } from "@/components/FaixaIndicadores";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { carregarBase } from "@/services/db";
import { aprovarAutorizacaoResponsavel, desativarUsuario } from "@/api/admin.functions";
import { useAuth } from "@/contexts/AuthContext";
import { mascararCpf } from "@/lib/domain/validators";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ModalTexto } from "@/components/ui";
import { useVersaoBase } from "@/hooks/useVersaoBase";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

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
  useVersaoBase(); // contadores e lista acompanham cadastros e desativações
  const [erro, setErro] = useState("");
  const [desativando, setDesativando] = useState<{ id: string; nome: string } | null>(null);
  if (!usuario) return null;
  const base = carregarBase();
  const ativos = base.usuarios.filter((u) => u.ativo);
  const porPerfil = (p: (typeof base.usuarios)[number]["perfil"]) => ativos.filter((u) => u.perfil === p).length;

  return (
    <section>
      <h2 className="titulo-pagina">Usuários</h2>
      <FaixaIndicadores className="mt-4 lg:grid-cols-4" itens={[
        { rotulo: "Usuários ativos", valor: String(ativos.length), detalhe: `de ${base.usuarios.length} cadastrados` },
        { rotulo: "Participantes", valor: String(porPerfil("participante")) },
        { rotulo: "Organizadores", valor: String(porPerfil("organizador")) },
        { rotulo: "Admins · inativos", valor: `${porPerfil("admin")} · ${base.usuarios.length - ativos.length}` },
      ]} />
      {erro && <p role="alert" className="mt-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">{erro}</p>}
      <div className="mt-3 overflow-x-auto">
        <Table className="tabela-cards w-full text-sm">
          <TableHeader>
            <TableRow className="border-b border-border text-left text-xs uppercase text-muted-foreground">
              <TableHead className="py-2 pr-3">Nome</TableHead>
              <TableHead className="py-2 pr-3">E-mail</TableHead>
              <TableHead className="py-2 pr-3">CPF</TableHead>
              <TableHead className="py-2 pr-3">Perfil</TableHead>
              <TableHead className="py-2 pr-3">Status</TableHead>
              <TableHead className="py-2">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {base.usuarios.map((u) => (
              <TableRow key={u.id} className="border-b border-border/50">
                <TableCell className="py-2 pr-3 font-medium lg:font-normal">{u.nomeCompleto}</TableCell>
                <TableCell data-rotulo="E-mail" className="py-2 pr-3 break-all">{u.email}</TableCell>
                <TableCell data-rotulo="CPF" className="py-2 pr-3 font-mono text-xs">{mascararCpf(u.cpf)}</TableCell>
                <TableCell data-rotulo="Perfil" className="py-2 pr-3 capitalize text-muted-foreground">{u.perfil}</TableCell>
                <TableCell data-rotulo="Status" className="py-2 pr-3">
                  <Badge variant={u.ativo ? "success" : "destructive"}>{u.ativo ? "Ativo" : "Inativo"}</Badge>
                  {u.autorizacaoResponsavel === "pendente" && <Badge variant="warning">Autorização pendente</Badge>}
                </TableCell>
                <TableCell className="celula-acoes py-2">
                  <div className="flex flex-wrap gap-1">
                    {u.autorizacaoResponsavel === "pendente" && (
                      <Button variant="outline" onClick={() => aprovarAutorizacaoResponsavel(u.id).then(() => setVersao((v) => v + 1))}>
                        Aprovar autorização
                      </Button>
                    )}
                    {u.ativo && u.id !== usuario.id && (
                      <Button
                        variant="ghost" size="sm" className="text-muted-foreground hover:text-destructive"
                        onClick={() => {
                          setErro("");
                          setDesativando({ id: u.id, nome: u.nomeCompleto });
                        }}
                      >
                        Desativar
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <ModalTexto
        aberto={!!desativando}
        titulo="Desativar usuário"
        rotulo="Justificativa (obrigatória)"
        descricao={desativando ? `A conta de ${desativando.nome} será desativada e perderá o acesso à plataforma.` : undefined}
        confirmar="Desativar"
        destrutivo
        maximo={1000}
        onFechar={() => setDesativando(null)}
        onConfirmar={(j) => desativarUsuario(desativando!.id, j).then(() => setVersao((v) => v + 1))}
      />
    </section>
  );
}
