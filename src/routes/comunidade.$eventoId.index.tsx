import { ChevronRight, ExternalLink, LifeBuoy, MessageCircle, Target } from "lucide-react";
import { IconeForum } from "@/components/IconeForum";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useLayoutEffect, useState } from "react";
import { useComunidade } from "@/hooks/useComunidade";
import {
  TAMANHO_PAGINA,
  buscarForuns,
  forunsVisiveis,
  listarFeed,
  novidadesPorForum,
  podePublicar,
  preferenciaForum,
} from "@/services/comunidade";
import { definirPreferenciaForum, registrarVisita } from "@/api/comunidade.functions";
import { CartaoPublicacao, Compositor, PortaComunidade, SemAcesso } from "@/components/comunidade";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { EstadoVazio, SkeletonPagina } from "@/components/ui";
import { formatarDataBR } from "@/lib/domain/money";
import { dataUrlParaBlobUrl } from "@/lib/imagens";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

export const Route = createFileRoute("/comunidade/$eventoId/")({
  validateSearch: (s: Record<string, unknown>): { forum?: string | undefined; q?: string | undefined } => ({
    forum: typeof s["forum"] === "string" && s["forum"] ? s["forum"] : undefined,
    q: typeof s["q"] === "string" && s["q"] ? s["q"] : undefined,
  }),
  component: ComunidadeInicio,
});

function ComunidadeInicio() {
  const { eventoId } = Route.useParams();
  const { forum: forumSel, q } = Route.useSearch();
  const navigate = useNavigate();
  const { montado, usuario, base, papel, gestao, suspenso, atualizar } = useComunidade(eventoId, `/comunidade/${eventoId}`);
  const [novidades, setNovidades] = useState<Record<string, number>>({});
  const chave = `com:${eventoId}:${forumSel ?? "todos"}:${q ?? ""}`;
  const [limite, setLimite] = useState(TAMANHO_PAGINA);
  const [busca, setBusca] = useState(q ?? "");

  // Novidades desde a última visita (calculadas antes de registrar a visita atual)
  // Depende só do id: cada resposta da API gera um objeto de usuário novo.
  const usuarioId = usuario?.id;
  useEffect(() => {
    if (!montado || !usuario || !papel) return;
    setNovidades(novidadesPorForum(usuario, eventoId));
    void registrarVisita(eventoId);
  }, [montado, usuarioId, papel, eventoId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Preserva quantidade carregada e posição de leitura ao voltar de uma publicação
  useEffect(() => {
    const salvo = Number(sessionStorage.getItem(`${chave}:limite`));
    setLimite(salvo > 0 ? salvo : TAMANHO_PAGINA);
  }, [chave]);
  useLayoutEffect(() => {
    if (!montado) return;
    const y = Number(sessionStorage.getItem(`${chave}:scroll`));
    if (y > 0) {
      requestAnimationFrame(() => window.scrollTo(0, y));
      sessionStorage.removeItem(`${chave}:scroll`);
    }
  }, [montado, chave, limite]);

  if (!montado || !usuario) return <SkeletonPagina />;
  const evento = base.eventos.find((e) => e.id === eventoId)!;
  if (!papel) return <PortaComunidade eventoId={eventoId} />;

  const foruns = forunsVisiveis(base, usuario, eventoId);
  const forumAtual = forumSel ? foruns.find((f) => f.id === forumSel) : undefined;
  if (forumSel && !forumAtual) return <SemAcesso eventoId={eventoId} />;

  const { fixadas, feed } = listarFeed(usuario, { eventoId, forumId: forumAtual?.id, busca: q });
  const forunsEncontrados = q ? buscarForuns(usuario, eventoId, q) : [];
  const permitidos = foruns.filter((f) => podePublicar(base, usuario, f));
  const irPara = (forum?: string) => navigate({ to: "/comunidade/$eventoId", params: { eventoId }, search: { forum, q: undefined } });
  const salvarPosicao = () => {
    sessionStorage.setItem(`${chave}:scroll`, String(window.scrollY));
    sessionStorage.setItem(`${chave}:limite`, String(limite));
  };
  const totalNovidades = Object.values(novidades).reduce((a, b) => a + b, 0);
  const pref = forumAtual ? preferenciaForum(usuario.id, forumAtual.id) : "padrao";

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <header className="relative isolate overflow-hidden rounded-lg border border-border bg-black text-white">
        {evento.imagemUrl && <img src={evento.imagemUrl} alt="" className="absolute inset-0 -z-10 h-full w-full object-cover opacity-60" />}
        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-black/90 via-black/60 to-black/20" aria-hidden />
        <div className="flex flex-wrap items-end justify-between gap-4 p-5 sm:p-7">
          <div className="min-w-0">
            <nav aria-label="Breadcrumb" className="font-mono text-[11px] uppercase tracking-[0.12em] text-white/70">
              <Link to="/app" className="hover:text-white">Minha área</Link> /{" "}
              <Link to="/comunidade/$eventoId" params={{ eventoId }} search={{}} className="hover:text-white">Comunidade</Link>
              {forumAtual && <> / {forumAtual.nome}</>}
            </nav>
            <h1 className="mt-2 font-display text-4xl font-bold uppercase leading-none sm:text-5xl">{evento.nome}</h1>
            <p className="mt-3 font-mono text-xs uppercase tracking-wider text-white/80">
              {formatarDataBR(evento.inicioEm)} · {evento.cidade}/{evento.uf} · {foruns.length} fóruns
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {totalNovidades > 0 && (
              <span className="inline-flex items-center gap-2 rounded-md border border-white/25 bg-black/40 px-3 py-1.5 text-sm">
                <span className="h-1.5 w-1.5 rounded-full bg-accent" aria-hidden />{totalNovidades} {totalNovidades === 1 ? "novidade" : "novidades"} desde a sua última visita
              </span>
            )}
            <Button asChild variant="outline" className="border-white/40 bg-black/30 text-white hover:bg-black/50">
              <Link to="/eventos/$eventoId" params={{ eventoId }}>Página da operação</Link>
            </Button>
            {gestao && (
              <Button asChild variant="outline" className="border-white/40 bg-black/30 text-white hover:bg-black/50">
                <Link to="/comunidade/$eventoId/gerenciar" params={{ eventoId }}>Gerenciar</Link>
              </Button>
            )}
          </div>
        </div>
      </header>

      {suspenso && (
        <p role="alert" className="mt-4 rounded-md border border-destructive p-3 text-sm text-destructive">
          Sua participação na comunidade está suspensa. Você pode ler os conteúdos, mas não pode publicar, responder ou curtir.
        </p>
      )}

      {/* Seletor de fóruns no celular */}
      <div className="mt-4 lg:hidden">
        <NativeSelect aria-label="Escolher fórum" value={forumAtual?.id ?? ""} onChange={(e) => irPara(e.target.value || undefined)}>
          <option value="">Todos os fóruns</option>
          {foruns.map((f) => (
            <option key={f.id} value={f.id}>
              {f.nome}{f.status === "arquivado" ? " (arquivado)" : ""}{novidades[f.id] ? ` • ${novidades[f.id]} novas` : ""}
            </option>
          ))}
        </NativeSelect>
      </div>

      <div className="mt-4 grid gap-6 lg:grid-cols-[250px_minmax(0,1fr)_240px]">
        {/* Navegação lateral */}
        <aside className="hidden lg:block" aria-label="Fóruns">
          <p className="rotulo-tecnico mb-2 px-2">Fóruns</p>
          <ul className="sticky top-20 space-y-0.5">
            <ItemForum ativo={!forumAtual} onClick={() => irPara()} rotulo="Todos os fóruns" />
            {foruns.map((f) => (
              <ItemForum
                key={f.id}
                ativo={forumAtual?.id === f.id}
                onClick={() => irPara(f.id)}
                forum={f}
                rotulo={f.nome}
                descricao={f.descricao}
                novas={novidades[f.id]}
                arquivado={f.status === "arquivado"}
              />
            ))}
          </ul>
        </aside>

        <main className="min-w-0 space-y-4">
          <form
            role="search"
            onSubmit={(e) => {
              e.preventDefault();
              navigate({ to: "/comunidade/$eventoId", params: { eventoId }, search: { forum: forumSel, q: busca.trim() || undefined } });
            }}
            className="flex gap-2"
          >
            <Input aria-label="Buscar fóruns e publicações" placeholder="Buscar fóruns e publicações…" value={busca} onChange={(e) => setBusca(e.target.value)} />
            <Button type="submit" variant="outline">Buscar</Button>
          </form>

          {forumAtual && (
            <div className="border-b border-border pb-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3">
                  <IconeForum forum={forumAtual} ativo tamanho="lg" />
                  <div className="min-w-0">
                    <h2 className="text-xl font-semibold">{forumAtual.nome}</h2>
                    <p className="text-sm text-muted-foreground">{forumAtual.descricao}</p>
                  </div>
                </div>
                <div className="w-44">
                  <NativeSelect
                    aria-label="Notificações deste fórum"
                    value={pref}
                    onChange={async (e) => { await definirPreferenciaForum(forumAtual.id, e.target.value as "seguir" | "silenciar" | "padrao"); atualizar(); }}
                  >
                    <option value="padrao">Notificações: padrão</option>
                    <option value="seguir">Seguir novas publicações</option>
                    <option value="silenciar">Silenciar</option>
                  </NativeSelect>
                </div>
              </div>
              {forumAtual.regras && <p className="mt-2 rounded-md bg-secondary p-2 text-xs"><strong>Regras do fórum:</strong> {forumAtual.regras}</p>}
              {forumAtual.status === "arquivado" && <p className="mt-2 text-sm text-warning">Fórum arquivado: somente leitura.</p>}
              {forumAtual.publicacao === "gestao" && forumAtual.status === "ativo" && (
                <p className="mt-2 text-xs text-muted-foreground">Publicações oficiais da organização{forumAtual.respostas === "membros" ? " · respostas abertas aos participantes" : ""}.</p>
              )}
            </div>
          )}

          {q && (
            <Card>
              <p className="text-sm">Resultados para <strong>“{q}”</strong> · <Link to="/comunidade/$eventoId" params={{ eventoId }} search={{ forum: forumSel }} className="text-accent hover:underline">limpar busca</Link></p>
              {forunsEncontrados.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {forunsEncontrados.map((f) => (
                    <Button variant="plain" size="none" key={f.id} onClick={() => irPara(f.id)} className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-xs hover:bg-secondary"><IconeForum forum={f} tamanho="sm" />{f.nome}</Button>
                  ))}
                </div>
              )}
            </Card>
          )}

          {(forumAtual ? podePublicar(base, usuario, forumAtual) : permitidos.length > 0) && (
            <Compositor usuario={usuario} forunsPermitidos={permitidos} forumFixo={forumAtual} gestao={gestao} onPublicado={atualizar} />
          )}

          {fixadas.length > 0 && (
            <section aria-label="Publicações fixadas">
              <div className="space-y-0">
              <h2 className="rotulo-tecnico !text-accent">Fixadas e avisos importantes</h2>
              {fixadas.map((p) => (
                <CartaoPublicacao key={p.id} base={base} pub={p} usuario={usuario} gestao={gestao} foruns={foruns} mostrarForum={!forumAtual} onMudou={atualizar} onAbrir={salvarPosicao} />
              ))}
              </div>
            </section>
          )}

          <section aria-label="Feed">
            {feed.length === 0 && fixadas.length === 0 && <EstadoVazio titulo="Nenhuma publicação por aqui" descricao="Seja o primeiro a compartilhar algo." />}
            {feed.slice(0, limite).map((p) => (
              <CartaoPublicacao key={p.id} base={base} pub={p} usuario={usuario} gestao={gestao} foruns={foruns} mostrarForum={!forumAtual} onMudou={atualizar} onAbrir={salvarPosicao} />
            ))}
            {feed.length > limite && (
              <div className="text-center">
                <Button variant="outline" onClick={() => setLimite((l) => l + TAMANHO_PAGINA)}>Carregar mais</Button>
              </div>
            )}
          </section>
        </main>

        <aside className="space-y-6 lg:border-l lg:border-border lg:pl-6" aria-label="Atalhos do evento">
          <section>
            <h2 className="rotulo-tecnico">Cronograma</h2>
            <ol className="mt-3 space-y-3 border-l border-border pl-4 text-sm">
              {evento.cronograma.slice().sort((a, b) => a.ordem - b.ordem).map((at) => (
                <li key={at.id} className="relative">
                  <span className="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full border border-accent bg-background" aria-hidden />
                  <span className="block font-mono text-[11px] uppercase tracking-wider text-muted-foreground">{formatarDataBR(at.data).slice(0, 5)} · {at.horario}</span>
                  <span className="font-medium">{at.titulo}</span>
                </li>
              ))}
            </ol>
          </section>
          {evento.regras && (
            <Collapsible className="border-t border-border pt-4 text-sm">
              <CollapsibleTrigger className="group flex w-full cursor-pointer items-center justify-between gap-1 text-left font-semibold">
                Caderno de regras<ChevronRight aria-hidden="true" className="h-4 w-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-90" />
              </CollapsibleTrigger>
              <CollapsibleContent>
                {evento.regras.pdfDataUrl ? (
                  <LeitorPdf titulo={evento.regras.titulo} dataUrl={evento.regras.pdfDataUrl} />
                ) : (
                  <div className="mt-2 max-h-64 overflow-y-auto [&_h2]:font-semibold [&_p]:text-muted-foreground" dangerouslySetInnerHTML={{ __html: evento.regras.conteudoHtml ?? "" }} />
                )}
              </CollapsibleContent>
            </Collapsible>
          )}
          <nav aria-label="Atalhos" className="border-t border-border pt-4">
            <ul className="space-y-1 text-sm">
              <li><Link to="/app/missoes" className="flex items-center gap-2.5 rounded-md px-2 py-1.5 hover:bg-secondary"><Target className="h-4 w-4 text-accent" aria-hidden />Missões</Link></li>
              <li><Link to="/app/suporte" search={{ evento: eventoId }} className="flex items-center gap-2.5 rounded-md px-2 py-1.5 hover:bg-secondary"><LifeBuoy className="h-4 w-4 text-accent" aria-hidden />Suporte privado</Link></li>
              {evento.whatsappGrupoUrl && <li><a href={evento.whatsappGrupoUrl} target="_blank" rel="noreferrer" className="flex items-center gap-2.5 rounded-md px-2 py-1.5 hover:bg-secondary"><MessageCircle className="h-4 w-4 text-accent" aria-hidden />Grupo do WhatsApp<ExternalLink className="ml-auto h-3.5 w-3.5 text-muted-foreground" aria-hidden /></a></li>}
            </ul>
          </nav>
        </aside>
      </div>
    </div>
  );
}

function ItemForum({ ativo, onClick, rotulo, forum, descricao, novas, arquivado }: { ativo: boolean; onClick: () => void; rotulo: string; forum?: { icone?: string | undefined; nome: string }; descricao?: string; novas?: number | undefined; arquivado?: boolean }) {
  return (
    <li>
      <Button variant="plain" size="none"
        onClick={onClick}
        aria-current={ativo ? "page" : undefined}
        className={`flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-left text-sm transition-colors ${ativo ? "bg-secondary font-semibold" : "hover:bg-secondary/70"}`}
      >
        <IconeForum forum={forum} ativo={ativo} />
        <span className="min-w-0 flex-1">
          <span className="block truncate">{rotulo}</span>
          {descricao && <span className="block truncate text-xs font-normal text-muted-foreground">{descricao}</span>}
        </span>
        {!!novas && <span className="min-w-5 rounded-sm bg-accent px-1 text-center font-mono text-[11px] font-semibold text-accent-foreground">{novas}</span>}
        {arquivado && <Badge>Arquivado</Badge>}
      </Button>
    </li>
  );
}

function LeitorPdf({ titulo, dataUrl }: { titulo: string; dataUrl: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    const u = dataUrlParaBlobUrl(dataUrl);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [dataUrl]);
  if (!url) return <p className="mt-2 text-xs text-muted-foreground">Carregando PDF…</p>;
  return <iframe title={titulo} src={url} className="mt-2 h-96 w-full rounded-md border border-border bg-background" />;
}
