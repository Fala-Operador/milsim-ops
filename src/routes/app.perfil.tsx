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
const ROTULOS: Record<Aba, string> = { get perfil() { return tr("meu_perfil"); }, get emergencia() { return tr("ficha_de_emergencia"); }, get equipamentos() { return tr("meus_equipamentos"); }, get operacoes() { return tr("operacoes_e_mapa"); }, get insignias() { return tr("insignias_e_recompensas"); }, get privacidade() { return tr("privacidade"); } };
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { formatarDataBR } from "@/lib/domain/money";
import { mascaraCep, mascararCpf, mascararTelefone } from "@/lib/domain/validators";
import { EditarDadosConta } from "@/components/perfil/EditarDadosConta";
import { Pencil } from "lucide-react";
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
import { tr } from "@/i18n/routes/app.perfil";

export const Route = createFileRoute("/app/perfil")({
  validateSearch: (s: Record<string, unknown>) => ({
    aba: ABAS.includes(s["aba"] as Aba) ? (s["aba"] as Aba) : undefined,
  }),
  head: () => ({
    meta: [
      { title: tr("perfil_milsim_ops") },
      { name: "description", content: tr("seus_dados_de_perfil_e_preferencias") },
      { property: "og:title", content: tr("perfil_milsim_ops") },
      { property: "og:description", content: tr("perfil_e_preferencias") },
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
            <h1 className="titulo-pagina">{tr("meu_perfil")}</h1>
            <p className="mt-1 truncate font-mono text-xs uppercase tracking-wider text-muted-foreground">{usuario.nomeCompleto} · {usuario.endereco.cidade}/{usuario.endereco.uf}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-start gap-2">
          <Link to="/operador/$usuarioId" params={{ usuarioId: usuario.id }} search={{ aba: undefined }}><Button variant="outline">{tr("ver_perfil_publico")}</Button></Link>
          <CompartilharPerfil usuarioId={usuario.id} />
        </div>
      </div>
      <div className="sm:hidden">
        <Label htmlFor="aba-meu-perfil" className="sr-only text-[length:inherit] font-normal text-inherit">{tr("secao")}</Label>
        <NativeSelect id="aba-meu-perfil" value={aba} onChange={(e) => irPara(e.target.value as Aba)} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
          {ABAS.map((a) => <option key={a} value={a}>{ROTULOS[a]}</option>)}
        </NativeSelect>
      </div>
      <Tabs value={aba} onValueChange={(v) => irPara(v as typeof aba)}>
        <TabsList aria-label={tr("secoes_do_meu_perfil")} className="hidden flex-wrap gap-1 border-b border-border sm:flex">
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
  if (q.isError || !q.data) return <ErroSecao titulo={tr("perfil_indisponivel")} onTentar={() => q.refetch()} />;
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
      {p.recompensas && <section><h2 className="mb-2 font-display text-lg font-semibold uppercase">{tr("minhas_recompensas")}</h2><AbaRecompensas recompensas={p.recompensas} /></section>}
    </div>
  );
  return (
    <section className="border-t border-border pt-6 first:border-t-0 first:pt-0">
      <h2 className="font-display text-lg font-semibold uppercase">{tr("privacidade_do_perfil")}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{tr("escolha_o_que_outras_pessoas_veem")}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button onClick={() => setPriv(true)}>{tr("configurar_privacidade")}</Button>
        <Button variant="outline" onClick={() => setEditar(true)}>{tr("editar_perfil_social")}</Button>
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
  const [editando, setEditando] = useState(false);
  if (!usuario) return null;
  const [a, m, d] = usuario.dataNascimento.split("-");
  const dados: [string, string][] = [
    [tr("nome"), usuario.nomeCompleto], [tr("e_mail"), usuario.email], ["CPF", mascararCpf(usuario.cpf)], [tr("nascimento"), `${d}/${m}/${a}`],
    [tr("whatsapp"), mascararTelefone(usuario.whatsapp)],
    ...(usuario.squad ? [[tr("squad"), usuario.squad] as [string, string]] : []),
    ...(usuario.instagram ? [[tr("instagram"), usuario.instagram] as [string, string]] : []),
    [tr("aceite_dos_termos"), tr("versao_em_data", { versao: usuario.aceiteTermosVersao, data: formatarDataBR(usuario.aceiteTermosEm) })],
  ];
  const end = usuario.endereco;
  const endereco = tr("logradouro_numerovalor_bairro_cidade_uf", { logradouro: end.logradouro, numero: end.numero, valor: end.complemento ? ` — ${end.complemento}` : "", bairro: end.bairro, cidade: end.cidade, uf: end.uf, cep: mascaraCep(end.cep) });
  return (
    <div>
      <Secao titulo={tr("meus_dados")} descricao={tr("vem_do_seu_cadastro_cpf_e")}>
        <div className="mb-3 flex justify-end">
          <Button variant="outline" size="sm" onClick={() => setEditando(true)}><Pencil className="h-4 w-4" aria-hidden="true" />{" "}{tr("editar_dados")}</Button>
        </div>
        <dl className="grid border-y border-border text-sm sm:grid-cols-2">
          {dados.map(([r, v]) => (
            <div key={r} className="flex items-baseline justify-between gap-4 border-b border-border py-2.5 last:border-b-0 sm:odd:pr-6 sm:even:pl-6 sm:[&:nth-last-child(-n+2)]:border-b-0">
              <dt className="rotulo-tecnico shrink-0">{r}</dt><dd className="truncate text-right">{v}</dd>
            </div>
          ))}
        </dl>
        <dl className="flex flex-col gap-1 border-b border-border py-2.5 text-sm sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
          <dt className="rotulo-tecnico shrink-0">{tr("endereco")}</dt><dd className="sm:text-right">{endereco}</dd>
        </dl>
        {editando && <EditarDadosConta usuario={usuario} aberto onFechar={() => setEditando(false)} />}
      </Secao>
      <Secao titulo={tr("foto")} descricao={tr("aparece_na_comunidade_dos_eventos_e")}>
        <FotoPerfil />
      </Secao>
      <Secao titulo={tr("nome_na_comunidade")} descricao={tr("como_os_outros_operadores_veem_voce")}>
        <NomeExibicaoForm />
      </Secao>
      <Secao titulo={tr("aparencia")} descricao={tr("vale_para_esta_conta_neste_navegador")}>
        <RadioGroup value={tema} onValueChange={(v) => definirTema(v as "dark" | "light")} aria-label={tr("aparencia")} className="grid max-w-md grid-cols-2 gap-3">
          {([["dark", tr("escuro"), tr("verde_oliva"), "dark"], ["light", tr("claro"), "TAN", "tema-claro"]] as const).map(([v, r, sub, classe]) => (
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
    : p.preferencia.estado === "todas" ? tr("explorar_todas") : tr("ainda_nao_escolhidas");
  return (
    <Secao titulo={tr("modalidades_favoritas")} descricao={tr("suas_favoritas_aparecem_primeiro_em_para")}>
      <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">{tr("atual_atual", { atual })}</p>
      {p.montado && (
        <>
          <div className="mt-3"><OpcoesModalidade selecionadas={sel} onAlternar={alternar} nome="perfil-mod" /></div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button disabled={!sel.length} onClick={() => p.salvar(sel)}>{tr("salvar_preferencias")}</Button>
            <Button variant="secondary" onClick={p.explorarTodas}>{tr("explorar_todas")}</Button>
          </div>
        </>
      )}
    </Secao>
  );
}
