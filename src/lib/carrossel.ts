/** Páginas alinhadas aos cards, incluindo o limite final da rolagem nativa. */
export function paginasCarrossel(cards: { left: number; width: number }[], largura: number, larguraTotal: number): number[] {
  const fim = Math.max(0, larguraTotal - largura);
  if (largura <= 0 || fim <= 1 || !cards.length) return [0];
  const paginas = [0];
  let indice = 0;
  while (indice < cards.length) {
    const inicio = cards[indice]?.left ?? 0;
    let proximo = indice + 1;
    while (proximo < cards.length && (cards[proximo]?.left ?? 0) + (cards[proximo]?.width ?? 0) <= inicio + largura + 1) proximo++;
    const alvo = Math.min(cards[proximo]?.left ?? fim, fim);
    const ultimo = paginas[paginas.length - 1] ?? 0;
    if (alvo > ultimo + 1) paginas.push(alvo);
    if (alvo >= fim) break;
    indice = proximo;
  }
  return paginas;
}

export function paginaMaisProxima(paginas: number[], posicao: number): number {
  return paginas.reduce((melhor, alvo, indice) =>
    Math.abs(alvo - posicao) < Math.abs((paginas[melhor] ?? 0) - posicao) ? indice : melhor, 0);
}