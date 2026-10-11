import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useState } from "react";
import { carregarBase } from "@/services/db";
import { vagasRestantes, loteVigente } from "@/services/inscricoes";
import { formatarBRL, formatarDataBR, formatarDataHoraBR } from "@/lib/domain/money";
import { Badge, Botao, Cartao, Modal, SkeletonPagina } from "@/components/ui";

export const Route = createFileRoute("/eventos/$eventoId")({
  loader: ({ params }) => {
    const base = carregarBase();
    const evento = base.eventos.find((e) => e.id === params.eventoId);
    if (!evento || !["publicado", "inscricoes_encerradas", "concluido", "cancelado"].includes(evento.status)) {
      throw notFound();
    }
    return { evento, organizacao: base.organizacoes.find((o) => o.id === evento.organizacaoId) };
  },
  head: ({ loaderData }) => ({
    meta: loaderData
      ? [
          { title: `${loaderData.evento.nome} — MilSim Ops` },
          { name: "description", content: loaderData.evento.descricaoResumida },
          { property: "og:title", content: `${loaderData.evento.nome} — MilSim Ops` },
          { property: "og:description", content: loaderData.evento.descricaoResumida },
        ]
      : [{ title: "Evento — MilSim Ops" }],
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
  const { evento, organizacao } = Route.useLoaderData();
  const base = carregarBase();
  const restantes = vagasRestantes(base, evento);
  const [regrasAbertas, setRegrasAbertas] = useState(false);
  const inscricoesAbertas = evento.status === "publicado" && restantes > 0;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <nav aria-label="Breadcrumb" className="text-xs text-muted-foreground">
        <Link to="/" className="hover:underline">Eventos</Link> / <span>{evento.nome}</span>
      </nav>

      <div className="topo-bg mt-3 flex h-48 items-end rounded-lg border border-border bg-secondary p-4">
        <span className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
          {evento.cidade}/{evento.uf} · {evento.fuso}
        </span>
      </div>

      <div className="mt-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold uppercase tracking-wide">{evento.nome}</h1>
          <p className="mt-1 text-muted-foreground">
            {organizacao?.nome} · {formatarDataHoraBR(evento.inicioEm)} a {formatarDataHoraBR(evento.fimEm)}
          </p>
          <p className="text-muted-foreground">{evento.local} — {evento.endereco}, {evento.cidade}/{evento.uf}</p>
        </div>
        <div className="text-right">
          {inscricoesAbertas ? (
            <>
              <Badge tom={restantes <= evento.capacidadeTotal * 0.15 ? "aviso" : "sucesso"}>
                {restantes} vagas restantes
              </Badge>
              <div className="mt-2">
                <Link to="/inscricao/$eventoId" params={{ eventoId: evento.id }} search={{ cortesia: undefined }}>
                  <Botao>Inscrever-se</Botao>
                </Link>
              </div>
            </>
          ) : (
            <Badge tom="perigo">
              {evento.status === "cancelado" ? "Evento cancelado" : restantes <= 0 ? "Esgotado" : "Inscrições encerradas"}
            </Badge>
          )}
        </div>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Cartao>
            <h2 className="font-display text-lg font-semibold uppercase">Enredo</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{evento.enredo}</p>
            <p className="mt-2 text-sm text-muted-foreground">{evento.descricaoResumida}</p>
          </Cartao>

          <Cartao>
            <h2 className="font-display text-lg font-semibold uppercase">Exércitos</h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {evento.exercitos.map((ex) => (
                <div key={ex.id} className="rounded-md border border-border bg-elevated p-3">
                  <p className="font-medium">{ex.nome}</p>
                  {ex.descricao && <p className="text-sm text-muted-foreground">{ex.descricao}</p>}
                </div>
              ))}
            </div>
          </Cartao>

          <Cartao>
            <h2 className="font-display text-lg font-semibold uppercase">Cronograma</h2>
            <ol className="mt-3 space-y-3">
              {evento.cronograma
                .slice()
                .sort((a, b) => a.ordem - b.ordem)
                .map((at) => (
                  <li key={at.id} className="flex gap-3 text-sm">
                    <span className="w-28 shrink-0 font-mono text-xs text-accent">
                      {formatarDataBR(at.data)} {at.horario}
                    </span>
                    <div>
                      <p className="font-medium">{at.titulo}</p>
                      <p className="text-muted-foreground">{at.descricao}</p>
                      {at.local && <p className="text-xs text-muted-foreground">Local: {at.local}</p>}
                    </div>
                  </li>
                ))}
            </ol>
          </Cartao>
        </div>

        <div className="space-y-6">
          <Cartao>
            <h2 className="font-display text-lg font-semibold uppercase">Ingressos e lotes</h2>
            <ul className="mt-3 space-y-3 text-sm">
              {evento.tipos.map((t) => {
                const lote = loteVigente(evento, t.id);
                const preco = lote?.itens.find((i) => i.tipoId === t.id)?.precoCentavos ?? t.precoBaseCentavos;
                return (
                  <li key={t.id} className="rounded-md border border-border bg-elevated p-3">
                    <div className="flex justify-between">
                      <span className="font-medium">{t.nome}</span>
                      <span className="text-accent">{formatarBRL(preco)}</span>
                    </div>
                    {t.descricao && <p className="text-muted-foreground">{t.descricao}</p>}
                    {t.beneficios && <p className="text-xs text-muted-foreground">Inclui: {t.beneficios}</p>}
                    {lote && <p className="mt-1 text-xs text-muted-foreground">Lote vigente: {lote.nome}</p>}
                  </li>
                );
              })}
            </ul>
          </Cartao>

          {evento.regras && (
            <Cartao>
              <h2 className="font-display text-lg font-semibold uppercase">Caderno de regras</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {evento.regras.titulo} · v{evento.regras.versao} · atualizado em {formatarDataBR(evento.regras.atualizadoEm)}
              </p>
              <Botao variante="contorno" className="mt-3 w-full" onClick={() => setRegrasAbertas(true)}>
                Ler dentro da plataforma
              </Botao>
            </Cartao>
          )}
        </div>
      </div>

      <Modal aberto={regrasAbertas} titulo={evento.regras?.titulo ?? "Regras"} onFechar={() => setRegrasAbertas(false)}>
        {evento.regras?.conteudoHtml ? (
          <div
            className="prose-sm max-h-[60vh] overflow-y-auto text-sm leading-relaxed [&_h2]:mt-4 [&_h2]:font-display [&_h2]:text-base [&_h2]:font-semibold [&_p]:mt-1 [&_p]:text-muted-foreground"
            dangerouslySetInnerHTML={{ __html: evento.regras.conteudoHtml }}
          />
        ) : (
          <p className="text-sm text-muted-foreground">
            Este arquivo não pôde ser renderizado no leitor interno. Ofereça download na versão de produção.
          </p>
        )}
      </Modal>
    </div>
  );
}
