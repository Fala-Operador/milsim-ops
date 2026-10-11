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
  return new Date(iso).toLocaleDateString("pt-BR");
}

export function formatarDataHoraBR(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  });
}
