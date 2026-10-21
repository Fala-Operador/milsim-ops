// Data e horário "de parede" (como o organizador digita) num fuso IANA → instante absoluto.
// Não depende do fuso de quem executa: o servidor roda em UTC e o navegador em qualquer fuso,
// e os dois precisam chegar ao mesmo instante para validar o cronograma.
import type { AtividadeCronograma, Evento } from "@/lib/domain/types";

export const FUSO_PADRAO = "America/Sao_Paulo";

/** Diferença (em minutos) entre a hora local do fuso e UTC no instante `t`. */
function deslocamento(fuso: string, t: number): number {
  const partes = new Intl.DateTimeFormat("en-US", {
    timeZone: fuso,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(new Date(t));
  const v = (tipo: string) => Number(partes.find((p) => p.type === tipo)?.value);
  const comoUtc = Date.UTC(v("year"), v("month") - 1, v("day"), v("hour"), v("minute"));
  return Math.round((comoUtc - Math.floor(t / 60000) * 60000) / 60000);
}

function fusoValido(fuso: string | undefined): string {
  if (!fuso) return FUSO_PADRAO;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: fuso });
    return fuso;
  } catch {
    return FUSO_PADRAO;
  }
}

/** "AAAA-MM-DD" + "HH:MM" no fuso informado. Data inválida devolve `Invalid Date`. */
export function instanteNoFuso(data: string, horario: string, fuso: string | undefined): Date {
  const d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(data ?? "");
  const h = /^(\d{2}):(\d{2})$/.exec(horario || "00:00");
  if (!d || !h) return new Date(Number.NaN);
  const z = fusoValido(fuso);
  const parede = Date.UTC(Number(d[1]), Number(d[2]) - 1, Number(d[3]), Number(h[1]), Number(h[2]));
  // Duas passadas cobrem a troca de horário de verão entre o palpite e o instante final.
  let t = parede - deslocamento(z, parede) * 60000;
  const ajuste = deslocamento(z, t);
  t = parede - ajuste * 60000;
  return new Date(t);
}

/** Instante da atividade do cronograma, no fuso do evento. */
export function instanteDaAtividade(ev: Pick<Evento, "fuso">, a: Pick<AtividadeCronograma, "data" | "horario">): Date {
  return instanteNoFuso(a.data, a.horario, ev.fuso);
}

/** A atividade acontece entre o início e o término do evento (inclusive)? */
export function atividadeNoPeriodo(ev: Pick<Evento, "fuso" | "inicioEm" | "fimEm">, a: Pick<AtividadeCronograma, "data" | "horario">): boolean {
  const t = instanteDaAtividade(ev, a).getTime();
  return t >= new Date(ev.inicioEm).getTime() && t <= new Date(ev.fimEm).getTime();
}

/** Data e hora no fuso do evento, ex.: "21/11/2026 08:00". */
export function formatarNoFuso(iso: string, fuso: string | undefined): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: fusoValido(fuso) });
}
