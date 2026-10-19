import { carregarBase } from "@/services/db";
import { resolverLinkSuporte } from "@/lib/suporte";
import { destinoDoLink } from "@/lib/links";
import { useAuth } from "@/contexts/AuthContext";
import { notificacaoAcessivel } from "@/services/comunidade";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useNotifications } from "@/contexts/NotificationContext";
import { formatarDataHoraBR } from "@/lib/domain/money";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EstadoVazio } from "@/components/ui";
import { SilencioNotificacoes } from "@/components/SilencioNotificacoes";

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
  const { usuario: usuarioAtual } = useAuth();
  const usuarioLink = usuarioAtual ?? null;
  const { notificacoes, naoLidas, marcarLida, marcarTodasLidas } = useNotifications();
  const [soNaoLidas, setSoNaoLidas] = useState(false);

  const acessiveis = usuarioAtual ? notificacoes.filter((n) => notificacaoAcessivel(usuarioAtual, n.link)) : notificacoes;
  const lista = soNaoLidas ? acessiveis.filter((n) => !n.lida) : acessiveis;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="font-display text-2xl font-semibold uppercase">Notificações</h1>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setSoNaoLidas((v) => !v)}>
            {soNaoLidas ? "Mostrar todas" : `Somente não lidas (${naoLidas})`}
          </Button>
          <Button variant="ghost" onClick={marcarTodasLidas} disabled={naoLidas === 0}>
            Marcar todas como lidas
          </Button>
        </div>
      </div>
      <SilencioNotificacoes />

      {lista.length === 0 ? (
        <div className="mt-4">
          <EstadoVazio titulo="Nenhuma notificação" descricao="Você está em dia." />
        </div>
      ) : (
        <ul className="mt-4 space-y-2">
          {lista.map((n) => (
            <li key={n.id}>
              <Card className={n.lida ? "opacity-70" : ""}>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
                  <div className="min-w-0">
                    <p className="font-medium">
                      {!n.lida && <span className="mr-2 inline-block h-2 w-2 rounded-full bg-accent" aria-label="Não lida" />}
                      {n.titulo}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">{n.corpo}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{formatarDataHoraBR(n.criadoEm)}</p>
                    {n.link && (
                      <Link
                        {...(destinoDoLink(resolverLinkSuporte(carregarBase(), usuarioLink, n.link)) as { to: string })}
                        className="mt-1 inline-block text-sm text-accent hover:underline"
                        onClick={() => marcarLida(n.id)}
                      >
                        Ver conteúdo relacionado →
                      </Link>
                    )}
                  </div>
                  {!n.lida && (
                    <Button variant="ghost" className="-ml-4 self-start sm:ml-0 sm:shrink-0" onClick={() => marcarLida(n.id)}>
                      Marcar como lida
                    </Button>
                  )}
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
