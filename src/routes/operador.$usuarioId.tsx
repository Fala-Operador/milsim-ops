import { lerPerfilSocial, lerPostsDoAutor } from "@/api/social.functions";
import { CabecalhoSocial, chavePerfilSocial } from "@/components/social/Relacoes";
import { ListaPosts } from "@/components/social/ListaPosts";
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Instagram, Lock, Pencil, Shield } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { obterPerfil } from "@/api/perfil.functions";
import { MapaBrasil } from "@/components/perfil/MapaBrasil";
import { OperacoesExternas } from "@/components/perfil/OperacoesExternas";
import { AbaEquipamentos, AbaFotos, AbaInsignias, AbaOperacoes, AbaRecompensas, CartaoOperacao, Restrito } from "@/components/perfil/abas";
import { EditarPerfil, Privacidade } from "@/components/perfil/edicao";
import { Button } from "@/components/ui/button";
import { IconeInsignia } from "@/components/perfil/IconeInsignia";
import { Card } from "@/components/ui/card";
import { ErroSecao, EstadoVazio, SkeletonCartao, SkeletonPagina } from "@/components/ui";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { NativeSelect } from "@/components/ui/native-select";
import { Label } from "@/components/ui/label";
import imgRealAction from "@/assets/modalidade-real-action.jpg";
import { tr } from "@/i18n/routes/operador.$usuarioId";

const ABAS = ["visao", "publicacoes", "operacoes", "mapa", "insignias", "equipamentos", "fotos", "recompensas"] as const;
type Aba = (typeof ABAS)[number];
const ROTULOS: Record<Aba, string> = {
  get visao() { return tr("visao_geral"); }, get publicacoes() { return tr("publicacoes"); }, get operacoes() { return tr("operacoes"); }, get mapa() { return tr("mapa"); }, get insignias() { return tr("insignias"); }, get equipamentos() { return tr("equipamentos"); }, get fotos() { return tr("fotos"); }, get recompensas() { return tr("minhas_recompensas"); },
};

export const Route = createFileRoute("/operador/$usuarioId")({
  validateSearch: (s: Record<string, unknown>) => ({
    aba: ABAS.includes(s["aba"] as Aba) ? (s["aba"] as Aba) : undefined,
  }),
  head: () => ({
    meta: [
      { title: tr("perfil_do_operador_milsim_ops") },
      { name: "description", content: tr("ficha_do_operador_operacoes_mapa_do") },
      { property: "og:title", content: tr("perfil_do_operador_milsim_ops") },
      { property: "og:description", content: tr("historico_de_participacao_em_operacoes_d") },
      { property: "og:type", content: "profile" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PaginaOperador,
});

function PaginaOperador() {
  const { usuarioId } = Route.useParams();
  const { aba: abaUrl } = Route.useSearch();
  const { usuario } = useAuth();
  const router = useRouter();
  const qc = useQueryClient();
  const chave = ["perfil-operador", usuarioId, usuario?.id ?? null];
  const q = useQuery({ queryKey: chave, queryFn: () => obterPerfil(usuarioId) });
  const recarregar = () => qc.invalidateQueries({ queryKey: ["perfil-operador", usuarioId] });
  const [editar, setEditar] = useState(false);
  const [privacidade, setPrivacidade] = useState(false);

  if (q.isPending) return <SkeletonPagina />;
  if (q.isError) return <div className="mx-auto max-w-3xl px-4 py-10"><ErroSecao titulo={tr("perfil_indisponivel")} onTentar={() => q.refetch()} /></div>;
  const p = q.data;
  if (!p) return <div className="mx-auto max-w-xl px-4 py-16"><EstadoVazio titulo={tr("operador_nao_encontrado")} /></div>;

  const abas = ABAS.filter((a) => a !== "recompensas" || p.proprio);
  const aba: Aba = abaUrl && abas.includes(abaUrl) ? abaUrl : "visao";
  const irPara = (a: Aba) => router.navigate({ to: "/operador/$usuarioId", params: { usuarioId }, search: { aba: a }, replace: true, resetScroll: false });

  return (
    <div className="mx-auto max-w-6xl px-4 pb-12">
      {/* Cabeçalho: ficha do operador sobre a capa */}
      <div className="relative -mx-4 overflow-hidden border-b border-border bg-black text-white sm:mx-0 sm:mt-4 sm:rounded-lg sm:border">
        <img src={p.social?.capaUrl || imgRealAction} alt="" className={`absolute inset-0 h-full w-full object-cover ${p.social?.capaUrl ? "opacity-80" : "opacity-45"}`} />
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-black/10" aria-hidden />
        <div className="relative flex min-h-56 flex-wrap items-end gap-5 p-5 pt-16 sm:min-h-64 sm:p-7">
          {p.fotoUrl ? (
            <img src={p.fotoUrl} alt={tr("foto_de_nome", { nome: p.nome })} className="size-24 rounded-lg border-2 border-white/80 object-cover sm:size-28" />
          ) : (
            <span aria-hidden="true" className="grid size-24 place-items-center rounded-lg border-2 border-white/60 bg-primary font-display text-5xl font-bold text-primary-foreground sm:size-28">{p.nome.slice(0, 1).toUpperCase()}</span>
          )}
          <div className="min-w-0 flex-1">
            <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-white/70">{tr("ficha_do_operador")}</p>
            <h1 className="mt-1 font-display text-4xl font-bold uppercase leading-none sm:text-5xl">{p.nome}</h1>
            <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-xs uppercase tracking-wider text-white/80">
              {p.social?.squad && <span className="flex items-center gap-1.5"><Shield className="h-3.5 w-3.5" /> {p.social.squad}</span>}
              {p.social?.instagram && <a href={`https://instagram.com/${p.social.instagram}`} target="_blank" rel="noopener noreferrer nofollow" className="flex items-center gap-1.5 normal-case hover:underline"><Instagram className="h-3.5 w-3.5" /> @{p.social.instagram}</a>}
              {p.destaque && <span title={p.destaque.nome} className="flex items-center gap-1.5 rounded-sm bg-accent px-1.5 py-0.5 font-semibold text-accent-foreground"><IconeInsignia icone={p.destaque.icone} size={12} />{p.destaque.nome}</span>}
            </p>
          </div>
          {p.proprio && (
            <div className="flex flex-wrap gap-2">
              <Button asChild><Link to="/app/perfil" search={{ aba: "equipamentos" }}>{tr("gerenciar_meu_perfil")}</Link></Button>
              <Button variant="outline" className="border-white/40 bg-black/30 text-white hover:bg-black/50" onClick={() => setEditar(true)}><Pencil className="h-4 w-4" />{" "}{tr("editar")}</Button>
              <Button variant="outline" className="border-white/40 bg-black/30 text-white hover:bg-black/50" onClick={() => setPrivacidade(true)}><Lock className="h-4 w-4" />{" "}{tr("privacidade")}</Button>
            </div>
          )}
        </div>
      </div>
      {p.social?.bio && <p className="mt-3 max-w-2xl whitespace-pre-wrap px-1 text-sm sm:px-4">{p.social.bio}</p>}
      {/* Comunidade geral: seguidores, privacidade do perfil e seguir. */}
      <div className="mt-3 px-1 sm:px-4"><CabecalhoSocial usuarioId={usuarioId} /></div>

      {p.restrito ? (
        <Card className="mt-6 text-center">
          <p className="font-medium">{tr("entre_na_sua_conta_para_ver")}</p>
          <Link to="/login" search={{ redirect: `/operador/${usuarioId}` }} className="mt-3 inline-block"><Button>{tr("entrar")}</Button></Link>
        </Card>
      ) : p.fechado ? (
        <div className="mt-6">
          {p.fechado === "bloqueio" ? (
            <EstadoVazio titulo={tr("perfil_indisponivel")} descricao={tr("ha_um_bloqueio_entre_voces")} />
          ) : (
            <EstadoVazio titulo={tr("perfil_privado")} descricao={tr("siga_este_operador_para_ver_operacoes")} />
          )}
        </div>
      ) : (
        <>
          <dl className="mt-6 grid grid-cols-3 divide-x divide-border border-y border-border">
            {[[tr("operacoes"), p.resumo.operacoes], [tr("estados"), p.resumo.estados], [tr("insignias"), p.resumo.insignias]].map(([r, v]) => (
              <div key={r as string} className="px-4 py-4 first:pl-0">
                <dt className="rotulo-tecnico">{r}</dt>
                <dd className="mt-1 font-display text-5xl font-bold leading-none">{v ?? <span aria-label="privado"><Lock className="mx-auto mt-1 h-4 w-4 text-muted-foreground" /></span>}</dd>
                {r === "Estados" && p.resumo.estadosTotal !== undefined && p.resumo.estadosTotal > (p.resumo.estados ?? 0) && (
                  <dd className="text-xs text-muted-foreground">{tr("estadostotal_no_total", { estadosTotal: p.resumo.estadosTotal })}</dd>
                )}
              </div>
            ))}
          </dl>

          {p.proprio && p.completude && p.completude.percentual < 100 && (
            <div className="mt-4 border-l-2 border-accent pl-3 text-sm sm:max-w-xl">
              <p className="font-medium">{tr("perfil_percentual_preenchido", { percentual: p.completude.percentual })}{" "}<span className="text-xs font-normal text-muted-foreground">{tr("so_voce_ve")}</span></p>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-secondary"><div className="h-full bg-primary" style={{ width: `${p.completude.percentual}%` }} /></div>
              <p className="mt-1 text-xs text-muted-foreground">{tr("sugestoes_valor_nada_disso_e_exigido", { valor: p.completude.sugestoes.join(" · ") })}</p>
            </div>
          )}

          {/* Abas: seletor compacto no celular, lista no computador */}
          <div className="mt-6 sm:hidden">
            <Label htmlFor="aba-perfil" className="sr-only text-[length:inherit] font-normal text-inherit">{tr("secao_do_perfil")}</Label>
            <NativeSelect id="aba-perfil" value={aba} onChange={(e) => irPara(e.target.value as Aba)} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
              {abas.map((a) => <option key={a} value={a}>{ROTULOS[a]}</option>)}
            </NativeSelect>
          </div>
          <Tabs value={aba} onValueChange={(v) => irPara(v as typeof aba)}>
            <TabsList aria-label={tr("secoes_do_perfil")} className="mt-6 hidden flex-wrap gap-1 border-b border-border sm:flex">
              {abas.map((a) => (
                <TabsTrigger key={a} value={a}
                  className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium focus-visible:outline-2 focus-visible:outline-ring ${aba === a ? "border-accent text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
                  {ROTULOS[a]}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          <div role="tabpanel" aria-label={ROTULOS[aba]} className="mt-5">
            {aba === "visao" && (
              <div className="space-y-6">
                <section>
                  <h2 className="text-lg font-semibold">{tr("ultimas_operacoes")}</h2>
                  {p.operacoes ? (p.operacoes.length ? (
                    <div className="mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{p.operacoes.slice(0, 3).map((o) => <CartaoOperacao key={o.eventoId} o={o} proprio={p.proprio} onMudou={recarregar} />)}</div>
                  ) : <div className="mt-2"><EstadoVazio titulo={tr("nenhuma_operacao_concluida_ainda")} /></div>) : <div className="mt-2"><Restrito /></div>}
                </section>
                <section>
                  <h2 className="text-lg font-semibold">{tr("insignias_conquistadas")}</h2>
                  {p.insignias ? (
                    <ul className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">
                      {p.insignias.filter((i) => i.estado === "conquistada").map((i) => (
                        <li key={i.id} className="flex flex-col items-center gap-2 rounded-md border border-accent/40 bg-accent/5 p-3 text-center text-sm">
                          <span className="grid size-11 place-items-center rounded-full border border-accent/60 text-accent"><IconeInsignia icone={i.icone} size={20} /></span>
                          <span className="font-medium leading-tight">{i.nome}</span>
                        </li>
                      ))}
                      {!p.insignias.some((i) => i.estado === "conquistada") && <li className="col-span-full border-y border-dashed border-border py-4 text-sm text-muted-foreground">{tr("nenhuma_insignia_ainda_elas_chegam_com")}</li>}
                    </ul>
                  ) : <div className="mt-2"><Restrito /></div>}
                </section>
              </div>
            )}
            {aba === "publicacoes" && <PublicacoesDoOperador usuarioId={usuarioId} />}
            {aba === "operacoes" && <AbaOperacoes operacoes={p.operacoes} futuras={p.futuras} proprio={p.proprio} onMudou={recarregar} />}
            {aba === "mapa" && (p.mapa ? (
              <div className="space-y-8">
                <MapaBrasil operacoes={p.mapa} externas={p.externas} />
                <OperacoesExternas externas={p.externas} proprio={p.proprio} onMudou={recarregar} />
              </div>
            ) : <Restrito />)}
            {aba === "insignias" && <AbaInsignias insignias={p.insignias} />}
            {aba === "equipamentos" && <AbaEquipamentos equipamentos={p.equipamentos} proprio={p.proprio} onMudou={recarregar} />}
            {aba === "fotos" && <AbaFotos fotos={p.fotos} proprio={p.proprio} onMudou={recarregar} />}
            {aba === "recompensas" && p.recompensas && <AbaRecompensas recompensas={p.recompensas} />}
          </div>
        </>
      )}

      {p.proprio && editar && <EditarPerfil perfil={p} aberto onFechar={() => setEditar(false)} onSalvo={recarregar} />}
      {p.proprio && privacidade && <Privacidade perfil={p} aberto onFechar={() => setPrivacidade(false)} onSalvo={recarregar} />}
    </div>
  );
}

/** Publicações da pessoa na comunidade geral (perfil privado: só para seguidores aprovados). */
function PublicacoesDoOperador({ usuarioId }: { usuarioId: string }) {
  const { usuario } = useAuth();
  const perfil = useQuery({ queryKey: chavePerfilSocial(usuarioId), queryFn: () => lerPerfilSocial(usuarioId) });
  if (perfil.isPending) return <div className="max-w-2xl space-y-3"><SkeletonCartao /><SkeletonCartao /></div>;
  if (!perfil.data) return null;
  if (!perfil.data.postsVisiveis) {
    return (
      <EstadoVazio
        titulo={perfil.data.relacao === "bloqueado" ? tr("publicacoes_indisponiveis") : tr("perfil_privado")}
        descricao={perfil.data.relacao === "bloqueado" ? tr("ha_um_bloqueio_entre_voces") : tr("so_seguidores_aprovados_veem_as_publicac")}
      />
    );
  }
  return (
    <div className="max-w-2xl">
      <ListaPosts
        chave={["social", "autor", usuarioId, usuario?.id ?? "visitante"]}
        carregar={(c) => lerPostsDoAutor(usuarioId, c)}
        vazio={{ titulo: tr("nenhuma_publicacao_ainda") }}
      />
    </div>
  );
}
