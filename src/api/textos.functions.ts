// API dos textos fixos do site: idioma escolhido + textos das seções que a página usa.
import { createServerFn } from "@tanstack/react-start";
import { getCookie, getRequestHeader, setCookie } from "@tanstack/react-start/server";
import { z } from "zod";
import { COOKIE_IDIOMA, ehIdioma, escolherIdioma, filtrarPorPrefixo, type Idioma, type Textos } from "@/lib/i18n";
import { textosDoIdioma } from "@/server/textos.server";

const UM_ANO = 60 * 60 * 24 * 365;

function guardarIdioma(idioma: Idioma) {
  setCookie(COOKIE_IDIOMA, idioma, { path: "/", maxAge: UM_ANO, sameSite: "lax", httpOnly: true });
}

export const obterTextosFn = createServerFn({ method: "GET" })
  .validator(z.object({
    lang: z.string().max(10).optional(),
    caminho: z.string().max(300),
    prefixos: z.array(z.string().regex(/^[a-z0-9_.-]+$/).max(40)).min(1).max(20),
  }).parse)
  .handler(async ({ data }): Promise<{ idioma: Idioma; textos: Textos }> => {
    const idioma = escolherIdioma({
      pedido: data.lang,
      cookie: getCookie(COOKIE_IDIOMA),
      acceptLanguage: getRequestHeader("accept-language"),
      caminho: data.caminho,
    });
    // ?lang= válido vira a escolha da pessoa nas próximas páginas.
    if (ehIdioma(data.lang) && getCookie(COOKIE_IDIOMA) !== data.lang) guardarIdioma(data.lang);
    return { idioma, textos: filtrarPorPrefixo(await textosDoIdioma(idioma), data.prefixos) };
  });

export const definirIdiomaFn = createServerFn({ method: "POST" })
  .validator(z.object({ idioma: z.enum(["pt", "en"]) }).parse)
  .handler(({ data }) => {
    guardarIdioma(data.idioma);
    return { ok: true as const };
  });
