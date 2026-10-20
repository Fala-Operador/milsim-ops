// Dinheiro sempre em centavos; formatação em reais apenas na interface.

export function formatarBRL(centavos: number): string {
  return (centavos / 100).toLocaleString("pt-BR", {
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
  return new Date(iso).toLocaleDateString("pt-BR");
}

export function formatarDataHoraBR(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  });
}
