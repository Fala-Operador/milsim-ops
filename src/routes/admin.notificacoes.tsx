import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { carregarBase, mutarBase } from "@/services/db";
import { useVersaoBase } from "@/hooks/useVersaoBase";
import { formatarDataHoraBR } from "@/lib/domain/money";
import { Botao, Cartao, EstadoVazio, Badge } from "@/components/ui";

export const Route = createFileRoute("/admin/notificacoes")({
  head: () => ({
    meta: [
      { title: "Notificações — Administração — MilSim Ops" },
      { name: "description", content: "Todas as notificações de eventos, inscrições e solicitações da plataforma." },
      { property: "og:title", content: "Notificações — Administração — MilSim Ops" },
      { property: "og:description", content: "Todas as notificações da plataforma." },
    ],
  }),
  component: NotificacoesAdmin,
});

const PADRAO_EVENTOS = /inscri|solicit|evento|cortesia|denúnc|denunc|comunidad|cancelamento|estorno/i;

function NotificacoesAdmin() {
  const versao = useVersaoBase();
  const [soNaoLidas, setSoNaoLidas] = useState(false);

  const todas = useMemo(() => {
    const base = carregarBase();
    const usuarios = new Map(base.usuarios.map((u) => [u.id, u.nomeExibicao || u.email]));
    return base.notificacoes
      .slice()
      .sort((a, b) => b.criadoEm.localeCompare(a.criadoEm))
      .map((n) => ({ ...n, destinatario: usuarios.get(n.usuarioId) ?? n.usuarioId }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [versao]);

  const naoLidas = todas.filter((n) => !n.lida).length;
  const lista = soNaoLidas ? todas.filter((n) => !n.lida) : todas;

  function marcarLida(id: string) {
    mutarBase((base) => {
      const n = base.notificacoes.find((x) => x.id === id);
      if (n) n.lida = true;
    });
  }

  function marcarTodasLidas() {
    mutarBase((base) => {
      base.notificacoes.forEach((n) => {
        n.lida = true;
      });
    });
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-display text-xl font-semibold uppercase">Notificações</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Todas as notificações de eventos, inscrições e solicitações da plataforma.
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

      {lista.length === 0 ? (
        <div className="mt-4">
          <EstadoVazio titulo="Nenhuma notificação" descricao="Nenhuma notificação registrada na plataforma." />
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
                      {PADRAO_EVENTOS.test(`${n.titulo} ${n.corpo}`) && (
                        <span className="ml-2"><Badge>eventos/inscrições</Badge></span>
                      )}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">{n.corpo}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Para: {n.destinatario} · {formatarDataHoraBR(n.criadoEm)}
                    </p>
                    {n.link && (
                      <Link
                        to={n.link}
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
