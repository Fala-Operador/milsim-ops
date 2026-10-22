import { ChevronRight } from "lucide-react";
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
      <nav aria-label="Breadcrumb" className="text-xs text-muted-foreground">
        <Link to="/app" className="hover:underline">Minha área</Link> /{" "}
        <Link to="/comunidade/$eventoId" params={{ eventoId }} search={{}} className="hover:underline">Comunidade</Link>
        {forumAtual && <> / {forumAtual.nome}</>}
      </nav>

      <header className="mt-2 flex flex-wrap items-center gap-4 rounded-lg border border-border bg-card p-4">
        {evento.imagemUrl && <img src={evento.imagemUrl} alt="" className="h-16 w-16 rounded-md object-cover" />}
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-2xl font-semibold uppercase">{evento.nome}</h1>
          <p className="text-sm text-muted-foreground">
            Comunidade · {formatarDataBR(evento.inicioEm)} · {evento.cidade}/{evento.uf}
            {totalNovidades > 0 && <> · <span className="text-accent">{totalNovidades} novidade(s) desde sua última visita</span></>}
          </p>
        </div>
        {gestao && (
          <Link to="/comunidade/$eventoId/gerenciar" params={{ eventoId }}>
            <Button variant="outline">Gerenciar comunidade</Button>
          </Link>
        )}
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
              {f.icone} {f.nome}{f.status === "arquivado" ? " (arquivado)" : ""}{novidades[f.id] ? ` • ${novidades[f.id]} novas` : ""}
            </option>
          ))}
        </NativeSelect>
      </div>

      <div className="mt-4 grid gap-6 lg:grid-cols-[240px_1fr_260px]">
        {/* Navegação lateral */}
        <aside className="hidden lg:block" aria-label="Fóruns">
          <ul className="sticky top-20 space-y-1">
            <ItemForum ativo={!forumAtual} onClick={() => irPara()} rotulo="🗂 Todos" />
            {foruns.map((f) => (
              <ItemForum
                key={f.id}
                ativo={forumAtual?.id === f.id}
                onClick={() => irPara(f.id)}
                rotulo={`${f.icone ?? "#"} ${f.nome}`}
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
            <Card>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h2 className="font-display text-xl font-semibold">{forumAtual.icone} {forumAtual.nome}</h2>
                  <p className="text-sm text-muted-foreground">{forumAtual.descricao}</p>
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
            </Card>
          )}

          {q && (
            <Card>
              <p className="text-sm">Resultados para <strong>“{q}”</strong> · <Link to="/comunidade/$eventoId" params={{ eventoId }} search={{ forum: forumSel }} className="text-accent hover:underline">limpar busca</Link></p>
              {forunsEncontrados.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {forunsEncontrados.map((f) => (
                    <Button variant="plain" size="none" key={f.id} onClick={() => irPara(f.id)} className="rounded-full border border-border px-3 py-1 text-xs hover:bg-secondary">{f.icone} {f.nome}</Button>
                  ))}
                </div>
              )}
            </Card>
          )}

          {(forumAtual ? podePublicar(base, usuario, forumAtual) : permitidos.length > 0) && (
            <Compositor usuario={usuario} forunsPermitidos={permitidos} forumFixo={forumAtual} gestao={gestao} onPublicado={atualizar} />
          )}

          {fixadas.length > 0 && (
            <section aria-label="Publicações fixadas" className="space-y-3">
              <h2 className="font-display text-sm font-semibold uppercase text-accent">📌 Fixadas e avisos importantes</h2>
              {fixadas.map((p) => (
                <CartaoPublicacao key={p.id} base={base} pub={p} usuario={usuario} gestao={gestao} foruns={foruns} mostrarForum={!forumAtual} onMudou={atualizar} onAbrir={salvarPosicao} />
              ))}
            </section>
          )}

          <section aria-label="Feed" className="space-y-3">
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

        <aside className="space-y-4" aria-label="Atalhos do evento">
          <Card>
            <h2 className="font-display text-sm font-semibold uppercase">Cronograma</h2>
            <ul className="mt-2 space-y-1 text-sm">
              {evento.cronograma.slice().sort((a, b) => a.ordem - b.ordem).map((at) => (
                <li key={at.id}><span className="font-mono text-xs text-accent">{formatarDataBR(at.data)} {at.horario}</span> {at.titulo}</li>
              ))}
            </ul>
          </Card>
          {evento.regras && (
            <Collapsible className="rounded-lg border border-border bg-card p-4 text-sm">
              <CollapsibleTrigger className="group flex cursor-pointer items-center gap-1 text-left font-display font-semibold uppercase">
                <ChevronRight aria-hidden="true" className="h-4 w-4 transition-transform group-data-[state=open]:rotate-90" />Caderno de regras
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
          <Card>
            <ul className="space-y-2 text-sm">
              <li><Link to="/app/missoes" className="text-accent hover:underline">🎯 Missões</Link></li>
              <li><Link to="/app/suporte" search={{ evento: eventoId }} className="text-accent hover:underline">🛟 Suporte (privado)</Link></li>
              {evento.whatsappGrupoUrl && <li><a href={evento.whatsappGrupoUrl} target="_blank" rel="noreferrer" className="text-accent hover:underline">💬 Grupo do WhatsApp ↗</a></li>}
            </ul>
          </Card>
        </aside>
      </div>
    </div>
  );
}

function ItemForum({ ativo, onClick, rotulo, descricao, novas, arquivado }: { ativo: boolean; onClick: () => void; rotulo: string; descricao?: string; novas?: number | undefined; arquivado?: boolean }) {
  return (
    <li>
      <Button variant="plain" size="none"
        onClick={onClick}
        aria-current={ativo ? "page" : undefined}
        className={`w-full rounded-md px-3 py-2 text-left text-sm transition-colors ${ativo ? "bg-secondary font-semibold" : "hover:bg-secondary"}`}
      >
        <span className="flex items-center justify-between gap-2">
          <span className="truncate">{rotulo}</span>
          {!!novas && <Badge variant="accent">{novas}</Badge>}
          {arquivado && <Badge>Arquivado</Badge>}
        </span>
        {descricao && <span className="mt-0.5 block truncate text-xs font-normal text-muted-foreground">{descricao}</span>}
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
