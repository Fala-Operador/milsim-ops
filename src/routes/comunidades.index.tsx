import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Lock, Search, Users } from "lucide-react";
import { carregarBase } from "@/services/db";
import { useAuth } from "@/contexts/AuthContext";
import { useVersaoBase } from "@/hooks/useVersaoBase";
import { comunidadesVitrine, type AcessoComunidade, type ItemVitrine } from "@/lib/comunidadePublica";
import { nomeModalidade } from "@/lib/modalidades";
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
import imgEquipamento from "@/assets/comunidade-equipamento.jpg";
import { tr } from "@/i18n/routes/comunidades.index";

export const Route = createFileRoute("/comunidades/")({
  validateSearch: (s: Record<string, unknown>): { aba?: "geral" | "foruns" | "operacoes" | "pedidos" | undefined } => ({
    aba: s["aba"] === "foruns" || s["aba"] === "operacoes" || s["aba"] === "pedidos" ? s["aba"] : undefined,
  }),
  head: () => ({
    meta: [
      { title: tr("comunidades_milsim_ops") },
      { name: "description", content: tr("comunidade_geral_do_airsoft_e_milsim") },
      { property: "og:title", content: tr("comunidades_milsim_ops") },
      { property: "og:description", content: tr("inscreva_se_numa_operacao_e_entre") },
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
    entrar: tr("acessar_comunidade"),
    login: tr("entrar_para_acessar"),
    inscrever: tr("inscrever_se_para_entrar"),
    pagamento_pendente: tr("concluir_pagamento"),
    encerrada: tr("inscricoes_encerradas"),
    indisponivel: tr("indisponivel"),
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
  const d = new Date(evento.inicioEm);
  return (
    <article className="flex h-full flex-col overflow-hidden rounded-lg border border-border">
      <Link to="/eventos/$eventoId" params={{ eventoId: evento.id }} className="relative block aspect-[16/9] overflow-hidden bg-secondary" tabIndex={-1} aria-hidden="true">
        {evento.imagemUrl ? <ImagemSegura key={evento.imagemUrl} src={evento.imagemUrl} alt="" className="h-full w-full" /> : <div className="topo-bg h-full" />}
        <span className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />
        <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-sm bg-black/60 px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-white">
          {acesso === "entrar" ? <><Users className="size-3" />{tr("voce_participa")}</> : <><Lock className="size-3" />{tr("so_inscritos")}</>}
        </span>
        <span className="absolute inset-x-0 bottom-0 p-3 text-white">
          <span className="block font-mono text-[11px] uppercase tracking-wider text-white/75">{String(d.getDate()).padStart(2, "0")}/{String(d.getMonth() + 1).padStart(2, "0")} · {evento.cidade}/{evento.uf} · {nomeModalidade(evento.modalidade)}</span>
          <span className="mt-1 block font-display text-2xl font-bold uppercase leading-none">{evento.nome}</span>
        </span>
      </Link>
      <div className="flex flex-1 flex-col gap-3 p-4">
        <p className="flex items-baseline gap-2 text-sm text-muted-foreground">
          <span className="font-display text-2xl font-bold leading-none text-foreground tabular-nums">{confirmados}</span>
          {confirmados === 1 ? tr("operador_confirmado") : tr("operadores_confirmados")}
        </p>
        {acesso !== "entrar" && <p className="text-xs text-muted-foreground">{tr("foruns_avisos_da_organizacao_e_conversa")}</p>}
        <div className="mt-auto"><Acao item={item} /></div>
      </div>
    </article>
  );
}

type Aba = "geral" | "foruns" | "operacoes" | "pedidos";
const ABAS: { id: Aba; rotulo: string; logado?: boolean }[] = [
  { id: "geral", get rotulo() { return tr("geral"); } },
  { id: "foruns", get rotulo() { return tr("foruns"); } },
  { id: "operacoes", get rotulo() { return tr("operacoes"); } },
  { id: "pedidos", get rotulo() { return tr("pedidos_para_seguir"); }, logado: true },
];

function Comunidades() {
  const { usuario } = useAuth();
  const { aba: abaUrl } = Route.useSearch();
  const navigate = Route.useNavigate();
  const aba: Aba = abaUrl === "pedidos" && !usuario ? "geral" : (abaUrl ?? "geral");
  const irPara = (a: Aba) => navigate({ search: { aba: a === "geral" ? undefined : a }, replace: true, resetScroll: false });

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8">
      <header className="space-y-4">
        <div className="relative isolate overflow-hidden rounded-lg border border-border bg-black text-white">
          <img src={imgEquipamento} alt="" className="absolute inset-0 -z-10 h-full w-full object-cover opacity-55" />
          <div className="absolute inset-0 -z-10 bg-gradient-to-r from-black/90 via-black/60 to-transparent" aria-hidden />
          <div className="max-w-2xl p-6 sm:p-8">
            <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-white/70">{tr("comunidade_milsim_ops")}</p>
            <h1 className="mt-2 font-display text-4xl font-bold uppercase leading-none sm:text-5xl">{tr("comunidades")}</h1>
            <p className="mt-3 text-sm text-white/80">{tr("o_feed_geral_e_aberto_a")}</p>
          </div>
        </div>
        <Tabs value={aba} onValueChange={(v) => irPara(v as Aba)}>
          <TabsList aria-label={tr("secoes_da_comunidade")} className="abas-rolaveis flex w-full gap-1 border-b border-border">
            {ABAS.filter((a) => !a.logado || usuario).map((a) => (
              <TabsTrigger key={a.id} value={a.id}
                className={`-mb-px shrink-0 whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium focus-visible:outline-2 focus-visible:outline-ring ${aba === a.id ? "border-accent text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
                {a.rotulo}
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
          <div className="flex flex-wrap items-center justify-between gap-3 border-y border-border py-4 text-sm">
            <p className="font-medium">{tr("veja_o_que_a_galera_do")}</p>
            <p className="text-muted-foreground">
              <Link to="/login" search={{ redirect: "/comunidades" }} className="text-accent hover:underline">{tr("entre")}</Link>{" "}{tr("ou")}{" "}
              <Link to="/cadastro" search={{ redirect: "/comunidades" }} className="text-accent hover:underline">{tr("cadastre_se")}</Link>{" "}{tr("para_publicar_curtir_responder_e_seguir")}</p>
          </div>
        )}
        <ListaPosts
          chave={["social", "feed", usuario?.id ?? "visitante"]}
          carregar={(c) => lerFeed(c)}
          vazio={{ titulo: tr("nenhuma_publicacao_ainda"), descricao: usuario ? tr("seja_o_primeiro_a_publicar") : tr("volte_mais_tarde") }}
        />
      </div>
      {/* Lateral: conta na comunidade, depois banners, operações impulsionadas e patrocinadores. */}
      <aside className="space-y-4" aria-label={tr("sua_conta_na_comunidade_e_destaques")}>
        <CartaoPerfilComunidade />
        <PedidosParaSeguir compacto />
        <div className="hidden lg:block"><LateralComunidade /></div>
        <p className="px-1 text-xs text-muted-foreground">{tr("ate_limite_post_caracteres_e_max", { LIMITE_POST, MAX_FOTOS })}</p>
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
        <p className="max-w-2xl text-sm text-muted-foreground">{tr("cada_operacao_tem_uma_comunidade_com")}{usuario ? ` ${tr("inscreva_se_numa_operacao_para_entrar")}` : ` ${tr("entre_na_sua_conta_para_acessar")}`}
        </p>
        <div className="relative max-w-md">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" aria-hidden="true" />
          <Input aria-label={tr("buscar_por_operacao_ou_cidade")} placeholder={tr("buscar_por_operacao_ou_cidade")} value={busca} onChange={(e) => setBusca(e.target.value)} className="pl-9" />
        </div>
      </header>

      {filtrados.length === 0 ? (
        <EstadoVazio
          titulo={itens.length === 0 ? tr("nenhuma_comunidade_aberta_no_momento") : tr("nenhuma_comunidade_encontrada")}
          descricao={itens.length === 0 ? tr("quando_novas_operacoes_forem_publicadas") : tr("ajuste_a_busca")}
        />
      ) : (
        <>
          {minhas.length > 0 && (
            <section aria-labelledby="minhas" className="space-y-3">
              <h2 id="minhas" className="text-lg font-semibold">{tr("suas_comunidades")}</h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{minhas.map((i) => <Cartao key={i.evento.id} item={i} />)}</div>
            </section>
          )}
          {outras.length > 0 && (
            <section aria-labelledby="outras" className="space-y-3">
              <h2 id="outras" className="text-lg font-semibold">
                {minhas.length > 0 ? tr("outras_comunidades") : tr("comunidades_das_proximas_operacoes")}
              </h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{outras.map((i) => <Cartao key={i.evento.id} item={i} />)}</div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
