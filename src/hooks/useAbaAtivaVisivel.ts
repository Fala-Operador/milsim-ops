import { useEffect, type RefObject } from "react";

/**
 * Abas em rolagem horizontal (celular): mantém a aba ativa (`aria-current="page"`)
 * visível sempre que o endereço muda, sem mexer na rolagem vertical da página.
 */
export function useAbaAtivaVisivel(ref: RefObject<HTMLElement | null>, chave: string): void {
  useEffect(() => {
    const nav = ref.current;
    const ativa = nav?.querySelector<HTMLElement>('[aria-current="page"], [data-status="active"]');
    if (!nav || !ativa || nav.scrollWidth <= nav.clientWidth) return;
    const alvo = ativa.offsetLeft - (nav.clientWidth - ativa.offsetWidth) / 2;
    nav.scrollTo({ left: Math.max(0, alvo) });
  }, [ref, chave]);
}
