import { useAuth } from "@/contexts/AuthContext";
import { useVersaoBase } from "@/hooks/useVersaoBase";
import { carregarBase } from "@/services/db";
import { definirSilencio } from "@/api/conta.functions";
import { BellOff, Bell } from "lucide-react";
import { Toggle } from "@/components/ui/toggle";
import { tr } from "@/i18n/components/SilencioNotificacoes";

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
      <span className="text-muted-foreground">{tr("silenciar")}</span>
      <Toggle variant="chipAccent" pressed={!!silencio.comunidade} onPressedChange={(comunidade) => void definirSilencio({ comunidade })}>
        {silencio.comunidade ? <BellOff className="h-3 w-3" /> : <Bell className="h-3 w-3" />}{tr("comunidade")}{" "}{silencio.comunidade ? "silenciada" : ""}
      </Toggle>
      <Toggle variant="chipAccent" pressed={!!silencio.todas} onPressedChange={(todas) => void definirSilencio({ todas })}>
        {silencio.todas ? <BellOff className="h-3 w-3" /> : <Bell className="h-3 w-3" />}{tr("todas")}{" "}{silencio.todas ? "silenciadas" : ""}
      </Toggle>
      {silencio.todas && <span className="text-xs text-muted-foreground">{tr("voce_nao_recebera_novas_notificacoes_enq")}</span>}
    </div>
  );
}
