import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { lerDenunciasPendentes, resolverDenuncia } from "@/api/social.functions";
import { MOTIVOS_DENUNCIA } from "@/lib/comunidadeGeral";
import { tempoRelativo } from "@/lib/tempoRelativo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EstadoVazio, ErroSecao, ModalTexto, SkeletonCartao } from "@/components/ui";
import { AvatarAutor } from "@/components/social/CartaoPost";

// Moderação da comunidade geral: denúncias pendentes, das mais antigas para as mais novas.
// Sem IA por enquanto: fotos e textos fora da lista de termos dependem destas denúncias.
export const Route = createFileRoute("/admin/comunidade")({
  head: () => ({
    meta: [
      { title: "Comunidade — Admin MilSim Ops" },
      { name: "description", content: "Moderação da comunidade geral: denúncias de publicações." },
    ],
  }),
  component: ModeracaoComunidade,
});

function ModeracaoComunidade() {
  const q = useQuery({ queryKey: ["social", "denuncias"], queryFn: lerDenunciasPendentes });
  const [ocultando, setOcultando] = useState<string | null>(null);
  const [erro, setErro] = useState("");

  const descartar = async (id: string) => {
    setErro("");
    try {
      await resolverDenuncia(id, "descartar");
      await q.refetch();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível descartar.");
    }
  };

  return (
    <section className="space-y-4">
      <div>
        <h2 className="font-display text-lg font-semibold uppercase">Comunidade — denúncias</h2>
        <p className="mt-1 max-w-prose text-sm text-muted-foreground">
          Ocultar a publicação encerra todas as denúncias dela e avisa o autor. Descartar encerra só esta denúncia.
        </p>
      </div>
      {erro && <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">{erro}</p>}
      {q.isPending ? (
        <SkeletonCartao />
      ) : q.isError ? (
        <ErroSecao titulo="Não foi possível carregar as denúncias" descricao={q.error.message} onTentar={() => void q.refetch()} />
      ) : q.data.length === 0 ? (
        <EstadoVazio titulo="Nenhuma denúncia pendente" descricao="Tudo em dia." />
      ) : (
        <ul className="space-y-3">
          {q.data.map((d) => (
            <li key={d.id}>
              <Card className="space-y-3">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <Badge variant="warning">{MOTIVOS_DENUNCIA[d.motivo]}</Badge>
                  <span className="text-muted-foreground">por {d.denunciante.nome} · {tempoRelativo(d.criadoEm)}</span>
                  {d.post.status !== "publicado" && <Badge variant="secondary">{d.post.status}</Badge>}
                </div>
                {d.detalhes && <p className="text-sm">“{d.detalhes}”</p>}
                <div className="rounded-md border border-border bg-elevated p-3">
                  <div className="flex items-center gap-2 text-sm">
                    <AvatarAutor nome={d.post.autor.nome} fotoUrl={d.post.autor.fotoUrl} tamanho="h-7 w-7" />
                    <Link to="/operador/$usuarioId" params={{ usuarioId: d.post.autor.id }} search={{ aba: undefined }} className="font-medium hover:underline">{d.post.autor.nome}</Link>
                    <span className="text-muted-foreground">· {tempoRelativo(d.post.criadoEm)}</span>
                  </div>
                  {d.post.texto && <p className="mt-2 whitespace-pre-wrap break-words text-sm">{d.post.texto}</p>}
                  {d.post.imagens.length > 0 && (
                    <div className="mt-2 grid grid-cols-4 gap-1">
                      {d.post.imagens.map((i) => (
                        <a key={i.url} href={i.url} target="_blank" rel="noopener noreferrer"><img src={i.url} alt={i.alt || "Foto denunciada"} className="aspect-square w-full rounded object-cover" /></a>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex flex-wrap justify-end gap-2">
                  <Button variant="ghost" onClick={() => void descartar(d.id)}>Descartar denúncia</Button>
                  <Button variant="destructive" onClick={() => setOcultando(d.id)} disabled={d.post.status !== "publicado"}>Ocultar publicação</Button>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
      <ModalTexto
        aberto={!!ocultando}
        titulo="Ocultar publicação"
        rotulo="Motivo (o autor recebe este texto)"
        descricao="A publicação deixa de aparecer para todos. As outras denúncias dela são encerradas."
        confirmar="Ocultar"
        destrutivo
        maximo={300}
        onFechar={() => setOcultando(null)}
        onConfirmar={async (motivo) => {
          await resolverDenuncia(ocultando!, "ocultar", motivo);
          await q.refetch();
        }}
      />
    </section>
  );
}
