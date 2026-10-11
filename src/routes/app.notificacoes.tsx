import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useNotifications } from "@/contexts/NotificationContext";
import { formatarDataHoraBR } from "@/lib/domain/money";
import { Botao, Cartao, EstadoVazio } from "@/components/ui";

export const Route = createFileRoute("/app/notificacoes")({
  head: () => ({
    meta: [
      { title: "Notificações — MilSim Ops" },
      { name: "description", content: "Central de notificações da plataforma." },
      { property: "og:title", content: "Notificações — MilSim Ops" },
      { property: "og:description", content: "Central de notificações." },
    ],
  }),
  component: CentralNotificacoes,
});

function CentralNotificacoes() {
  const { notificacoes, naoLidas, marcarLida, marcarTodasLidas } = useNotifications();
  const [soNaoLidas, setSoNaoLidas] = useState(false);

  const lista = soNaoLidas ? notificacoes.filter((n) => !n.lida) : notificacoes;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="font-display text-2xl font-semibold uppercase">Notificações</h1>
        <div className="flex gap-2">
          <Botao variante="contorno" onClick={() => setSoNaoLidas((v) => !v)}>
            {soNaoLidas ? "Mostrar todas" : `Somente não lidas (${naoLidas})`}
          </Botao>
          <Botao variante="fantasma" onClick={marcarTodasLidas} disabled={naoLidas === 0}>
            Marcar todas como lidas
          </Botao>
        </div>
      </div>

      {lista.length === 0 ? (
        <div className="mt-4">
          <EstadoVazio titulo="Nenhuma notificação" descricao="Você está em dia." />
        </div>
      ) : (
        <ul className="mt-4 space-y-2">
          {lista.map((n) => (
            <li key={n.id}>
              <Cartao className={n.lida ? "opacity-70" : ""}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">
                      {!n.lida && <span className="mr-2 inline-block h-2 w-2 rounded-full bg-accent" aria-label="Não lida" />}
                      {n.titulo}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">{n.corpo}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{formatarDataHoraBR(n.criadoEm)}</p>
                    {n.link && (
                      <Link to={n.link} className="mt-1 inline-block text-sm text-accent hover:underline">
                        Ver conteúdo relacionado →
                      </Link>
                    )}
                  </div>
                  {!n.lida && (
                    <Botao variante="fantasma" onClick={() => marcarLida(n.id)}>
                      Marcar como lida
                    </Botao>
                  )}
                </div>
              </Cartao>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
