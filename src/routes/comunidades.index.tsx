import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Lock, MessagesSquare, Search, Users } from "lucide-react";
import { carregarBase } from "@/services/db";
import { useAuth } from "@/contexts/AuthContext";
import { useVersaoBase } from "@/hooks/useVersaoBase";
import { comunidadesVitrine, type AcessoComunidade, type ItemVitrine } from "@/lib/comunidadePublica";
import { nomeModalidade } from "@/lib/modalidades";
import { formatarDataBR } from "@/lib/domain/money";
import { ImagemSegura } from "@/components/divulgacao";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EstadoVazio } from "@/components/ui";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQueryClient } from "@tanstack/react-query";
import { lerFeed } from "@/api/social.functions";
import { LIMITE_POST, MAX_FOTOS } from "@/lib/comunidadeGeral";
import { Compositor } from "@/components/social/Compositor";
import { ListaPosts } from "@/components/social/ListaPosts";
import { CartaoPerfilComunidade, PedidosParaSeguir } from "@/components/social/Relacoes";
import { ListaForuns } from "@/components/social/Foruns";
import { LateralComunidade } from "@/components/social/LateralComunidade";

export const Route = createFileRoute("/comunidades/")({
  validateSearch: (s: Record<string, unknown>): { aba?: "geral" | "foruns" | "operacoes" | "pedidos" | undefined } => ({
    aba: s["aba"] === "foruns" || s["aba"] === "operacoes" || s["aba"] === "pedidos" ? s["aba"] : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Comunidades — MilSim Ops" },
      { name: "description", content: "Comunidade geral do airsoft e milsim e comunidades exclusivas de cada operação." },
      { property: "og:title", content: "Comunidades — MilSim Ops" },
      { property: "og:description", content: "Inscreva-se numa operação e entre na comunidade dela." },
      { property: "og:type", content: "website" },
    ],
  }),
  component: Comunidades,
});

/** O que o botão do cartão faz em cada situação (a rota da comunidade repete a decisão ao abrir). */
function Acao({ item }: { item: ItemVitrine }) {
  const { evento, acesso } = item;
  const params = { eventoId: evento.id };
  const ROTULO: Record<AcessoComunidade, string> = {
    entrar: "Acessar comunidade",
    login: "Entrar para acessar",
    inscrever: "Inscrever-se para entrar",
    pagamento_pendente: "Concluir pagamento",
    encerrada: "Inscrições encerradas",
    indisponivel: "Indisponível",
  };
  if (acesso === "inscrever") {
    return <Link to="/inscricao/$eventoId" params={params} search={{ cortesia: undefined, voucher: undefined, comunidade: "1" }}><Button className="w-full">{ROTULO[acesso]}</Button></Link>;
  }
  if (acesso === "pagamento_pendente") {
    return <Link to="/app/ingressos"><Button variant="outline" className="w-full">{ROTULO[acesso]}</Button></Link>;
  }
  if (acesso === "encerrada" || acesso === "indisponivel") {
    return <Button variant="outline" className="w-full" disabled>{ROTULO[acesso]}</Button>;
  }
  // "entrar" e "login": a rota da comunidade pede o login e, na volta, decide de novo.
  return <Link to="/comunidade/$eventoId" params={params} search={{}}><Button variant={acesso === "entrar" ? "default" : "outline"} className="w-full">{ROTULO[acesso]}</Button></Link>;
}

function Cartao({ item }: { item: ItemVitrine }) {
  const { evento, acesso, confirmados } = item;
  return (
    <article className="flex h-full flex-col overflow-hidden rounded-lg border border-border bg-card text-card-foreground">
      <Link to="/eventos/$eventoId" params={{ eventoId: evento.id }} className="block aspect-video overflow-hidden border-b border-border bg-secondary" tabIndex={-1} aria-hidden="true">
        {evento.imagemUrl ? (
          <ImagemSegura key={evento.imagemUrl} src={evento.imagemUrl} alt="" className="h-full w-full" />
        ) : (
          <div className="topo-bg h-full" />
        )}
      </Link>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex items-start justify-between gap-2">
          <h2 className="min-w-0 break-words font-display text-lg font-semibold uppercase leading-tight">
            <Link to="/eventos/$eventoId" params={{ eventoId: evento.id }} className="hover:underline">{evento.nome}</Link>
          </h2>
          {acesso === "entrar" ? (
            <Badge variant="success" className="shrink-0"><Users aria-hidden="true" />Você participa</Badge>
          ) : (
            <Badge variant="secondary" className="shrink-0"><Lock aria-hidden="true" />Exclusiva</Badge>
          )}
        </div>
        <p className="text-sm text-muted-foreground">
          {formatarDataBR(evento.inicioEm)} · {evento.cidade}/{evento.uf} · {nomeModalidade(evento.modalidade)}
        </p>
        <p className="text-xs text-muted-foreground">
          {confirmados} {confirmados === 1 ? "operador confirmado" : "operadores confirmados"}
          {acesso !== "entrar" && " · fóruns, avisos e conversas para inscritos"}
        </p>
        <div className="mt-auto pt-2"><Acao item={item} /></div>
      </div>
    </article>
  );
}

type Aba = "geral" | "foruns" | "operacoes" | "pedidos";
const ABAS: { id: Aba; rotulo: string; logado?: boolean }[] = [
  { id: "geral", rotulo: "Geral" },
  { id: "foruns", rotulo: "Fóruns" },
  { id: "operacoes", rotulo: "Operações" },
  { id: "pedidos", rotulo: "Pedidos para seguir", logado: true },
];

function Comunidades() {
  const { usuario } = useAuth();
  const { aba: abaUrl } = Route.useSearch();
  const navigate = Route.useNavigate();
  const aba: Aba = abaUrl === "pedidos" && !usuario ? "geral" : (abaUrl ?? "geral");
  const irPara = (a: Aba) => navigate({ search: { aba: a === "geral" ? undefined : a }, replace: true, resetScroll: false });

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8">
      <header className="space-y-3">
        <h1 className="flex items-center gap-2 font-display text-2xl font-semibold uppercase">
          <MessagesSquare className="size-6" aria-hidden="true" /> Comunidades
        </h1>
        <Tabs value={aba} onValueChange={(v) => irPara(v as Aba)}>
          <TabsList className="flex-wrap gap-2">
            {ABAS.filter((a) => !a.logado || usuario).map((a) => (
              <TabsTrigger key={a.id} value={a.id} asChild>
                <Button variant={aba === a.id ? "default" : "outline"}>{a.rotulo}</Button>
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </header>
      {aba === "geral" && <FeedGeral />}
      {aba === "foruns" && <ListaForuns />}
      {aba === "operacoes" && <VitrineOperacoes />}
      {aba === "pedidos" && <div className="max-w-xl"><PedidosParaSeguir /></div>}
    </div>
  );
}

/** Comunidade geral: todos veem todos (perfis públicos); interagir pede login. */
function FeedGeral() {
  const { usuario } = useAuth();
  const qc = useQueryClient();
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
      <div className="min-w-0 space-y-4">
        <LateralComunidade compacta />
        {usuario ? (
          <Compositor onPublicado={() => void qc.invalidateQueries({ queryKey: ["social", "feed"] })} />
        ) : (
          <div className="rounded-lg border border-border bg-card p-4 text-sm">
            <p>Veja o que a galera do airsoft e do milsim está publicando.</p>
            <p className="mt-1 text-muted-foreground">
              <Link to="/login" search={{ redirect: "/comunidades" }} className="text-accent hover:underline">Entre</Link> ou{" "}
              <Link to="/cadastro" search={{ redirect: "/comunidades" }} className="text-accent hover:underline">cadastre-se</Link> para publicar, curtir, responder e seguir.
            </p>
          </div>
        )}
        <ListaPosts
          chave={["social", "feed", usuario?.id ?? "visitante"]}
          carregar={(c) => lerFeed(c)}
          vazio={{ titulo: "Nenhuma publicação ainda", descricao: usuario ? "Seja o primeiro a publicar." : "Volte mais tarde." }}
        />
      </div>
      {/* Lateral: conta na comunidade, depois banners, operações impulsionadas e patrocinadores. */}
      <aside className="space-y-4" aria-label="Sua conta na comunidade e destaques">
        <CartaoPerfilComunidade />
        <PedidosParaSeguir compacto />
        <div className="hidden lg:block"><LateralComunidade /></div>
        <p className="px-1 text-xs text-muted-foreground">
          Até {LIMITE_POST} caracteres e {MAX_FOTOS} fotos por publicação. Conteúdo sexual, de drogas ou de morte e violência real não é permitido.
        </p>
      </aside>
    </div>
  );
}

function VitrineOperacoes() {
  const { usuario } = useAuth();
  const versao = useVersaoBase();
  const [busca, setBusca] = useState("");
  const itens = useMemo(() => comunidadesVitrine(carregarBase(), usuario ?? null), [usuario, versao]); // eslint-disable-line react-hooks/exhaustive-deps
  const termo = busca.trim().toLocaleLowerCase("pt-BR");
  const filtrados = termo
    ? itens.filter(({ evento }) => `${evento.nome} ${evento.cidade} ${evento.uf}`.toLocaleLowerCase("pt-BR").includes(termo))
    : itens;
  const minhas = filtrados.filter((i) => i.acesso === "entrar");
  const outras = filtrados.filter((i) => i.acesso !== "entrar");

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <p className="max-w-2xl text-sm text-muted-foreground">
          Cada operação tem uma comunidade com fóruns, avisos da organização e conversa entre os participantes.
          {usuario ? " Inscreva-se numa operação para entrar na comunidade dela." : " Entre na sua conta para acessar as comunidades das operações em que você está inscrito."}
        </p>
        <div className="relative max-w-md">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" aria-hidden="true" />
          <Input aria-label="Buscar por operação ou cidade" placeholder="Buscar por operação ou cidade" value={busca} onChange={(e) => setBusca(e.target.value)} className="pl-9" />
        </div>
      </header>

      {filtrados.length === 0 ? (
        <EstadoVazio
          titulo={itens.length === 0 ? "Nenhuma comunidade aberta no momento" : "Nenhuma comunidade encontrada"}
          descricao={itens.length === 0 ? "Quando novas operações forem publicadas, as comunidades aparecem aqui." : "Ajuste a busca."}
        />
      ) : (
        <>
          {minhas.length > 0 && (
            <section aria-labelledby="minhas" className="space-y-3">
              <h2 id="minhas" className="font-display text-base font-semibold uppercase tracking-wide text-muted-foreground">Suas comunidades</h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{minhas.map((i) => <Cartao key={i.evento.id} item={i} />)}</div>
            </section>
          )}
          {outras.length > 0 && (
            <section aria-labelledby="outras" className="space-y-3">
              <h2 id="outras" className="font-display text-base font-semibold uppercase tracking-wide text-muted-foreground">
                {minhas.length > 0 ? "Outras comunidades" : "Comunidades das próximas operações"}
              </h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{outras.map((i) => <Cartao key={i.evento.id} item={i} />)}</div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
