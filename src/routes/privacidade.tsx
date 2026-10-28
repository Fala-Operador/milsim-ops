import { createFileRoute } from "@tanstack/react-router";
import { cabecalhoDocumento, DocumentoDoBanco } from "@/components/DocumentoLegal";
import { obterTextosFn } from "@/api/textos.functions";
import { useTradutor } from "@/contexts/IdiomaContext";
import { langDaBusca } from "@/lib/i18n";
import { DOCUMENTOS_LEGAIS_ATUALIZADOS_EM } from "@/data/termos";

// O texto de cada cláusula fica em public.site_texts (privacidade.c.<id>.titulo/.texto, em pt e en);
// aqui fica só a ordem. Ao mudar o que a plataforma coleta ou com quem compartilha, atualize as
// cláusulas nos dois idiomas (nova migration) e a data em src/data/termos.ts.
// O conteúdo cobre o que a LGPD e a verificação do Google pedem; sem idioma no navegador, sai em inglês.
const CLAUSULAS = ["quem-somos", "escopo", "resumo", "dados-coletados", "google", "finalidade", "quem-ve", "emergencia", "compartilhamento", "transferencia", "cookies", "seguranca", "retencao", "menores", "direitos", "exclusao", "alteracoes", "contato"] as const;

export const Route = createFileRoute("/privacidade")({
  loaderDeps: ({ search }) => ({ lang: langDaBusca(search) }),
  loader: ({ deps, location }) => obterTextosFn({ data: { lang: deps.lang, caminho: location.pathname, prefixos: ["legal", "privacidade"] } }),
  head: ({ loaderData }) => cabecalhoDocumento("privacidade", "/privacidade", loaderData?.textos),
  component: Privacidade,
});

function Privacidade() {
  const t = useTradutor(Route.useLoaderData().textos);
  return <DocumentoDoBanco doc="privacidade" ids={CLAUSULAS} t={t} vars={{ data: DOCUMENTOS_LEGAIS_ATUALIZADOS_EM }} />;
}
