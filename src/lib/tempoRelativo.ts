// "agora", "há 5 min", "há 3 h", "ontem", "há 4 dias"; depois de uma semana, a data (dd/mm/aaaa).
import { formatarDataBR } from "@/lib/domain/money";

const MIN = 60_000;
const HORA = 60 * MIN;
const DIA = 24 * HORA;

export function tempoRelativo(iso: string, agora: Date = new Date()): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "";
  const d = agora.getTime() - t;
  if (d < MIN) return "agora";
  if (d < HORA) return `há ${Math.floor(d / MIN)} min`;
  if (d < DIA) return `há ${Math.floor(d / HORA)} h`;
  const dias = Math.floor(d / DIA);
  if (dias === 1) return "ontem";
  if (dias < 7) return `há ${dias} dias`;
  return formatarDataBR(iso);
}
