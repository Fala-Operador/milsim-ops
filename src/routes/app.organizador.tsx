import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { carregarBase } from "@/services/db";
import { solicitarOrganizador, reenviarSolicitacao } from "@/services/organizador";
import { useAuth } from "@/contexts/AuthContext";
import { formatarDataHoraBR } from "@/lib/domain/money";
import { mascaraTelefone } from "@/lib/domain/validators";
import { Badge, Botao, Campo, Cartao, Entrada } from "@/components/ui";
import type { StatusSolicitacao } from "@/lib/domain/types";

export const Route = createFileRoute("/app/organizador")({
  head: () => ({
    meta: [
      { title: "Quero ser organizador — MilSim Ops" },
      { name: "description", content: "Solicite o perfil de organizador e acompanhe o status." },
      { property: "og:title", content: "Quero ser organizador — MilSim Ops" },
      { property: "og:description", content: "Solicitação de organizador." },
    ],
  }),
  component: QueroSerOrganizador,
});

const rotulos: Record<StatusSolicitacao, string> = {
  pendente: "Pendente",
  em_analise: "Em análise",
  ajustes_solicitados: "Ajustes solicitados",
  aprovada: "Aprovada",
  rejeitada: "Rejeitada",
};

function QueroSerOrganizador() {
  const { usuario, recarregar } = useAuth();
  const [, setVersao] = useState(0);
  const [possuiCnpj, setPossuiCnpj] = useState(false);
  const [f, setF] = useState({ cnpj: "", nomeOrganizacao: "", instagram: "", telefone: "" });
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);
  if (!usuario) return null;

  const solicitacoes = carregarBase()
    .solicitacoes.filter((s) => s.usuarioId === usuario.id)
    .sort((a, b) => b.criadoEm.localeCompare(a.criadoEm));
  const atual = solicitacoes[0];
  const podeNova = !atual || atual.status === "rejeitada";
  const precisaAjuste = atual?.status === "ajustes_solicitados";

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro("");
    setEnviando(true);
    try {
      if (precisaAjuste && atual) {
        await reenviarSolicitacao(atual.id, f);
      } else {
        await solicitarOrganizador(usuario.id, { possuiCnpj, ...f });
      }
      setVersao((v) => v + 1);
      recarregar();
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Falha ao enviar.");
    } finally {
      setEnviando(false);
    }
  };

  if (usuario.perfil === "organizador") {
    return (
      <Cartao>
        <p>Você já é organizador aprovado.</p>
        <Link to="/organizacao" className="text-accent hover:underline">Ir para minha organização →</Link>
      </Cartao>
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="font-display text-2xl font-semibold uppercase">Quero ser organizador</h1>

      {atual && (
        <Cartao>
          <div className="flex items-center justify-between">
            <p className="font-medium">{atual.nomeOrganizacao}</p>
            <Badge tom={atual.status === "aprovada" ? "sucesso" : atual.status === "rejeitada" ? "perigo" : "aviso"}>
              {rotulos[atual.status]}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">Atualizado em {formatarDataHoraBR(atual.atualizadoEm)}</p>
          {atual.observacaoAdmin && (
            <p className="mt-2 rounded-md border border-border bg-elevated p-2 text-sm">
              Observação da administração: {atual.observacaoAdmin}
            </p>
          )}
        </Cartao>
      )}

      {(podeNova || precisaAjuste) && (
        <Cartao>
          <form onSubmit={enviar} className="space-y-4">
            {!precisaAjuste && (
              <fieldset>
                <legend className="text-sm font-medium">Possui CNPJ?</legend>
                <div className="mt-1 flex gap-4 text-sm">
                  <label className="flex items-center gap-1"><input type="radio" checked={possuiCnpj} onChange={() => setPossuiCnpj(true)} /> Sim</label>
                  <label className="flex items-center gap-1"><input type="radio" checked={!possuiCnpj} onChange={() => setPossuiCnpj(false)} /> Não</label>
                </div>
              </fieldset>
            )}
            {possuiCnpj && !precisaAjuste && (
              <Campo rotulo="CNPJ" htmlFor="cnpj">
                <Entrada id="cnpj" value={f.cnpj} onChange={(e) => setF((p) => ({ ...p, cnpj: e.target.value }))} required />
              </Campo>
            )}
            <Campo rotulo="Nome da organização" htmlFor="nomeorg">
              <Entrada id="nomeorg" value={f.nomeOrganizacao} onChange={(e) => setF((p) => ({ ...p, nomeOrganizacao: e.target.value }))} required />
            </Campo>
            <Campo rotulo="Instagram da organização" htmlFor="instaorg">
              <Entrada id="instaorg" value={f.instagram} onChange={(e) => setF((p) => ({ ...p, instagram: e.target.value }))} />
            </Campo>
            <Campo rotulo="Telefone para contato" htmlFor="telorg">
              <Entrada id="telorg" value={f.telefone} onChange={(e) => setF((p) => ({ ...p, telefone: mascaraTelefone(e.target.value) }))} required />
            </Campo>
            {erro && <p role="alert" className="text-sm text-destructive">{erro}</p>}
            <Botao type="submit" disabled={enviando}>
              {precisaAjuste ? "Corrigir e reenviar" : "Enviar solicitação"}
            </Botao>
          </form>
        </Cartao>
      )}
    </div>
  );
}
