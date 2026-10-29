// Sino do cabeçalho: abre um balão com as notificações mais recentes (como em redes sociais).
// Clicar numa notificação marca como lida e abre o conteúdo; "Ver todas" leva à central completa.
import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Bell, BellOff } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useNotifications } from "@/contexts/NotificationContext";
import { carregarBase } from "@/services/db";
import { notificacaoAcessivel } from "@/services/comunidade";
import { resolverLinkSuporte } from "@/lib/suporte";
import { destinoDoLink } from "@/lib/links";
import { tempoRelativo } from "@/lib/tempoRelativo";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { Notificacao } from "@/lib/domain/types";
import { tr } from "@/i18n/components/SinoNotificacoes";

const LIMITE = 8;
const foco = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

function Conteudo({ n, agora }: { n: Notificacao; agora: Date }) {
  return (
    <>
      <span aria-hidden="true" className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.lida ? "bg-transparent" : "bg-accent"}`} />
      <span className="min-w-0 flex-1">
        <span className={`block text-sm ${n.lida ? "text-muted-foreground" : "font-medium text-foreground"}`}>
          {n.titulo}
          {!n.lida && <span className="sr-only">{" "}{tr("nao_lida")}</span>}
        </span>
        <span className="mt-0.5 line-clamp-2 block text-xs text-muted-foreground">{n.corpo}</span>
        <span className="mt-0.5 block text-[11px] text-muted-foreground/80">{tempoRelativo(n.criadoEm, agora)}</span>
      </span>
    </>
  );
}

export function SinoNotificacoes() {
  const { usuario } = useAuth();
  const { notificacoes, naoLidas, marcarLida, marcarTodasLidas } = useNotifications();
  const [aberto, setAberto] = useState(false);

  // Mesmo filtro da central: some o que a pessoa já não pode abrir (ex.: comunidade sem acesso).
  const recentes = useMemo(
    () =>
      notificacoes
        .filter((n) => !usuario || notificacaoAcessivel(usuario, n.link))
        .sort((a, b) => b.criadoEm.localeCompare(a.criadoEm))
        .slice(0, LIMITE),
    [notificacoes, usuario],
  );
  const agora = new Date();
  const rotulo = naoLidas > 99 ? "99+" : String(naoLidas);
  const linha = `flex w-full items-start gap-2.5 rounded-md px-3 py-2.5 text-left hover:bg-secondary ${foco}`;

  return (
    <Popover open={aberto} onOpenChange={setAberto}>
      <PopoverTrigger asChild>
        <Button variant="plain" size="none" type="button"
          className={`relative flex h-11 w-11 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground ${foco}`}
          aria-label={naoLidas > 0 ? tr("notificacoes_naolidas_nao_lidas", { naoLidas }) : tr("notificacoes_nenhuma_nao_lida")}>
          <Bell className={`h-5 w-5 ${naoLidas > 0 ? "text-warning" : ""}`} aria-hidden="true" />
          {naoLidas > 0 && (
            <span aria-hidden="true" className="absolute right-1 top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-warning px-1 text-[10px] font-bold leading-none text-warning-foreground">
              {rotulo}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={8} collisionPadding={8} className="w-[min(24rem,calc(100vw-1rem))] p-0">
        <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2.5">
          <p className="font-display text-sm font-semibold uppercase tracking-wide">{tr("notificacoes")}</p>
          <Button variant="ghost" className="h-7 px-2 text-xs" disabled={naoLidas === 0} onClick={marcarTodasLidas}>{tr("marcar_todas_como_lidas")}</Button>
        </div>
        {recentes.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-4 py-8 text-center text-sm text-muted-foreground">
            <BellOff className="h-6 w-6" aria-hidden="true" />{tr("voce_esta_em_dia_nenhuma_notificacao")}</div>
        ) : (
          <ul className="max-h-[min(28rem,65vh)] space-y-0.5 overflow-y-auto overscroll-contain p-1.5">
            {recentes.map((n) => (
              <li key={n.id}>
                {n.link ? (
                  <Link
                    {...(destinoDoLink(resolverLinkSuporte(carregarBase(), usuario ?? null, n.link)) as { to: string })}
                    className={linha}
                    onClick={() => {
                      if (!n.lida) marcarLida(n.id);
                      setAberto(false);
                    }}
                  >
                    <Conteudo n={n} agora={agora} />
                  </Link>
                ) : (
                  <Button variant="plain" size="none" type="button" className={linha} onClick={() => !n.lida && marcarLida(n.id)}>
                    <Conteudo n={n} agora={agora} />
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
        <div className="border-t border-border p-1.5">
          <Link to="/app/notificacoes" onClick={() => setAberto(false)}
            className={`block rounded-md px-3 py-2 text-center text-sm font-medium text-accent hover:bg-secondary ${foco}`}>{tr("ver_todas_as_notificacoes")}</Link>
        </div>
      </PopoverContent>
    </Popover>
  );
}
