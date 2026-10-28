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
import { Modal, SkeletonPagina, TextoLivre } from "@/components/ui";
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
      <Button size="lg" className="w-full text-[15px]">Garantir vaga</Button>
    </Link>
  );

  const ocupadas = evento.capacidadeTotal - restantes;
  const imagem = evento.imagem?.bannerUrl || evento.imagemUrl;
  return (
    <div>
      <section className="relative isolate overflow-hidden border-b border-border">
        {/* Mobile: imagem inteira, sem corte; o fundo desfocado preenche as sobras. */}
        {imagem && (
          <div className="relative overflow-hidden bg-background sm:hidden">
            <img src={imagem} alt="" aria-hidden="true" className="absolute inset-0 h-full w-full scale-110 object-cover opacity-50 blur-xl" />
            <img src={imagem} alt={evento.imagem?.alt ?? ""} className="relative mx-auto block h-auto max-h-[70vh] w-full object-contain" />
          </div>
        )}
        {imagem && <img src={imagem} alt={evento.imagem?.alt ?? ""} className="absolute inset-0 -z-10 hidden h-full w-full object-cover sm:block" />}
        <div className="absolute inset-0 -z-10 hidden bg-[linear-gradient(0deg,var(--background)_0%,color-mix(in_oklch,var(--background)_70%,transparent)_45%,color-mix(in_oklch,var(--background)_10%,transparent)_100%)] sm:block" aria-hidden="true" />
        <div className={`mx-auto flex max-w-6xl flex-col justify-end px-4 pb-8 pt-6 sm:min-h-[420px] ${imagem ? "" : "min-h-[340px]"}`}>
          <nav aria-label="Breadcrumb" className="mb-6 self-start sm:mb-auto rounded-sm bg-background/80 px-2 py-1 text-xs text-muted-foreground backdrop-blur">
            <Link to="/" className="hover:text-foreground">Eventos</Link> <span aria-hidden>›</span> <span>{evento.nome}</span>
          </nav>
          <p className="rotulo-tecnico text-accent">{nomeModalidade(evento.modalidade)} · {evento.cidade}/{evento.uf}</p>
          <h1 className="mt-2 max-w-3xl font-display text-4xl font-bold uppercase leading-[0.95] sm:text-6xl">{evento.nome}</h1>
          <p className="mt-3 text-[15px] text-muted-foreground">Organização: <span className="font-medium text-foreground">{organizacao?.nome}</span></p>
        </div>
      </section>

      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-10 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 space-y-10">
          <section>
            <h2 className="rotulo-tecnico">Briefing</h2>
            <TextoLivre texto={evento.enredo} className="mt-3 max-w-prose text-[17px] leading-relaxed" />
            <TextoLivre texto={evento.descricaoResumida} className="mt-3 max-w-prose text-muted-foreground" />
          </section>

          <section className="border-t border-border pt-8">
            <h2 className="rotulo-tecnico">Exércitos</h2>
            <div className="mt-4 grid gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-2">
              {evento.exercitos.map((ex, i) => (
                <div key={ex.id} className="bg-background p-4">
                  <p className="font-mono text-[11px] text-muted-foreground">{String.fromCharCode(65 + i)} · {ex.capacidade} vagas</p>
                  <p className="mt-1 font-display text-2xl font-bold uppercase">{ex.nome}</p>
                  <TextoLivre texto={ex.descricao} className="mt-1 text-sm text-muted-foreground" />
                </div>
              ))}
            </div>
          </section>

          <section className="border-t border-border pt-8">
            <h2 className="rotulo-tecnico">Cronograma</h2>
            <ol className="relative mt-4 space-y-6 border-l border-border pl-6">
              {evento.cronograma.slice().sort((a, b) => a.ordem - b.ordem).map((at) => (
                <li key={at.id} className="relative">
                  <span className="absolute -left-[29px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-accent bg-background" aria-hidden />
                  <p className="font-mono text-xs text-accent">{formatarDataBR(at.data)} · {at.horario}</p>
                  <p className="mt-0.5 font-semibold">{at.titulo}</p>
                  <TextoLivre texto={at.descricao} className="text-sm text-muted-foreground" />
                  {at.local && <p className="text-sm text-muted-foreground">Local: {at.local}.</p>}
                </li>
              ))}
            </ol>
          </section>

          {evento.regras && (
            <section className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-4">
              <div>
                <p className="font-semibold">{evento.regras.titulo}</p>
                <p className="text-sm text-muted-foreground">Versão {evento.regras.versao} · atualizado em {formatarDataBR(evento.regras.atualizadoEm)}</p>
              </div>
              <Button variant="outline" onClick={() => setRegrasAbertas(true)}>Ler o caderno de regras</Button>
            </section>
          )}
        </div>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="overflow-hidden rounded-lg border border-border bg-card">
            <div className="grid grid-cols-2 divide-x divide-border border-b border-border">
              <div className="p-4">
                <p className="rotulo-tecnico">Início</p>
                <p className="mt-1 font-display text-2xl font-bold">{formatarDataBR(evento.inicioEm).slice(0, 5)}</p>
                <p className="text-xs text-muted-foreground">{formatarDataHoraBR(evento.inicioEm).slice(-5)}</p>
              </div>
              <div className="p-4">
                <p className="rotulo-tecnico">Fim</p>
                <p className="mt-1 font-display text-2xl font-bold">{formatarDataBR(evento.fimEm).slice(0, 5)}</p>
                <p className="text-xs text-muted-foreground">{formatarDataHoraBR(evento.fimEm).slice(-5)}</p>
              </div>
            </div>
            <div className="border-b border-border p-4 text-sm">
              <p className="font-medium">{evento.local}</p>
              <p className="text-muted-foreground">{evento.endereco}, {evento.cidade}/{evento.uf}</p>
            </div>
            <ul className="divide-y divide-border border-b border-border">
              {evento.tipos.map((t) => {
                const lote = loteVigente(evento, t.id);
                const preco = lote?.itens.find((i) => i.tipoId === t.id)?.precoCentavos ?? t.precoBaseCentavos;
                return (
                  <li key={t.id} className="p-4">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="font-semibold">{t.nome}</span>
                      <Preco centavos={preco} className="shrink-0 font-semibold" />
                    </div>
                    {t.beneficios && <p className="mt-0.5 text-xs text-muted-foreground">{t.beneficios}</p>}
                    {lote && <p className="mt-1 font-mono text-[11px] uppercase text-accent">{lote.nome}</p>}
                  </li>
                );
              })}
            </ul>
            <div className="p-4">
              {inscricoesAbertas ? (
                <>
                  <div className="flex justify-between text-xs text-muted-foreground"><span>{ocupadas} inscritos</span><span>{restantes} vagas livres</span></div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-secondary"><div className="h-full bg-primary" style={{ width: `${Math.max(3, (ocupadas / evento.capacidadeTotal) * 100)}%` }} /></div>
                  <div className="mt-4 hidden md:block">{linkInscricao}</div>
                </>
              ) : (
                <Badge variant="destructive">{evento.status === "cancelado" ? "Evento cancelado" : restantes <= 0 ? "Esgotado" : "Inscrições encerradas"}</Badge>
              )}
              <Link to="/app/suporte" search={{ evento: evento.id }} className="mt-3 block text-center text-sm text-muted-foreground hover:text-foreground">Dúvidas? Fale com a organização</Link>
              {evento.status !== "cancelado" && <ContatoWhatsapp evento={evento} className="mt-3 justify-center" />}
            </div>
          </div>
        </aside>
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
        <div className="sticky bottom-[var(--menu-inferior,0px)] z-30 mt-8 border-t border-border bg-background/95 px-4 pt-3 pb-[var(--folga-inferior,max(0.75rem,env(safe-area-inset-bottom)))] backdrop-blur md:hidden">
          <div className="mx-auto flex max-w-6xl items-center gap-3">
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
