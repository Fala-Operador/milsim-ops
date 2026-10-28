// Moldura dos documentos legais (termos, privacidade): índice fixo à esquerda e cláusulas numeradas.
// Os textos (títulos, cláusulas, rótulos) vêm de public.site_texts no idioma escolhido.
import type { ReactNode } from "react";
import { CONTROLADOR } from "@/data/termos";
import { criarTradutor, IDIOMAS, LANG_HTML, type Textos, type Traduzir } from "@/lib/i18n";
import { TextoEmLinha, TextoRico } from "@/components/TextoRico";

export interface Clausula { id: string; titulo: string; texto: ReactNode }

/**
 * Link de e-mail que o Cloudflare não troca por "[email protected]": a ofuscação dele só
 * vale com JavaScript, e a verificação do Google lê o HTML puro.
 */
function EmailVisivel({ email }: { email: string }) {
  return <span dangerouslySetInnerHTML={{ __html: `<!--email_off--><a href="mailto:${email}">${email}</a><!--/email_off-->` }} />;
}

/** Identificação do controlador e canais de contato; campos vazios em CONTROLADOR não aparecem. */
export function ContatoControlador({ t }: { t: Traduzir }) {
  const { nome, cnpj, emailPrivacidade, encarregado } = CONTROLADOR;
  return (
    <ul>
      <li><strong>{t("legal.contato.controladora")}:</strong> {nome}{cnpj && `, CNPJ ${cnpj}`}.</li>
      {encarregado && <li><strong>{t("legal.contato.encarregado")}:</strong> {encarregado}.</li>}
      {emailPrivacidade && <li><strong>{t("legal.contato.email")}:</strong> <EmailVisivel email={emailPrivacidade} /></li>}
      <li><strong>{t("legal.contato.plataforma")}:</strong> <TextoEmLinha texto={t("legal.contato.links")} /></li>
    </ul>
  );
}

const SITE = "https://milsimops.falaoperador.com.br";

/** Título, descrição e versões em cada idioma (hreflang: ?lang=pt / ?lang=en) de um documento legal. */
export function cabecalhoDocumento(doc: string, caminho: string, textos: Textos | undefined) {
  const t = criarTradutor(textos ?? {});
  return {
    meta: [
      { title: t(`${doc}.meta.titulo`) },
      { name: "description", content: t(`${doc}.meta.descricao`) },
      { property: "og:title", content: t(`${doc}.meta.titulo`) },
      { property: "og:description", content: t(`${doc}.meta.og_descricao`) },
    ],
    links: [
      ...IDIOMAS.map((i) => ({ rel: "alternate", hrefLang: LANG_HTML[i], href: `${SITE}${caminho}?lang=${i}` })),
      { rel: "alternate", hrefLang: "x-default", href: `${SITE}${caminho}` },
    ],
  };
}

/**
 * Documento legal guardado no banco: `doc` é o prefixo das chaves ("privacidade", "termos") e
 * `ids` a ordem das cláusulas ({doc}.c.{id}.titulo / .texto). [[contato]] vira ContatoControlador.
 */
export function DocumentoDoBanco({ doc, ids, t, vars }: { doc: string; ids: readonly string[]; t: Traduzir; vars?: Record<string, string> }) {
  const especiais = { contato: <ContatoControlador t={t} /> };
  const clausulas = ids.map((id) => ({
    id,
    titulo: t(`${doc}.c.${id}.titulo`),
    texto: <TextoRico texto={t(`${doc}.c.${id}.texto`)} especiais={especiais} />,
  }));
  return <DocumentoLegal t={t} rotulo={t(`${doc}.rotulo`, vars)} titulo={t(`${doc}.titulo`)} subtitulo={t(`${doc}.subtitulo`)} clausulas={clausulas} />;
}

export function DocumentoLegal({ t, rotulo, titulo, subtitulo, clausulas }: { t: Traduzir; rotulo: string; titulo: string; subtitulo: string; clausulas: Clausula[] }) {
  return (
    <div className="mx-auto max-w-5xl px-4 py-10 lg:py-14">
      <header className="border-b border-border pb-6">
        <p className="rotulo-tecnico">{rotulo}</p>
        <h1 className="titulo-pagina mt-2">{titulo}</h1>
        <p className="subtitulo-pagina">{subtitulo}</p>
      </header>
      <div className="mt-8 grid gap-10 lg:grid-cols-[220px_minmax(0,1fr)]">
        <nav aria-label={t("legal.clausulas_aria")} className="lg:sticky lg:top-24 lg:self-start">
          <p className="rotulo-tecnico mb-2">{t("legal.neste_documento")}</p>
          <ol className="space-y-1 text-sm">
            {clausulas.map((c, i) => (
              <li key={c.id}>
                <a href={`#${c.id}`} className="flex gap-2 rounded-md px-2 py-1 text-muted-foreground hover:bg-secondary hover:text-foreground">
                  <span className="font-mono text-xs leading-5 text-accent">{String(i + 1).padStart(2, "0")}</span>{c.titulo}
                </a>
              </li>
            ))}
          </ol>
        </nav>
        <article className="max-w-[65ch] divide-y divide-border">
          {clausulas.map((c, i) => (
            <section key={c.id} id={c.id} aria-labelledby={`t-${c.id}`} className="scroll-mt-24 py-6 first:pt-0">
              <h2 id={`t-${c.id}`} className="flex items-baseline gap-3 text-lg font-semibold">
                <span className="font-display text-2xl font-bold text-accent">{String(i + 1).padStart(2, "0")}</span>{c.titulo}
              </h2>
              <div className="mt-2 space-y-2 leading-relaxed text-foreground/90 [&_a]:text-accent [&_a]:underline [&_a]:underline-offset-2 [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5">{c.texto}</div>
            </section>
          ))}
        </article>
      </div>
    </div>
  );
}
