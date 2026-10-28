// Apresentação estática da plataforma na página inicial. Não depende de dados nem de login:
// sai no HTML do servidor, para visitantes e para a verificação do login com o Google.
// Textos em public.site_texts (inicio.chamada.*, sobre.*), no idioma escolhido.
import { CalendarCheck, QrCode, ShieldCheck, Ticket } from "lucide-react";
import { TextoEmLinha } from "@/components/TextoRico";
import { useIdioma } from "@/contexts/IdiomaContext";

const RECURSOS = [
  { icone: CalendarCheck, chave: "sobre.recurso1" },
  { icone: Ticket, chave: "sobre.recurso2" },
  { icone: QrCode, chave: "sobre.recurso3" },
  { icone: ShieldCheck, chave: "sobre.recurso4" },
];

/** Título e finalidade do topo da página inicial; também sai no HTML do servidor antes da carga. */
export function ChamadaPlataforma() {
  const { t } = useIdioma();
  return (
    <>
      <p className="rotulo-tecnico">{t("inicio.chamada.rotulo")}</p>
      <h1 className="mt-2 max-w-2xl font-display text-4xl font-bold uppercase leading-[0.95] text-foreground sm:text-6xl">
        {t("inicio.chamada.titulo")}
      </h1>
      <p className="mt-3 max-w-xl text-base text-muted-foreground [&_a]:text-accent [&_a]:underline-offset-2 [&_a:hover]:underline">
        <TextoEmLinha texto={t("inicio.chamada.texto")} />
      </p>
    </>
  );
}

export function SobrePlataforma() {
  const { t } = useIdioma();
  return (
    <section id="sobre" aria-labelledby="t-sobre" className="border-t border-border">
      <div className="mx-auto max-w-6xl px-4 py-10">
        <p className="rotulo-tecnico">{t("sobre.rotulo")}</p>
        <h2 id="t-sobre" className="mt-1 font-display text-2xl font-semibold uppercase tracking-wide">{t("sobre.titulo")}</h2>
        <p className="mt-2 max-w-3xl text-muted-foreground">{t("sobre.texto")}</p>
        <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {RECURSOS.map(({ icone: Icone, chave }) => (
            <li key={chave} className="rounded-lg border border-border p-4">
              <Icone className="h-5 w-5 text-accent" aria-hidden />
              <h3 className="mt-2 font-semibold">{t(`${chave}.titulo`)}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{t(`${chave}.texto`)}</p>
            </li>
          ))}
        </ul>
        <p className="mt-6 max-w-3xl text-sm text-muted-foreground [&_a]:text-accent [&_a]:underline [&_a]:underline-offset-2">
          <TextoEmLinha texto={t("sobre.google")} />
        </p>
      </div>
    </section>
  );
}
