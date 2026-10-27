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
        <h1 className="titulo-pagina">Notificações</h1>
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
        <ul className="mt-6 divide-y divide-border border-y border-border">
          {lista.map((n) => (
            <li key={n.id} className={`grid grid-cols-[12px_minmax(0,1fr)_auto] gap-x-3 py-4 ${n.lida ? "text-muted-foreground" : ""}`}>
              <span className={`mt-2 h-2 w-2 rounded-full ${n.lida ? "bg-transparent" : "bg-accent"}`} aria-label={n.lida ? undefined : "Não lida"} />
              <div className="min-w-0">
                <p className={`font-semibold ${n.lida ? "font-medium" : "text-foreground"}`}>{n.titulo}</p>
                <p className="mt-0.5 text-sm text-muted-foreground">{n.corpo}</p>
                <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                  {n.link && (
                    <Link {...(destinoDoLink(resolverLinkSuporte(carregarBase(), usuarioLink, n.link)) as { to: string })}
                      className="font-medium text-accent hover:underline" onClick={() => marcarLida(n.id)}>Abrir</Link>
                  )}
                  {!n.lida && <Button variant="link" size="none" className="text-sm text-muted-foreground" onClick={() => marcarLida(n.id)}>Marcar como lida</Button>}
                </div>
              </div>
              <time className="font-mono text-xs text-muted-foreground">{formatarDataHoraBR(n.criadoEm)}</time>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
