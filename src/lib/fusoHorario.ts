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

/** ISO → valor de `<input type="datetime-local">` ("AAAA-MM-DDTHH:MM") no fuso do evento. */
export function paraCampoNoFuso(iso: string, fuso: string | undefined): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "";
  return new Date(t + deslocamento(fusoValido(fuso), t) * 60000).toISOString().slice(0, 16);
}

/** Valor de `<input type="datetime-local">` digitado no fuso do evento → ISO. Inválido devolve "". */
export function deCampoNoFuso(valor: string, fuso: string | undefined): string {
  const [data = "", horario = ""] = valor.split("T");
  const d = instanteNoFuso(data, horario.slice(0, 5), fuso);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString();
}

/** Mantém a hora "de parede" ao trocar o fuso (08:00 continua 08:00 no novo fuso). */
export function trocarFuso(iso: string, de: string | undefined, para: string | undefined): string {
  return deCampoNoFuso(paraCampoNoFuso(iso, de), para) || iso;
}

/**
 * Período da operação para mensagens. Mesmo dia: "21/11/2026 Início às 08:00, fim às 10:00";
 * dias diferentes: "Início em 21/11/2026 às 08:00, fim em 22/11/2026 às 10:00".
 */
export function formatarPeriodoNoFuso(inicioIso: string, fimIso: string, fuso: string | undefined): string {
  const partes = (iso: string) => {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return null;
    const z = fusoValido(fuso);
    return {
      data: d.toLocaleDateString("pt-BR", { timeZone: z }),
      hora: d.toLocaleTimeString("pt-BR", { timeZone: z, hour: "2-digit", minute: "2-digit" }),
    };
  };
  const ini = partes(inicioIso);
  const fim = partes(fimIso);
  if (!ini || !fim) return "";
  if (ini.data === fim.data) return `${ini.data} Início às ${ini.hora}, fim às ${fim.hora}`;
  return `Início em ${ini.data} às ${ini.hora}, fim em ${fim.data} às ${fim.hora}`;
}
