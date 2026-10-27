// Altura da Central de Suporte calculada pelo espaço real da tela: do topo da área até o
// fim da janela visível (visualViewport encolhe com o teclado do celular aberto),
// descontando o cabeçalho fixo do site quando a página precisar rolar.
import { useEffect, useState, type RefObject } from "react";

const MARGEM_INFERIOR = 16;
const ALTURA_MINIMA = 280; // abaixo disso (ex.: teclado aberto em tela baixa) a página rola em vez de espremer a conversa

export function useAlturaDisponivel(ref: RefObject<HTMLElement | null>): number | undefined {
  const [altura, setAltura] = useState<number>();

  useEffect(() => {
    const calcular = () => {
      const el = ref.current;
      if (!el) return;
      const janela = window.visualViewport?.height ?? window.innerHeight;
      const topoNaPagina = el.getBoundingClientRect().top + window.scrollY;
      const cabecalho = document.querySelector("header")?.getBoundingClientRect().height ?? 0;
      // A barra de atalhos fixa do celular cobre o fim da tela: o compositor não pode ficar atrás dela.
      const menuInferior = document.querySelector(".vt-menu-inferior")?.getBoundingClientRect().height ?? 0;
      // Cabe sem rolar a página? Usa o espaço até o fim da tela. Senão, ocupa a tela
      // abaixo do cabeçalho fixo (a página rola até a área ficar inteira visível).
      const semRolar = janela - topoNaPagina - menuInferior - MARGEM_INFERIOR;
      const abaixoDoCabecalho = janela - cabecalho - menuInferior - MARGEM_INFERIOR;
      setAltura(Math.round(Math.max(ALTURA_MINIMA, semRolar >= 480 ? semRolar : abaixoDoCabecalho)));
    };
    calcular();
    const vv = window.visualViewport;
    window.addEventListener("resize", calcular);
    vv?.addEventListener("resize", calcular);
    const obs = new ResizeObserver(calcular);
    if (ref.current?.parentElement) obs.observe(ref.current.parentElement);
    return () => {
      window.removeEventListener("resize", calcular);
      vv?.removeEventListener("resize", calcular);
      obs.disconnect();
    };
  }, [ref]);

  return altura;
}
