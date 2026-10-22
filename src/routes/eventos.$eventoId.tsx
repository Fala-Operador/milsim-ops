import { nomeModalidade } from "@/lib/modalidades";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { carregarBase } from "@/services/db";
import { obterEventoFn } from "@/api/sessao.functions";
import { dataUrlParaBlobUrl } from "@/lib/imagens";
import { useEventoAtual } from "@/hooks/useEventoAtual";
import { registrarCliqueInscrever, registrarVisita } from "@/services/analytics";
import { vagasRestantes, loteVigente } from "@/services/inscricoes";
import { formatarDataBR, formatarDataHoraBR } from "@/lib/domain/money";
import { Preco } from "@/components/Preco";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Modal, SkeletonPagina } from "@/components/ui";
import { ContatoWhatsapp } from "@/components/ContatoWhatsapp";

export const Route = createFileRoute("/eventos/$eventoId")({
  loader: async ({ params }) => {
    const { evento, organizacao } = await obterEventoFn({ data: { eventoId: params.eventoId } });
    if (!evento || !["publicado", "inscricoes_encerradas", "concluido", "cancelado"].includes(evento.status)) {
      throw notFound();
    }
    return { evento, organizacao: organizacao ?? undefined };
  },
  head: ({ loaderData }) => ({
    meta: loaderData
      ? [
          { title: `${loaderData.evento.nome} — MilSim Ops` },
          { name: "description", content: loaderData.evento.descricaoResumida },
          { property: "og:title", content: `${loaderData.evento.nome} — MilSim Ops` },
          { property: "og:description", content: loaderData.evento.descricaoResumida },
          { property: "og:type", content: "website" },
          { name: "twitter:card", content: "summary_large_image" },
          ...(/^https:\/\//.test(loaderData.evento.imagem?.bannerUrl || loaderData.evento.imagemUrl || "") ? [
            { property: "og:image", content: loaderData.evento.imagem?.bannerUrl || loaderData.evento.imagemUrl },
            { name: "twitter:image", content: loaderData.evento.imagem?.bannerUrl || loaderData.evento.imagemUrl },
          ] : []),
        ]
      : [
          { title: "Evento — MilSim Ops" },
          { name: "description", content: "Operações de airsoft e simulação militar no MilSim Ops." },
          { property: "og:title", content: "Evento — MilSim Ops" },
          { property: "og:description", content: "Operações de airsoft e simulação militar no MilSim Ops." },
          { property: "og:type", content: "website" },
          { name: "twitter:card", content: "summary" },
        ],
  }),
  pendingComponent: SkeletonPagina,
  component: PaginaEvento,
  notFoundComponent: () => (
    <div className="mx-auto max-w-xl px-4 py-16 text-center">
      <h1 className="font-display text-2xl font-semibold">Evento não encontrado</h1>
      <p className="mt-2 text-muted-foreground">Este evento não existe ou não está público.</p>
    </div>
  ),
});

function PaginaEvento() {
  const { evento: eventoCarregado, organizacao } = Route.useLoaderData();
  const evento = useEventoAtual(eventoCarregado);
  const base = carregarBase();
  const restantes = vagasRestantes(base, evento);
  const [regrasAbertas, setRegrasAbertas] = useState(false);
  useEffect(() => registrarVisita(evento.id, new URLSearchParams(window.location.search).get("cmp")), [evento.id]);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!regrasAbertas || !evento.regras?.pdfDataUrl) return;
    const url = dataUrlParaBlobUrl(evento.regras.pdfDataUrl);
    setPdfUrl(url);
    return () => {
      URL.revokeObjectURL(url);
      setPdfUrl(null);
    };
  }, [regrasAbertas, evento.regras?.pdfDataUrl]);
  const inscricoesAbertas = evento.status === "publicado" && restantes > 0;
  const precos = evento.tipos.flatMap((t) => {
    const item = !t.arquivado ? loteVigente(evento, t.id)?.itens.find((i) => i.tipoId === t.id) : undefined;
    return item ? [item.precoCentavos] : [];
  });
  const aPartirDe = precos.length ? Math.min(...precos) : null;
  const linkInscricao = (
    <Link to="/inscricao/$eventoId" params={{ eventoId: evento.id }} search={{ cortesia: undefined, voucher: undefined }} onClick={() => registrarCliqueInscrever(evento.id)} className="block">
      <Button className="w-full">Inscrever-se</Button>
    </Link>
  );

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <nav aria-label="Breadcrumb" className="text-xs text-muted-foreground">
        <Link to="/" className="hover:underline">Eventos</Link> / <span>{evento.nome}</span>
      </nav>

      <div className="topo-bg relative mt-3 flex aspect-[21/9] max-h-72 w-full items-end overflow-hidden rounded-lg border border-border bg-secondary p-4">
        {(evento.imagem?.bannerUrl || evento.imagemUrl) && (
          <img src={evento.imagem?.bannerUrl || evento.imagemUrl} alt={evento.imagem?.alt ?? ""} className="absolute inset-0 h-full w-full object-cover" />
        )}
        <span className="relative rounded bg-background/70 px-2 py-0.5 font-mono text-xs uppercase tracking-widest text-muted-foreground">
          {evento.cidade}/{evento.uf} · {evento.fuso}
        </span>
      </div>

      <div className="mt-5 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <span className="inline-block rounded border border-border px-2 py-0.5 font-mono text-[11px] uppercase tracking-wider text-muted-foreground">{nomeModalidade(evento.modalidade)}</span>
          <h1 className="font-display text-2xl font-bold uppercase tracking-wide sm:text-3xl">{evento.nome}</h1>
          <p className="mt-1 text-muted-foreground">
            {organizacao?.nome} · {formatarDataHoraBR(evento.inicioEm)} a {formatarDataHoraBR(evento.fimEm)}
          </p>
          <p className="text-muted-foreground">{evento.local} — {evento.endereco}, {evento.cidade}/{evento.uf}</p>
        </div>
        <div className="md:shrink-0 md:text-right">
          {inscricoesAbertas ? (
            <>
              <Badge variant={restantes <= evento.capacidadeTotal * 0.15 ? "warning" : "success"}>
                {restantes} vagas restantes
              </Badge>
              <div className="mt-2 hidden md:block">{linkInscricao}</div>
              <Link to="/app/suporte" search={{ evento: evento.id }} className="mt-2 block text-sm text-accent hover:underline">Dúvidas? Falar com o suporte do evento</Link>
            </>
          ) : (
            <Badge variant="destructive">
              {evento.status === "cancelado" ? "Evento cancelado" : restantes <= 0 ? "Esgotado" : "Inscrições encerradas"}
            </Badge>
          )}
          {evento.status !== "cancelado" && <ContatoWhatsapp evento={evento} className="mt-3 md:justify-end" />}
        </div>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <h2 className="font-display text-lg font-semibold uppercase">Enredo</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{evento.enredo}</p>
            <p className="mt-2 text-sm text-muted-foreground">{evento.descricaoResumida}</p>
          </Card>

          <Card>
            <h2 className="font-display text-lg font-semibold uppercase">Exércitos</h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {evento.exercitos.map((ex) => (
                <div key={ex.id} className="rounded-md border border-border bg-elevated p-3">
                  <p className="font-medium">{ex.nome}</p>
                  {ex.descricao && <p className="text-sm text-muted-foreground">{ex.descricao}</p>}
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <h2 className="font-display text-lg font-semibold uppercase">Cronograma</h2>
            <ol className="mt-3 space-y-3">
              {evento.cronograma
                .slice()
                .sort((a, b) => a.ordem - b.ordem)
                .map((at) => (
                  <li key={at.id} className="flex flex-col gap-1 text-sm sm:flex-row sm:gap-3">
                    <span className="shrink-0 font-mono text-xs text-accent sm:w-28">
                      {formatarDataBR(at.data)} {at.horario}
                    </span>
                    <div className="min-w-0">
                      <p className="font-medium">{at.titulo}</p>
                      <p className="text-muted-foreground">{at.descricao}</p>
                      {at.local && <p className="text-xs text-muted-foreground">Local: {at.local}</p>}
                    </div>
                  </li>
                ))}
            </ol>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <h2 className="font-display text-lg font-semibold uppercase">Ingressos e lotes</h2>
            <ul className="mt-3 space-y-3 text-sm">
              {evento.tipos.map((t) => {
                const lote = loteVigente(evento, t.id);
                const preco = lote?.itens.find((i) => i.tipoId === t.id)?.precoCentavos ?? t.precoBaseCentavos;
                return (
                  <li key={t.id} className="rounded-md border border-border bg-elevated p-3">
                    <div className="flex items-start justify-between gap-3">
                      <span className="min-w-0 font-medium">{t.nome}</span>
                      <Preco centavos={preco} className="shrink-0 text-accent" />
                    </div>
                    {t.descricao && <p className="text-muted-foreground">{t.descricao}</p>}
                    {t.beneficios && <p className="text-xs text-muted-foreground">Inclui: {t.beneficios}</p>}
                    {lote && <p className="mt-1 text-xs text-muted-foreground">Lote vigente: {lote.nome}</p>}
                  </li>
                );
              })}
            </ul>
          </Card>

          {evento.regras && (
            <Card>
              <h2 className="font-display text-lg font-semibold uppercase">Caderno de regras</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {evento.regras.titulo} · v{evento.regras.versao} · atualizado em {formatarDataBR(evento.regras.atualizadoEm)}
              </p>
              <Button variant="outline" className="mt-3 w-full" onClick={() => setRegrasAbertas(true)}>
                Ler dentro da plataforma
              </Button>
            </Card>
          )}
        </div>
      </div>

      <Modal aberto={regrasAbertas} titulo={evento.regras?.titulo ?? "Regras"} onFechar={() => setRegrasAbertas(false)}>
        {evento.regras?.pdfDataUrl ? (
          pdfUrl ? (
            <iframe
              title={evento.regras.titulo}
              src={pdfUrl}
              className="h-[70vh] w-full rounded-md border border-border bg-background"
            />
          ) : (
            <p className="text-sm text-muted-foreground">Carregando PDF…</p>
          )
        ) : evento.regras?.conteudoHtml ? (
          <div
            className="prose-sm max-h-[60vh] overflow-y-auto text-sm leading-relaxed [&_h2]:mt-4 [&_h2]:font-display [&_h2]:text-base [&_h2]:font-semibold [&_p]:mt-1 [&_p]:text-muted-foreground"
            dangerouslySetInnerHTML={{ __html: evento.regras.conteudoHtml }}
          />
        ) : (
          <p className="text-sm text-muted-foreground">
            Este arquivo não pode ser exibido no leitor interno.{" "}
            {evento.regras?.arquivoUrl && <a className="underline" href={evento.regras.arquivoUrl} download={evento.regras.nomeArquivo}>Baixar {evento.regras.nomeArquivo ?? "arquivo"}</a>}
          </p>
        )}
      </Modal>

      {inscricoesAbertas && (
        <div className="sticky bottom-[var(--menu-inferior,0px)] z-30 -mx-4 mt-8 border-t border-border bg-background/95 px-4 pt-3 pb-[var(--folga-inferior,max(0.75rem,env(safe-area-inset-bottom)))] backdrop-blur md:hidden">
          <div className="mx-auto flex max-w-4xl items-center gap-3">
            <div className="min-w-0 flex-1 text-sm">
              {aPartirDe !== null && <p className="text-xs text-muted-foreground">A partir de</p>}
              <p className="truncate font-mono font-semibold text-accent">{aPartirDe !== null ? <Preco centavos={aPartirDe} /> : `${restantes} vagas`}</p>
            </div>
            <div className="w-40 shrink-0">{linkInscricao}</div>
          </div>
        </div>
      )}
    </div>
  );
}
