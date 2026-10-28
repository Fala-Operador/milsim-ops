import { createFileRoute } from "@tanstack/react-router";
import { DOCUMENTOS_LEGAIS_ATUALIZADOS_EM, VERSAO_TERMOS } from "@/data/termos";
import { cabecalhoDocumento, DocumentoDoBanco } from "@/components/DocumentoLegal";
import { obterTextosFn } from "@/api/textos.functions";
import { useTradutor } from "@/contexts/IdiomaContext";
import { langDaBusca } from "@/lib/i18n";

// O texto de cada cláusula fica em public.site_texts (termos.c.<id>.titulo/.texto, em pt e en);
// aqui fica só a ordem. Mudou uma regra de negócio que aparece aqui (cancelamento, taxas, idade)?
// Atualize a cláusula nos dois idiomas (nova migration), a data e, se a mudança for relevante,
// a versão em src/data/termos.ts.
const CLAUSULAS = ["aceite", "plataforma", "conta", "inscricao", "pagamento", "cancelamento", "evento", "organizacoes", "comunidade", "recompensas", "suspensao", "propriedade", "responsabilidade", "privacidade", "alteracoes", "lei", "contato"] as const;

export const Route = createFileRoute("/termos")({
  loaderDeps: ({ search }) => ({ lang: langDaBusca(search) }),
  loader: ({ deps, location }) => obterTextosFn({ data: { lang: deps.lang, caminho: location.pathname, prefixos: ["legal", "termos"] } }),
  head: ({ loaderData }) => cabecalhoDocumento("termos", "/termos", loaderData?.textos),
  component: Termos,
});

function Termos() {
  const t = useTradutor(Route.useLoaderData().textos);
  return <DocumentoDoBanco doc="termos" ids={CLAUSULAS} t={t} vars={{ versao: VERSAO_TERMOS, data: DOCUMENTOS_LEGAIS_ATUALIZADOS_EM }} />;
}
