import { useAuth } from "@/contexts/AuthContext";
import { useVersaoBase } from "@/hooks/useVersaoBase";
import { carregarBase } from "@/services/db";
import { definirSilencio } from "@/api/conta.functions";
import { BellOff, Bell } from "lucide-react";
import { Toggle } from "@/components/ui/toggle";

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
      <Toggle variant="chipAccent" pressed={!!silencio.comunidade} onPressedChange={(comunidade) => void definirSilencio({ comunidade })}>
        {silencio.comunidade ? <BellOff className="h-3 w-3" /> : <Bell className="h-3 w-3" />}
        Comunidade {silencio.comunidade ? "silenciada" : ""}
      </Toggle>
      <Toggle variant="chipAccent" pressed={!!silencio.todas} onPressedChange={(todas) => void definirSilencio({ todas })}>
        {silencio.todas ? <BellOff className="h-3 w-3" /> : <Bell className="h-3 w-3" />}
        Todas {silencio.todas ? "silenciadas" : ""}
      </Toggle>
      {silencio.todas && <span className="text-xs text-muted-foreground">Você não receberá novas notificações enquanto estiver silenciado.</span>}
    </div>
  );
}
