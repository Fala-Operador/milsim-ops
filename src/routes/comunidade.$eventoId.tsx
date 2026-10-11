import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { carregarBase, mutarBase, gerarId } from "@/services/db";
import { useAuth } from "@/contexts/AuthContext";
import { formatarDataBR, formatarDataHoraBR } from "@/lib/domain/money";
import { AreaTexto, Badge, Botao, Cartao } from "@/components/ui";

export const Route = createFileRoute("/comunidade/$eventoId")({
  loader: ({ params }) => {
    const base = carregarBase();
    const evento = base.eventos.find((e) => e.id === params.eventoId);
    if (!evento) throw notFound();
    return { evento };
  },
  head: ({ loaderData }) => ({
    meta: loaderData
      ? [
          { title: `Comunidade — ${loaderData.evento.nome}` },
          { name: "description", content: "Comunidade privada do evento: comunicados, cronograma e missões." },
          { property: "og:title", content: `Comunidade — ${loaderData.evento.nome}` },
          { property: "og:description", content: "Comunidade privada do evento." },
        ]
      : [{ title: "Comunidade — MilSim Ops" }],
  }),
  component: Comunidade,
});

function Comunidade() {
  const { evento } = Route.useLoaderData();
  const { usuario, podeGerenciarEvento } = useAuth();
  const navigate = useNavigate();
  const [, setVersao] = useState(0);
  const [comentario, setComentario] = useState<Record<string, string>>({});
  const base = carregarBase();

  const inscricao = usuario
    ? base.inscricoes.find(
        (i) => i.eventoId === evento.id && i.usuarioId === usuario.id && i.status === "confirmada",
      )
    : undefined;
  const gerente = usuario ? podeGerenciarEvento(evento.organizacaoId) : false;
  const acesso = !!inscricao || gerente;

  useEffect(() => {
    if (!usuario) navigate({ to: "/login", search: { redirect: `/comunidade/${evento.id}` } });
  }, [usuario, navigate, evento.id]);

  if (!usuario) return null;
  if (!acesso) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center">
        <h1 className="font-display text-2xl font-semibold">Comunidade restrita</h1>
        <p className="mt-2 text-muted-foreground">
          A comunidade é exclusiva para participantes com inscrição confirmada, organização e administração.
        </p>
        <Link to="/eventos/$eventoId" params={{ eventoId: evento.id }} className="mt-4 inline-block text-accent hover:underline">
          Ver página pública do evento →
        </Link>
      </div>
    );
  }

  const meuExercito = inscricao
    ? evento.exercitos.find((e) => e.id === inscricao.exercitoId)
    : undefined;

  // Comunicados visíveis: gerais + segmentados ao meu exército (destinatários não veem o critério)
  const comunicados = base.comunicados
    .filter(
      (c) =>
        c.eventoId === evento.id &&
        (!c.segmentoExercitoId || gerente || c.segmentoExercitoId === inscricao?.exercitoId),
    )
    .sort((a, b) => Number(b.fixado) - Number(a.fixado) || b.criadoEm.localeCompare(a.criadoEm));

  const comentar = (comunicadoId: string) => {
    const corpo = comentario[comunicadoId]?.trim();
    if (!corpo) return;
    mutarBase((b) => {
      b.comentarios.push({ id: gerarId("cmt"), comunicadoId, autorId: usuario.id, corpo, criadoEm: new Date().toISOString() });
    });
    setComentario((p) => ({ ...p, [comunicadoId]: "" }));
    setVersao((v) => v + 1);
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <nav aria-label="Breadcrumb" className="text-xs text-muted-foreground">
        <Link to="/app" className="hover:underline">Minha área</Link> / Comunidade
      </nav>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold uppercase">{evento.nome}</h1>
          {meuExercito && (
            <p className="text-sm text-muted-foreground">
              Seu exército: <Badge tom="destaque">{meuExercito.nome}</Badge>
              <span className="ml-2 text-xs">(visível apenas para você)</span>
            </p>
          )}
        </div>
        {evento.whatsappGrupoUrl && (
          <a href={evento.whatsappGrupoUrl} target="_blank" rel="noreferrer">
            <Botao variante="contorno">Grupo do WhatsApp (voluntário) ↗</Botao>
          </a>
        )}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <h2 className="font-display text-lg font-semibold uppercase">Mural de comunicados</h2>
          {comunicados.map((c) => {
            const autor = base.usuarios.find((u) => u.id === c.autorId);
            const comentarios = base.comentarios.filter((x) => x.comunicadoId === c.id);
            return (
              <Cartao key={c.id}>
                {c.fixado && <Badge tom="destaque">Fixado</Badge>}
                <h3 className="mt-1 font-medium">{c.titulo}</h3>
                <p className="text-xs text-muted-foreground">
                  {autor?.nomeCompleto.split(" ")[0]} · {formatarDataHoraBR(c.criadoEm)}
                </p>
                <p className="mt-2 text-sm text-muted-foreground">{c.corpo}</p>
                <div className="mt-3 space-y-2 border-t border-border pt-3">
                  {comentarios.map((cm) => {
                    const autorCm = base.usuarios.find((u) => u.id === cm.autorId);
                    return (
                      <p key={cm.id} className="text-sm">
                        <span className="font-medium">{autorCm?.nomeCompleto.split(" ")[0]}:</span>{" "}
                        <span className="text-muted-foreground">{cm.corpo}</span>
                      </p>
                    );
                  })}
                  <div className="flex gap-2">
                    <AreaTexto
                      rows={1}
                      placeholder="Comentar..."
                      value={comentario[c.id] ?? ""}
                      onChange={(e) => setComentario((p) => ({ ...p, [c.id]: e.target.value }))}
                    />
                    <Botao variante="contorno" onClick={() => comentar(c.id)}>Enviar</Botao>
                  </div>
                </div>
              </Cartao>
            );
          })}
        </div>

        <div className="space-y-4">
          <Cartao>
            <h2 className="font-display text-lg font-semibold uppercase">Cronograma</h2>
            <ul className="mt-2 space-y-2 text-sm">
              {evento.cronograma.slice().sort((a, b) => a.ordem - b.ordem).map((at) => (
                <li key={at.id}>
                  <span className="font-mono text-xs text-accent">{formatarDataBR(at.data)} {at.horario}</span>{" "}
                  {at.titulo}
                </li>
              ))}
            </ul>
          </Cartao>
          {evento.regras && (
            <Cartao>
              <h2 className="font-display text-lg font-semibold uppercase">Caderno de regras</h2>
              <div
                className="mt-2 max-h-64 overflow-y-auto text-sm [&_h2]:font-display [&_h2]:font-semibold [&_p]:text-muted-foreground"
                dangerouslySetInnerHTML={{ __html: evento.regras.conteudoHtml ?? "" }}
              />
            </Cartao>
          )}
          <Link to="/app/suporte" className="block text-sm text-accent hover:underline">
            Precisa de ajuda? Abra um chamado →
          </Link>
        </div>
      </div>
    </div>
  );
}
