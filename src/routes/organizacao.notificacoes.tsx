import { carregarBase } from "@/services/db";
import { resolverLinkSuporte } from "@/lib/suporte";
import { destinoDoLink } from "@/lib/links";
import { useAuth } from "@/contexts/AuthContext";
import { useNotifications } from "@/contexts/NotificationContext";
import { notificacaoAcessivel } from "@/services/comunidade";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { formatarDataHoraBR } from "@/lib/domain/money";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EstadoVazio } from "@/components/ui";
import { SilencioNotificacoes } from "@/components/SilencioNotificacoes";
import { tr } from "@/i18n/routes/organizacao.notificacoes";

export const Route = createFileRoute("/organizacao/notificacoes")({
  head: () => ({
    meta: [
      { title: tr("notificacoes_da_organizacao_milsim_ops") },
      { name: "description", content: tr("acompanhe_solicitacoes_e_inscricoes_dos") },
      { property: "og:title", content: tr("notificacoes_da_organizacao_milsim_ops") },
      { property: "og:description", content: tr("solicitacoes_e_inscricoes_dos_seus_event") },
    ],
  }),
  component: NotificacoesOrganizacao,
});

const PADRAO_ORGANIZACAO = /inscri|solicit|evento|cortesia|denúnc|denunc|comunidad|cancelamento|estorno|suporte|chamado|demanda|encaminh|protocolo/i;

function NotificacoesOrganizacao() {
  const { usuario } = useAuth();
  const usuarioLink = usuario ?? null;
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
          <h2 className="titulo-pagina">{tr("notificacoes")}</h2>
          <p className="subtitulo-pagina">{tr("acompanhe_solicitacoes_inscricoes_e_novi")}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setSoNaoLidas((v) => !v)}>
            {soNaoLidas ? tr("mostrar_todas") : tr("somente_nao_lidas_naolidas", { naoLidas })}
          </Button>
          <Button variant="ghost" onClick={marcarTodasLidas} disabled={naoLidas === 0}>{tr("marcar_todas_como_lidas")}</Button>
        </div>
      </div>
      <SilencioNotificacoes />

      {lista.length === 0 ? (
        <div className="mt-4">
          <EstadoVazio titulo={tr("nenhuma_notificacao")} descricao={tr("nenhuma_solicitacao_ou_inscricao_nova_po")} />
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
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">{n.corpo}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{formatarDataHoraBR(n.criadoEm)}</p>
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
