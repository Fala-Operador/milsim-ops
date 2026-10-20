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
import { Card } from "@/components/ui/card";
import { ErroSecao, EstadoVazio, SkeletonPagina } from "@/components/ui";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { NativeSelect } from "@/components/ui/native-select";
import { Label } from "@/components/ui/label";

const ABAS = ["visao", "operacoes", "mapa", "insignias", "equipamentos", "fotos", "recompensas"] as const;
type Aba = (typeof ABAS)[number];
const ROTULOS: Record<Aba, string> = {
  visao: "Visão geral", operacoes: "Operações", mapa: "Mapa", insignias: "Insígnias", equipamentos: "Equipamentos", fotos: "Fotos", recompensas: "Minhas recompensas",
};

export const Route = createFileRoute("/operador/$usuarioId")({
  validateSearch: (s: Record<string, unknown>) => ({
    aba: ABAS.includes(s["aba"] as Aba) ? (s["aba"] as Aba) : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Perfil do operador — MilSim Ops" },
      { name: "description", content: "Ficha do operador: operações, mapa do Brasil, insígnias e equipamentos compartilhados." },
      { property: "og:title", content: "Perfil do operador — MilSim Ops" },
      { property: "og:description", content: "Histórico de participação em operações de airsoft e milsim." },
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
  if (q.isError) return <div className="mx-auto max-w-3xl px-4 py-10"><ErroSecao titulo="Perfil indisponível" onTentar={() => q.refetch()} /></div>;
  const p = q.data;
  if (!p) return <div className="mx-auto max-w-xl px-4 py-16"><EstadoVazio titulo="Operador não encontrado" /></div>;

  const abas = ABAS.filter((a) => a !== "recompensas" || p.proprio);
  const aba: Aba = abaUrl && abas.includes(abaUrl) ? abaUrl : "visao";
  const irPara = (a: Aba) => router.navigate({ to: "/operador/$usuarioId", params: { usuarioId }, search: { aba: a }, replace: true, resetScroll: false });

  return (
    <div className="mx-auto max-w-6xl px-4 pb-12">
      {/* Cabeçalho: ficha do operador */}
      <div className="topo-bg relative -mx-4 h-40 overflow-hidden bg-secondary sm:mx-0 sm:mt-4 sm:h-52 sm:rounded-lg">
        {p.social?.capaUrl && <img src={p.social.capaUrl} alt="" className="h-full w-full object-cover" />}
      </div>
      <div className="relative -mt-12 flex flex-wrap items-end gap-4 px-1 sm:px-4">
        {p.fotoUrl ? (
          <img src={p.fotoUrl} alt={`Foto de ${p.nome}`} className="h-28 w-28 rounded-lg border-4 border-background object-cover shadow-md" />
        ) : (
          <span aria-hidden="true" className="flex h-28 w-28 items-center justify-center rounded-lg border-4 border-background bg-primary font-display text-4xl font-semibold text-primary-foreground shadow-md">{p.nome.slice(0, 1).toUpperCase()}</span>
        )}
        <div className="min-w-0 flex-1 pb-1">
          <h1 className="flex flex-wrap items-center gap-2 font-display text-3xl font-semibold uppercase">
            {p.nome}
            {p.destaque && <span title={p.destaque.nome} className="rounded-full border border-warning bg-warning/15 px-2 py-0.5 text-sm normal-case">{p.destaque.icone} {p.destaque.nome}</span>}
          </h1>
          <p className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
            {p.social?.squad && <span className="flex items-center gap-1"><Shield className="h-4 w-4" /> {p.social.squad}</span>}
            {p.social?.instagram && <a href={`https://instagram.com/${p.social.instagram}`} target="_blank" rel="noopener noreferrer nofollow" className="flex items-center gap-1 hover:underline"><Instagram className="h-4 w-4" /> @{p.social.instagram}</a>}
          </p>
        </div>
        {p.proprio && (
          <div className="flex flex-wrap gap-2 pb-1">
            <Link to="/app/perfil" search={{ aba: "equipamentos" }}><Button>Gerenciar meu perfil</Button></Link>
            <Button variant="outline" onClick={() => setEditar(true)}><Pencil className="h-4 w-4" /> Editar perfil</Button>
            <Button variant="outline" onClick={() => setPrivacidade(true)}><Lock className="h-4 w-4" /> Privacidade</Button>
          </div>
        )}
      </div>
      {p.social?.bio && <p className="mt-3 max-w-2xl whitespace-pre-wrap px-1 text-sm sm:px-4">{p.social.bio}</p>}

      {p.restrito ? (
        <Card className="mt-6 text-center">
          <p className="font-medium">Entre na sua conta para ver o perfil completo deste operador.</p>
          <Link to="/login" search={{ redirect: `/operador/${usuarioId}` }} className="mt-3 inline-block"><Button>Entrar</Button></Link>
        </Card>
      ) : (
        <>
          <dl className="mt-5 grid grid-cols-3 gap-2 sm:max-w-lg">
            {[["Operações", p.resumo.operacoes], ["Estados", p.resumo.estados], ["Insígnias", p.resumo.insignias]].map(([r, v]) => (
              <div key={r as string} className="rounded-md border border-border bg-card px-3 py-2 text-center">
                <dt className="text-xs uppercase text-muted-foreground">{r === "Estados" ? "Estados na plataforma" : r}</dt>
                <dd className="font-display text-2xl font-semibold">{v ?? <span aria-label="privado"><Lock className="mx-auto mt-1 h-4 w-4 text-muted-foreground" /></span>}</dd>
                {r === "Estados" && p.resumo.estadosTotal !== undefined && p.resumo.estadosTotal > (p.resumo.estados ?? 0) && (
                  <dd className="text-xs text-muted-foreground">{p.resumo.estadosTotal} no total</dd>
                )}
              </div>
            ))}
          </dl>

          {p.proprio && p.completude && p.completude.percentual < 100 && (
            <div className="mt-4 rounded-md border border-border bg-elevated p-3 text-sm sm:max-w-lg">
              <p className="font-medium">Perfil {p.completude.percentual}% preenchido <span className="text-xs font-normal text-muted-foreground">(só você vê)</span></p>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-secondary"><div className="h-full bg-primary" style={{ width: `${p.completude.percentual}%` }} /></div>
              <p className="mt-1 text-xs text-muted-foreground">Sugestões: {p.completude.sugestoes.join(" · ")}. Nada disso é exigido para ganhar insígnias ou recompensas.</p>
            </div>
          )}

          {/* Abas: seletor compacto no celular, lista no computador */}
          <div className="mt-6 sm:hidden">
            <Label htmlFor="aba-perfil" className="sr-only text-[length:inherit] font-normal text-inherit">Seção do perfil</Label>
            <NativeSelect id="aba-perfil" value={aba} onChange={(e) => irPara(e.target.value as Aba)} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
              {abas.map((a) => <option key={a} value={a}>{ROTULOS[a]}</option>)}
            </NativeSelect>
          </div>
          <Tabs value={aba} onValueChange={(v) => irPara(v as typeof aba)}>
            <TabsList aria-label="Seções do perfil" className="mt-6 hidden flex-wrap gap-1 border-b border-border sm:flex">
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
                  <h2 className="font-display text-lg font-semibold uppercase">Últimas operações</h2>
                  {p.operacoes ? (p.operacoes.length ? (
                    <div className="mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{p.operacoes.slice(0, 3).map((o) => <CartaoOperacao key={o.eventoId} o={o} proprio={p.proprio} onMudou={recarregar} />)}</div>
                  ) : <div className="mt-2"><EstadoVazio titulo="Nenhuma operação concluída ainda" /></div>) : <div className="mt-2"><Restrito /></div>}
                </section>
                <section>
                  <h2 className="font-display text-lg font-semibold uppercase">Insígnias conquistadas</h2>
                  {p.insignias ? (
                    <ul className="mt-2 flex flex-wrap gap-2">
                      {p.insignias.filter((i) => i.estado === "conquistada").map((i) => (
                        <li key={i.id} className="rounded-full border border-warning bg-warning/10 px-3 py-1 text-sm">{i.icone} {i.nome}</li>
                      ))}
                      {!p.insignias.some((i) => i.estado === "conquistada") && <li className="text-sm text-muted-foreground">Nenhuma ainda.</li>}
                    </ul>
                  ) : <div className="mt-2"><Restrito /></div>}
                </section>
              </div>
            )}
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
