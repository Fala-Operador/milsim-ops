// "agora", "há 5 min", "há 3 h", "ontem", "há 4 dias"; depois de uma semana, a data (dd/mm/aaaa).
import { formatarDataBR } from "@/lib/domain/money";
import { tr } from "@/i18n/lib/tempoRelativo";

const MIN = 60_000;
const HORA = 60 * MIN;
const DIA = 24 * HORA;

export function tempoRelativo(iso: string, agora: Date = new Date()): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "";
  const d = agora.getTime() - t;
  if (d < MIN) return "agora";
  if (d < HORA) return tr("ha_valor_min", { valor: Math.floor(d / MIN) });
  if (d < DIA) return tr("ha_valor_h", { valor: Math.floor(d / HORA) });
  const dias = Math.floor(d / DIA);
  if (dias === 1) return "ontem";
  if (dias < 7) return tr("ha_dias_dias", { dias });
  return formatarDataBR(iso);
}
