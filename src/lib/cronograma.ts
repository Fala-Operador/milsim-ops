// Horários do cronograma: data + horário de cada atividade são "hora de parede" no fuso do
// evento. Convertê-los com new Date("AAAA-MM-DDTHH:MM") usa o fuso de quem executa — no
// servidor (UTC) isso desloca as atividades 3h e faz a publicação recusá-las.

const FUSO_PADRAO = "America/Sao_Paulo";

/** Diferença (ms) entre a hora local no fuso e o UTC no instante `ms`. */
function deslocamento(ms: number, fuso: string): number {
  let fmt: Intl.DateTimeFormat;
  try {
    fmt = new Intl.DateTimeFormat("en-US", {
      timeZone: fuso || FUSO_PADRAO, hourCycle: "h23",
      year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit",
    });
  } catch {
    if (fuso === FUSO_PADRAO) return -3 * 3600_000;
    return deslocamento(ms, FUSO_PADRAO);
  }
  const p: Partial<Record<Intl.DateTimeFormatPartTypes, number>> = {};
  for (const x of fmt.formatToParts(new Date(ms))) p[x.type] = Number(x.value);
  return Date.UTC(p.year!, p.month! - 1, p.day!, p.hour!, p.minute!, p.second!) - ms;
}

/** Instante real de uma atividade (data AAAA-MM-DD + horário HH:MM no fuso do evento). */
export function instanteAtividade(data: string, horario: string, fuso = FUSO_PADRAO): Date {
  const d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(data ?? "");
  const h = /^(\d{2}):(\d{2})/.exec(horario || "00:00");
  if (!d || !h) return new Date(NaN);
  const parede = Date.UTC(+d[1]!, +d[2]! - 1, +d[3]!, +h[1]!, +h[2]!);
  let ms = parede - deslocamento(parede, fuso);
  ms = parede - deslocamento(ms, fuso); // segunda passada cobre mudança de horário de verão
  return new Date(ms);
}

/** Data e hora no fuso do evento, ex.: "21/11/2026 08:00". */
export function formatarNoFuso(iso: string, fuso = FUSO_PADRAO): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const op: Intl.DateTimeFormatOptions = { dateStyle: "short", timeStyle: "short" };
  try {
    return d.toLocaleString("pt-BR", { ...op, timeZone: fuso || FUSO_PADRAO });
  } catch {
    return d.toLocaleString("pt-BR", { ...op, timeZone: FUSO_PADRAO });
  }
}
