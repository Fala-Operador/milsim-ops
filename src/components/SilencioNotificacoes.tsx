import { useAuth } from "@/contexts/AuthContext";
import { useVersaoBase } from "@/hooks/useVersaoBase";
import { carregarBase } from "@/services/db";
import { definirSilencio } from "@/api/conta.functions";
import { BellOff, Bell } from "lucide-react";

/** Preferências de silêncio: todas as notificações ou só as da comunidade. */
export function SilencioNotificacoes() {
  const { usuario } = useAuth();
  const versao = useVersaoBase();
  if (!usuario) return null;

  // Relê a visão após cada resposta da API.
  void versao;
  const atual = carregarBase().usuarios.find((u) => u.id === usuario.id);
  const silencio = atual?.silencioNotificacoes ?? {};

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
      <span className="text-muted-foreground">Silenciar:</span>
      <button
        type="button"
        onClick={() => void definirSilencio({ comunidade: !silencio.comunidade })}
        className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs transition-colors ${
          silencio.comunidade ? "border-accent bg-accent/10 text-accent" : "border-border text-muted-foreground hover:text-foreground"
        }`}
        aria-pressed={!!silencio.comunidade}
      >
        {silencio.comunidade ? <BellOff className="h-3 w-3" /> : <Bell className="h-3 w-3" />}
        Comunidade {silencio.comunidade ? "silenciada" : ""}
      </button>
      <button
        type="button"
        onClick={() => void definirSilencio({ todas: !silencio.todas })}
        className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs transition-colors ${
          silencio.todas ? "border-accent bg-accent/10 text-accent" : "border-border text-muted-foreground hover:text-foreground"
        }`}
        aria-pressed={!!silencio.todas}
      >
        {silencio.todas ? <BellOff className="h-3 w-3" /> : <Bell className="h-3 w-3" />}
        Todas {silencio.todas ? "silenciadas" : ""}
      </button>
      {silencio.todas && <span className="text-xs text-muted-foreground">Você não receberá novas notificações enquanto estiver silenciado.</span>}
    </div>
  );
}
