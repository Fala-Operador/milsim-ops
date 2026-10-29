import { useAuth } from "@/contexts/AuthContext";
import { resolverLinkSuporte } from "@/lib/suporte";
import { destinoDoLink } from "@/lib/links";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { carregarBase } from "@/services/db";
import { marcarNotificacaoLida, marcarNotificacoesLidas } from "@/api/conta.functions";
import { useVersaoBase } from "@/hooks/useVersaoBase";
import { formatarDataHoraBR } from "@/lib/domain/money";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EstadoVazio } from "@/components/ui";
import { tr } from "@/i18n/routes/admin.notificacoes";

export const Route = createFileRoute("/admin/notificacoes")({
  head: () => ({
    meta: [
      { title: tr("notificacoes_administracao_milsim_ops") },
      { name: "description", content: tr("todas_as_notificacoes_de_eventos_inscric") },
      { property: "og:title", content: tr("notificacoes_administracao_milsim_ops") },
      { property: "og:description", content: tr("todas_as_notificacoes_da_plataforma") },
    ],
  }),
  component: NotificacoesAdmin,
});

const PADRAO_EVENTOS = /inscri|solicit|evento|cortesia|denúnc|denunc|comunidad|cancelamento|estorno/i;

function NotificacoesAdmin() {
  // Links de outras pessoas abrem a tela equivalente da administração.
  const usuarioLink = useAuth().usuario ?? null;
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
    void marcarNotificacaoLida(id);
  }

  function marcarTodasLidas() {
    void marcarNotificacoesLidas(true);
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="titulo-pagina">{tr("notificacoes")}</h2>
          <p className="subtitulo-pagina">{tr("todas_as_notificacoes_de_eventos_inscric")}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setSoNaoLidas((v) => !v)}>
            {soNaoLidas ? tr("mostrar_todas") : tr("somente_nao_lidas_naolidas", { naoLidas })}
          </Button>
          <Button variant="ghost" onClick={marcarTodasLidas} disabled={naoLidas === 0}>{tr("marcar_todas_como_lidas")}</Button>
        </div>
      </div>

      {lista.length === 0 ? (
        <div className="mt-4">
          <EstadoVazio titulo={tr("nenhuma_notificacao")} descricao={tr("nenhuma_notificacao_registrada_na_plataf")} />
        </div>
      ) : (
        <ul className="mt-4 space-y-2">
          {lista.map((n) => (
            <li key={n.id}>
              <Card className={n.lida ? "opacity-70" : ""}>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
                  <div className="min-w-0">
                    <p className="font-medium">
                      {!n.lida && <span className="mr-2 inline-block h-2 w-2 rounded-full bg-accent" aria-label={tr("nao_lida")} />}
                      {n.titulo}
                      {PADRAO_EVENTOS.test(`${n.titulo} ${n.corpo}`) && (
                        <span className="ml-2"><Badge>{tr("eventos_inscricoes")}</Badge></span>
                      )}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">{n.corpo}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{tr("para_destinatario_criadoem", { destinatario: n.destinatario, criadoEm: formatarDataHoraBR(n.criadoEm) })}
                    </p>
                    {n.link && (
                      <Link
                        {...(destinoDoLink(resolverLinkSuporte(carregarBase(), usuarioLink, n.link)) as { to: string })}
                        className="mt-1 inline-block text-sm text-accent hover:underline"
                        onClick={() => marcarLida(n.id)}
                      >{tr("ver_conteudo_relacionado")}</Link>
                    )}
                  </div>
                  {!n.lida && (
                    <Button variant="ghost" className="-ml-4 self-start sm:ml-0 sm:shrink-0" onClick={() => marcarLida(n.id)}>{tr("marcar_como_lida")}</Button>
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
