import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { carregarBase } from "@/services/db";
import { cancelarInscricao } from "@/services/inscricoes";
import { useAuth } from "@/contexts/AuthContext";
import { formatarBRL, formatarDataBR } from "@/lib/domain/money";
import { Badge, Botao, Cartao, EstadoVazio, Modal, AreaTexto } from "@/components/ui";
import type { Inscricao } from "@/lib/domain/types";

export const Route = createFileRoute("/app/ingressos")({
  head: () => ({
    meta: [
      { title: "Meus ingressos — MilSim Ops" },
      { name: "description", content: "Ingressos, status e histórico de participação." },
      { property: "og:title", content: "Meus ingressos — MilSim Ops" },
      { property: "og:description", content: "Ingressos e histórico." },
    ],
  }),
  component: MeusIngressos,
});

const tomStatus: Record<Inscricao["status"], "sucesso" | "perigo" | "aviso"> = {
  confirmada: "sucesso",
  cancelada: "perigo",
  estornada: "aviso",
};

function MeusIngressos() {
  const { usuario } = useAuth();
  const [, setVersao] = useState(0);
  const [cancelando, setCancelando] = useState<Inscricao | null>(null);
  const [motivo, setMotivo] = useState("");
  const [erro, setErro] = useState("");
  const base = carregarBase();
  if (!usuario) return null;

  const minhas = base.inscricoes
    .filter((i) => i.usuarioId === usuario.id)
    .sort((a, b) => b.criadoEm.localeCompare(a.criadoEm));

  const aoCancelar = async () => {
    if (!cancelando) return;
    setErro("");
    try {
      await cancelarInscricao(cancelando.id, motivo, usuario.id);
      setCancelando(null);
      setMotivo("");
      setVersao((v) => v + 1);
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Falha ao cancelar.");
    }
  };

  return (
    <div>
      <h1 className="font-display text-2xl font-semibold uppercase">Meus ingressos</h1>
      {minhas.length === 0 ? (
        <div className="mt-4">
          <EstadoVazio titulo="Você ainda não possui ingressos" descricao="Inscreva-se em uma operação na página inicial." />
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          {minhas.map((ins) => {
            const evento = base.eventos.find((e) => e.id === ins.eventoId);
            const tipo = evento?.tipos.find((t) => t.id === ins.tipoId);
            const lote = evento?.lotes.find((l) => l.id === ins.loteId);
            const exercito = evento?.exercitos.find((e) => e.id === ins.exercitoId);
            return (
              <Cartao key={ins.id}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="font-medium">{evento?.nome ?? "Evento"}</h2>
                    <p className="text-sm text-muted-foreground">
                      {evento && `${formatarDataBR(evento.inicioEm)} · ${evento.cidade}/${evento.uf}`}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {tipo?.nome}{lote ? ` · ${lote.nome}` : ""} · Exército: {exercito?.nome}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {ins.origem === "cortesia"
                        ? "Cortesia por convite"
                        : ins.descontoCentavos >= ins.valorCentavos && ins.valorCentavos > 0
                          ? "Inscrição integralmente descontada"
                          : `Valor: ${formatarBRL(ins.valorCentavos - ins.descontoCentavos)}`}
                    </p>
                  </div>
                  <div className="text-right">
                    <Badge tom={tomStatus[ins.status]}>
                      {ins.status === "confirmada" ? "Confirmada" : ins.status === "estornada" ? "Estornada" : "Cancelada"}
                    </Badge>
                    <p className="mt-2 font-mono text-sm text-accent">{ins.codigo}</p>
                    <p className="text-[11px] text-muted-foreground">Código fictício — sem dados pessoais</p>
                  </div>
                </div>
                {ins.status === "confirmada" && (
                  <div className="mt-3">
                    <Botao variante="contorno" onClick={() => setCancelando(ins)}>
                      Cancelar inscrição
                    </Botao>
                  </div>
                )}
              </Cartao>
            );
          })}
        </div>
      )}

      <Modal aberto={!!cancelando} titulo="Cancelar inscrição" onFechar={() => setCancelando(null)}>
        <p className="text-sm text-muted-foreground">
          O cancelamento invalida o ingresso, libera a vaga e registra o estorno integral simulado.
          O histórico é preservado.
        </p>
        <div className="mt-3">
          <AreaTexto
            placeholder="Justificativa do cancelamento (obrigatória)"
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
          />
        </div>
        {erro && <p role="alert" className="mt-2 text-sm text-destructive">{erro}</p>}
        <div className="mt-4 flex justify-end gap-2">
          <Botao variante="fantasma" onClick={() => setCancelando(null)}>Voltar</Botao>
          <Botao variante="perigo" onClick={aoCancelar}>Confirmar cancelamento</Botao>
        </div>
      </Modal>
    </div>
  );
}
