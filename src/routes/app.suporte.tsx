import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { carregarBase, mutarBase, gerarId } from "@/services/db";
import { useAuth } from "@/contexts/AuthContext";
import { formatarDataHoraBR } from "@/lib/domain/money";
import { AreaTexto, Badge, Botao, Campo, Cartao, Entrada, EstadoVazio, Modal, Selecao } from "@/components/ui";
import type { StatusChamado } from "@/lib/domain/types";

export const Route = createFileRoute("/app/suporte")({
  head: () => ({
    meta: [
      { title: "Suporte — MilSim Ops" },
      { name: "description", content: "Abra e acompanhe chamados de suporte." },
      { property: "og:title", content: "Suporte — MilSim Ops" },
      { property: "og:description", content: "Chamados de suporte." },
    ],
  }),
  component: PaginaSuporte,
});

const rotulos: Record<StatusChamado, string> = {
  aberto: "Aberto",
  em_atendimento: "Em atendimento",
  aguardando_participante: "Aguardando participante",
  resolvido: "Resolvido",
  fechado: "Fechado",
};

function PaginaSuporte() {
  const { usuario } = useAuth();
  const [, setVersao] = useState(0);
  const [novo, setNovo] = useState(false);
  const [aberto, setAberto] = useState<string | null>(null);
  const [resposta, setResposta] = useState("");
  const [form, setForm] = useState({ assunto: "", categoria: "Logística", descricao: "", eventoId: "" });
  const base = carregarBase();
  if (!usuario) return null;

  // Chamados continuam visíveis mesmo após cancelamento da inscrição
  const meus = base.chamados
    .filter((c) => c.solicitanteId === usuario.id)
    .sort((a, b) => b.atualizadoEm.localeCompare(a.atualizadoEm));
  const eventosInscrito = base.inscricoes
    .filter((i) => i.usuarioId === usuario.id)
    .map((i) => base.eventos.find((e) => e.id === i.eventoId))
    .filter(Boolean);

  const abrir = () => {
    if (!form.assunto.trim() || !form.descricao.trim()) return;
    mutarBase((b) => {
      b.chamados.push({
        id: gerarId("cha"),
        eventoId: form.eventoId || undefined,
        solicitanteId: usuario.id,
        assunto: form.assunto.trim(),
        categoria: form.categoria,
        descricao: form.descricao.trim(),
        status: "aberto",
        mensagens: [
          { id: gerarId("msg"), autorId: usuario.id, corpo: form.descricao.trim(), criadoEm: new Date().toISOString() },
        ],
        criadoEm: new Date().toISOString(),
        atualizadoEm: new Date().toISOString(),
      });
    });
    setNovo(false);
    setForm({ assunto: "", categoria: "Logística", descricao: "", eventoId: "" });
    setVersao((v) => v + 1);
  };

  const responder = (chamadoId: string) => {
    if (!resposta.trim()) return;
    mutarBase((b) => {
      const c = b.chamados.find((x) => x.id === chamadoId);
      if (!c) return;
      c.mensagens.push({ id: gerarId("msg"), autorId: usuario.id, corpo: resposta.trim(), criadoEm: new Date().toISOString() });
      c.status = "aberto";
      c.atualizadoEm = new Date().toISOString();
    });
    setResposta("");
    setVersao((v) => v + 1);
  };

  const chamadoAberto = meus.find((c) => c.id === aberto);

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-semibold uppercase">Suporte</h1>
        <Botao onClick={() => setNovo(true)}>Abrir chamado</Botao>
      </div>

      {meus.length === 0 ? (
        <div className="mt-4">
          <EstadoVazio titulo="Nenhum chamado" descricao="Abra um chamado para falar com a organização." />
        </div>
      ) : (
        <ul className="mt-4 space-y-2">
          {meus.map((c) => (
            <li key={c.id}>
              <Cartao>
                <button className="w-full text-left" onClick={() => setAberto(c.id)}>
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium">{c.assunto}</p>
                    <Badge tom={c.status === "resolvido" || c.status === "fechado" ? "sucesso" : "aviso"}>
                      {rotulos[c.status]}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{c.categoria} · atualizado em {formatarDataHoraBR(c.atualizadoEm)}</p>
                </button>
              </Cartao>
            </li>
          ))}
        </ul>
      )}

      <Modal aberto={novo} titulo="Abrir chamado" onFechar={() => setNovo(false)}>
        <div className="space-y-3">
          <Campo rotulo="Assunto" htmlFor="assunto">
            <Entrada id="assunto" value={form.assunto} onChange={(e) => setForm((p) => ({ ...p, assunto: e.target.value }))} />
          </Campo>
          <Campo rotulo="Categoria" htmlFor="categoria">
            <Selecao id="categoria" value={form.categoria} onChange={(e) => setForm((p) => ({ ...p, categoria: e.target.value }))}>
              {["Logística", "Inscrição", "Produtos", "Regras", "Outro"].map((c) => (
                <option key={c}>{c}</option>
              ))}
            </Selecao>
          </Campo>
          <Campo rotulo="Evento (opcional)" htmlFor="evento">
            <Selecao id="evento" value={form.eventoId} onChange={(e) => setForm((p) => ({ ...p, eventoId: e.target.value }))}>
              <option value="">Nenhum</option>
              {eventosInscrito.map((e) => e && <option key={e.id} value={e.id}>{e.nome}</option>)}
            </Selecao>
          </Campo>
          <Campo rotulo="Descrição" htmlFor="desc">
            <AreaTexto id="desc" value={form.descricao} onChange={(e) => setForm((p) => ({ ...p, descricao: e.target.value }))} />
          </Campo>
          <Botao onClick={abrir} className="w-full">Enviar chamado</Botao>
        </div>
      </Modal>

      <Modal aberto={!!chamadoAberto} titulo={chamadoAberto?.assunto ?? "Chamado"} onFechar={() => setAberto(null)}>
        {chamadoAberto && (
          <div className="space-y-3">
            <Badge tom="aviso">{rotulos[chamadoAberto.status]}</Badge>
            <div className="max-h-72 space-y-2 overflow-y-auto">
              {chamadoAberto.mensagens.map((m) => {
                const autor = base.usuarios.find((u) => u.id === m.autorId);
                const eu = m.autorId === usuario.id;
                return (
                  <div key={m.id} className={`rounded-md border border-border p-2 text-sm ${eu ? "bg-elevated" : "bg-secondary"}`}>
                    <p className="text-xs text-muted-foreground">
                      {eu ? "Você" : (autor?.nomeCompleto.split(" ")[0] ?? "Equipe")} · {formatarDataHoraBR(m.criadoEm)}
                    </p>
                    <p>{m.corpo}</p>
                  </div>
                );
              })}
            </div>
            {chamadoAberto.status !== "fechado" && (
              <div className="flex gap-2">
                <Entrada placeholder="Escrever resposta..." value={resposta} onChange={(e) => setResposta(e.target.value)} />
                <Botao onClick={() => responder(chamadoAberto.id)}>Enviar</Botao>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
