// Dinheiro sempre em centavos; formatação em reais apenas na interface, no idioma da página.
import { localeAtual } from "@/i18n/dicionario";

/** `locale` fixo ("pt-BR") para textos gravados no banco, que não seguem o idioma de quem lê. */
export function formatarBRL(centavos: number, locale = localeAtual()): string {
  return (centavos / 100).toLocaleString(locale, {
    style: "currency",
    currency: "BRL",
  });
}

export function paraCentavos(reais: number): number {
  return Math.round(reais * 100);
}

export function formatarDataBR(iso: string): string {
  // Data sem horário (AAAA-MM-DD): formata direto. new Date("2024-05-18") é meia-noite UTC,
  // que no Brasil ainda é o dia 17 — o cronograma e as operações registradas mostravam a véspera.
  const soData = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (soData) return `${soData[3]}/${soData[2]}/${soData[1]}`;
  return new Date(iso).toLocaleDateString(localeAtual());
}

export function formatarDataHoraBR(iso: string, locale = localeAtual()): string {
  return new Date(iso).toLocaleString(locale, {
    dateStyle: "short",
    timeStyle: "short",
  });
}
