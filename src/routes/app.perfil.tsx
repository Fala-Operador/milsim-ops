import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { obterPerfil } from "@/api/perfil.functions";
import { MapaBrasil } from "@/components/perfil/MapaBrasil";
import { OperacoesExternas } from "@/components/perfil/OperacoesExternas";
import { AbaEquipamentos, AbaInsignias, AbaOperacoes, AbaRecompensas, Restrito } from "@/components/perfil/abas";
import { EditarPerfil, Privacidade } from "@/components/perfil/edicao";
import { CompartilharPerfil } from "@/components/perfil/CompartilharPerfil";
import { CartaoFichaEmergencia } from "@/components/perfil/FichaEmergencia";
import { NativeSelect } from "@/components/ui/native-select";
import { Campo, ErroSecao, SkeletonPagina } from "@/components/ui";

const ABAS = ["perfil", "emergencia", "equipamentos", "operacoes", "insignias", "privacidade"] as const;
type Aba = (typeof ABAS)[number];
const ROTULOS: Record<Aba, string> = { perfil: "Meu perfil", emergencia: "Ficha de emergência", equipamentos: "Meus equipamentos", operacoes: "Operações e mapa", insignias: "Insígnias e recompensas", privacidade: "Privacidade" };
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { formatarDataBR } from "@/lib/domain/money";
import { mascararCpf, mascararTelefone } from "@/lib/domain/validators";
import { NomeExibicaoForm } from "@/components/NomeExibicaoForm";
import { FotoPerfil } from "@/components/FotoPerfil";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { OpcoesModalidade, useSelecaoModalidades } from "@/components/PreferenciasModalidade";
import { usePreferencias } from "@/contexts/PreferenciasContext";
import { nomeModalidade } from "@/lib/modalidades";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

export const Route = createFileRoute("/app/perfil")({
  validateSearch: (s: Record<string, unknown>) => ({
    aba: ABAS.includes(s["aba"] as Aba) ? (s["aba"] as Aba) : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Perfil — MilSim Ops" },
      { name: "description", content: "Seus dados de perfil e preferências." },
      { property: "og:title", content: "Perfil — MilSim Ops" },
      { property: "og:description", content: "Perfil e preferências." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Perfil,
});

function Perfil() {
  const { usuario } = useAuth();
  const { aba: abaUrl } = Route.useSearch();
  const router = useRouter();
  const aba: Aba = abaUrl ?? "perfil";
  const irPara = (a: Aba) => router.navigate({ to: "/app/perfil", search: { aba: a }, replace: true, resetScroll: false });
  if (!usuario) return null;
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex min-w-0 items-center gap-4">
          {usuario.fotoUrl
            ? <img src={usuario.fotoUrl} alt="" className="size-16 rounded-lg object-cover" />
            : <span aria-hidden className="grid size-16 place-items-center rounded-lg bg-primary font-display text-3xl font-bold text-primary-foreground">{usuario.nomeCompleto.slice(0, 1).toUpperCase()}</span>}
          <div className="min-w-0">
            <h1 className="titulo-pagina">Meu perfil</h1>
            <p className="mt-1 truncate font-mono text-xs uppercase tracking-wider text-muted-foreground">{usuario.nomeCompleto} · {usuario.endereco.cidade}/{usuario.endereco.uf}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-start gap-2">
          <Link to="/operador/$usuarioId" params={{ usuarioId: usuario.id }} search={{ aba: undefined }}><Button variant="outline">Ver perfil público</Button></Link>
          <CompartilharPerfil usuarioId={usuario.id} />
        </div>
      </div>
      <div className="sm:hidden">
        <Label htmlFor="aba-meu-perfil" className="sr-only text-[length:inherit] font-normal text-inherit">Seção</Label>
        <NativeSelect id="aba-meu-perfil" value={aba} onChange={(e) => irPara(e.target.value as Aba)} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
          {ABAS.map((a) => <option key={a} value={a}>{ROTULOS[a]}</option>)}
        </NativeSelect>
      </div>
      <Tabs value={aba} onValueChange={(v) => irPara(v as typeof aba)}>
        <TabsList aria-label="Seções do meu perfil" className="hidden flex-wrap gap-1 border-b border-border sm:flex">
          {ABAS.map((a) => (
            <TabsTrigger key={a} value={a}
              className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium focus-visible:outline-2 focus-visible:outline-ring ${aba === a ? "border-accent text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
              {ROTULOS[a]}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      <div role="tabpanel" aria-label={ROTULOS[aba]}>
        {aba === "perfil" ? <DadosConta /> : aba === "emergencia" ? <CartaoFichaEmergencia ficha={usuario.fichaEmergencia} /> : <GestaoPerfil aba={aba} usuarioId={usuario.id} />}
      </div>
    </div>
  );
}

function GestaoPerfil({ aba, usuarioId }: { aba: Exclude<Aba, "perfil">; usuarioId: string }) {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["perfil-operador", usuarioId, usuarioId], queryFn: () => obterPerfil(usuarioId) });
  const recarregar = () => qc.invalidateQueries({ queryKey: ["perfil-operador", usuarioId] });
  const [editar, setEditar] = useState(false);
  const [priv, setPriv] = useState(false);
  if (q.isPending) return <SkeletonPagina />;
  if (q.isError || !q.data) return <ErroSecao titulo="Perfil indisponível" onTentar={() => q.refetch()} />;
  const p = q.data;
  if (aba === "equipamentos") return <AbaEquipamentos equipamentos={p.equipamentos} proprio onMudou={recarregar} />;
  if (aba === "operacoes") return (
    <div className="space-y-6">
      <AbaOperacoes operacoes={p.operacoes} futuras={p.futuras} proprio onMudou={recarregar} />
      {p.mapa ? <MapaBrasil operacoes={p.mapa} externas={p.externas} /> : <Restrito />}
      <OperacoesExternas externas={p.externas} proprio onMudou={recarregar} />
    </div>
  );
  if (aba === "insignias") return (
    <div className="space-y-6">
      <AbaInsignias insignias={p.insignias} />
      {p.recompensas && <section><h2 className="mb-2 font-display text-lg font-semibold uppercase">Minhas recompensas</h2><AbaRecompensas recompensas={p.recompensas} /></section>}
    </div>
  );
  return (
    <section className="border-t border-border pt-6 first:border-t-0 first:pt-0">
      <h2 className="font-display text-lg font-semibold uppercase">Privacidade do perfil</h2>
      <p className="mt-1 text-sm text-muted-foreground">Escolha o que outras pessoas veem: histórico, mapa, insígnias, equipamentos e fotos. Notas fiscais nunca são públicas.</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button onClick={() => setPriv(true)}>Configurar privacidade</Button>
        <Button variant="outline" onClick={() => setEditar(true)}>Editar perfil social</Button>
      </div>
      {priv && <Privacidade perfil={p} aberto onFechar={() => setPriv(false)} onSalvo={recarregar} />}
      {editar && <EditarPerfil perfil={p} aberto onFechar={() => setEditar(false)} onSalvo={recarregar} />}
    </section>
  );
}

function Secao({ titulo, descricao, children }: { titulo: string; descricao?: string; children: React.ReactNode }) {
  return (
    <section className="grid gap-4 border-t border-border py-6 first:border-t-0 first:pt-0 md:grid-cols-[240px_minmax(0,1fr)] md:gap-8">
      <div>
        <h2 className="font-semibold">{titulo}</h2>
        {descricao && <p className="mt-1 text-sm text-muted-foreground">{descricao}</p>}
      </div>
      <div className="min-w-0">{children}</div>
    </section>
  );
}

function DadosConta() {
  const { usuario } = useAuth();
  const { tema, definirTema } = useTheme();
  if (!usuario) return null;
  const [a, m, d] = usuario.dataNascimento.split("-");
  const dados: [string, string][] = [
    ["Nome", usuario.nomeCompleto], ["E-mail", usuario.email], ["CPF", mascararCpf(usuario.cpf)], ["Nascimento", `${d}/${m}/${a}`],
    ["WhatsApp", mascararTelefone(usuario.whatsapp)], ["Cidade", `${usuario.endereco.cidade}/${usuario.endereco.uf}`],
    ...(usuario.squad ? [["Squad", usuario.squad] as [string, string]] : []),
    ...(usuario.instagram ? [["Instagram", usuario.instagram] as [string, string]] : []),
    ["Aceite dos termos", `${usuario.aceiteTermosVersao} em ${formatarDataBR(usuario.aceiteTermosEm)}`],
  ];
  return (
    <div>
      <Secao titulo="Dados pessoais" descricao="Vêm do seu cadastro. CPF e telefone aparecem mascarados.">
        <dl className="grid border-y border-border text-sm sm:grid-cols-2">
          {dados.map(([r, v]) => (
            <div key={r} className="flex items-baseline justify-between gap-4 border-b border-border py-2.5 last:border-b-0 sm:odd:pr-6 sm:even:pl-6 sm:[&:nth-last-child(-n+2)]:border-b-0">
              <dt className="rotulo-tecnico shrink-0">{r}</dt><dd className="truncate text-right">{v}</dd>
            </div>
          ))}
        </dl>
      </Secao>
      <Secao titulo="Foto" descricao="Aparece na comunidade dos eventos e no seu perfil público.">
        <FotoPerfil />
      </Secao>
      <Secao titulo="Nome na comunidade" descricao="Como os outros operadores veem você nos fóruns.">
        <NomeExibicaoForm />
      </Secao>
      <Secao titulo="Aparência" descricao="Vale para esta conta, neste navegador.">
        <RadioGroup value={tema} onValueChange={(v) => definirTema(v as "dark" | "light")} aria-label="Aparência" className="grid max-w-md grid-cols-2 gap-3">
          {([["dark", "Escuro", "Verde-oliva", "dark"], ["light", "Claro", "TAN", "tema-claro"]] as const).map(([v, r, sub, classe]) => (
            <Label key={v} htmlFor={`tema-${v}`} className="cursor-pointer rounded-lg border p-2 font-normal has-[[data-state=checked]]:border-accent has-[[data-state=checked]]:ring-1 has-[[data-state=checked]]:ring-accent">
              <span className={`${classe} block overflow-hidden rounded-md border border-border bg-background`} aria-hidden>
                <span className="flex items-center gap-1.5 border-b border-border bg-card px-2 py-1.5"><span className="h-1.5 w-8 rounded-full bg-accent" /><span className="h-1.5 w-5 rounded-full bg-muted-foreground/40" /></span>
                <span className="block space-y-1.5 p-2"><span className="block h-2 w-3/4 rounded-sm bg-foreground/70" /><span className="block h-2 w-1/2 rounded-sm bg-muted-foreground/40" /><span className="block h-4 w-16 rounded-sm bg-primary" /></span>
              </span>
              <span className="mt-2 flex items-center gap-2 px-1"><RadioGroupItem id={`tema-${v}`} value={v} /><span className="text-sm font-medium">{r}</span><span className="text-xs text-muted-foreground">{sub}</span></span>
            </Label>
          ))}
        </RadioGroup>
      </Secao>
      <PreferenciasEventos />
    </div>
  );
}

function PreferenciasEventos() {
  const p = usePreferencias();
  const { sel, setSel, alternar } = useSelecaoModalidades([]);
  useEffect(() => { setSel(p.preferencia.modalidades); }, [p.preferencia, setSel]);
  const atual = p.preferencia.estado === "selecionadas" ? p.preferencia.modalidades.map(nomeModalidade).join(", ")
    : p.preferencia.estado === "todas" ? "Explorar todas" : "Ainda não escolhidas";
  return (
    <Secao titulo="Modalidades favoritas" descricao="Suas favoritas aparecem primeiro em “Para você”, sem esconder as demais.">
      <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Atual: {atual}</p>
      {p.montado && (
        <>
          <div className="mt-3"><OpcoesModalidade selecionadas={sel} onAlternar={alternar} nome="perfil-mod" /></div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button disabled={!sel.length} onClick={() => p.salvar(sel)}>Salvar preferências</Button>
            <Button variant="secondary" onClick={p.explorarTodas}>Explorar todas</Button>
          </div>
        </>
      )}
    </Secao>
  );
}
