// Idioma da página em qualquer lugar do código (componentes, regras, serviços, servidor).
// Servidor: decidido por pedido (?lang › cookie › navegador), igual ao loader da rota raiz.
// Navegador: o idioma que a rota raiz recebeu; trocar de idioma recarrega a página.
import { createIsomorphicFn } from "@tanstack/react-start";
import { getCookie, getRequest } from "@tanstack/react-start/server";
import { COOKIE_IDIOMA, escolherIdioma, type Idioma } from "@/lib/i18n";

let idiomaLocal: Idioma = "pt";

/** Navegador: chamado pela rota raiz antes de desenhar a página. Testes: fixa o idioma. */
export function definirIdiomaLocal(idioma: Idioma) {
  idiomaLocal = idioma;
}

const porPedido = new WeakMap<Request, Idioma>();

function idiomaDoPedido(): Idioma {
  let pedido: Request | undefined;
  try {
    pedido = getRequest();
  } catch {
    pedido = undefined;
  }
  // Fora de um pedido (testes, tarefas internas): idioma fixado ou português.
  if (!pedido) return idiomaLocal;
  let idioma = porPedido.get(pedido);
  if (!idioma) {
    const url = new URL(pedido.url);
    idioma = escolherIdioma({
      pedido: url.searchParams.get("lang") ?? undefined,
      cookie: getCookie(COOKIE_IDIOMA),
      acceptLanguage: pedido.headers.get("accept-language"),
      caminho: url.pathname,
    });
    porPedido.set(pedido, idioma);
  }
  return idioma;
}

export const idiomaAtual: () => Idioma = createIsomorphicFn()
  .server(idiomaDoPedido)
  .client(() => idiomaLocal);
