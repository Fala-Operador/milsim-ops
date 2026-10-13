import { destinoDoLink } from "@/lib/links";
import { useAuth } from "@/contexts/AuthContext";
import { useNotifications } from "@/contexts/NotificationContext";
import { notificacaoAcessivel } from "@/services/comunidade";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { formatarDataHoraBR } from "@/lib/domain/money";
import { Botao, Cartao, EstadoVazio } from "@/components/ui";
import { SilencioNotificacoes } from "@/components/SilencioNotificacoes";

export const Route = createFileRoute("/organizacao/notificacoes")({
  head: () => ({
    meta: [
      { title: "Notificações da organização — MilSim Ops" },
      { name: "description", content: "Acompanhe solicitações e inscrições dos seus eventos." },
      { property: "og:title", content: "Notificações da organização — MilSim Ops" },
      { property: "og:description", content: "Solicitações e inscrições dos seus eventos." },
    ],
  }),
  component: NotificacoesOrganizacao,
});

const PADRAO_ORGANIZACAO = /inscri|solicit|evento|cortesia|denúnc|denunc|comunidad|cancelamento|estorno/i;

function NotificacoesOrganizacao() {
  const { usuario } = useAuth();
  const { notificacoes, naoLidas, marcarLida, marcarTodasLidas } = useNotifications();
  const [soNaoLidas, setSoNaoLidas] = useState(false);

  const acessiveis = usuario ? notificacoes.filter((n) => notificacaoAcessivel(usuario, n.link)) : notificacoes;
  const relevantes = acessiveis.filter((n) => PADRAO_ORGANIZACAO.test(`${n.titulo} ${n.corpo}`));
  const base = relevantes.length > 0 ? relevantes : acessiveis;
  const lista = soNaoLidas ? base.filter((n) => !n.lida) : base;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-display text-xl font-semibold uppercase">Notificações</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Acompanhe solicitações, inscrições e novidades dos seus eventos.
          </p>
        </div>
        <div className="flex gap-2">
          <Botao variante="contorno" onClick={() => setSoNaoLidas((v) => !v)}>
            {soNaoLidas ? "Mostrar todas" : `Somente não lidas (${naoLidas})`}
          </Botao>
          <Botao variante="fantasma" onClick={marcarTodasLidas} disabled={naoLidas === 0}>
            Marcar todas como lidas
          </Botao>
        </div>
      </div>
      <SilencioNotificacoes />

      {lista.length === 0 ? (
        <div className="mt-4">
          <EstadoVazio titulo="Nenhuma notificação" descricao="Nenhuma solicitação ou inscrição nova por enquanto." />
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
                      <Link
                        {...(destinoDoLink(n.link) as { to: string })}
                        className="mt-1 inline-block text-sm text-accent hover:underline"
                        onClick={() => marcarLida(n.id)}
                      >
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
