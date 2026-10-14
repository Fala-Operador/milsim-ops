import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { obterPerfil } from "@/api/perfil.functions";
import { MapaBrasil } from "@/components/perfil/MapaBrasil";
import { AbaEquipamentos, AbaInsignias, AbaOperacoes, AbaRecompensas, Restrito } from "@/components/perfil/abas";
import { EditarPerfil, Privacidade } from "@/components/perfil/edicao";
import { ErroSecao, SkeletonPagina } from "@/components/ui";

const ABAS = ["perfil", "equipamentos", "operacoes", "insignias", "privacidade"] as const;
type Aba = (typeof ABAS)[number];
const ROTULOS: Record<Aba, string> = { perfil: "Meu perfil", equipamentos: "Meus equipamentos", operacoes: "Operações e mapa", insignias: "Insígnias e recompensas", privacidade: "Privacidade" };
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { formatarDataBR } from "@/lib/domain/money";
import { mascararCpf, mascararTelefone } from "@/lib/domain/validators";
import { Cartao, Selecao, Campo } from "@/components/ui";
import { NomeExibicaoForm } from "@/components/NomeExibicaoForm";
import { FotoPerfil } from "@/components/FotoPerfil";
import { useEffect } from "react";
import { Botao } from "@/components/ui";
import { OpcoesModalidade, useSelecaoModalidades } from "@/components/PreferenciasModalidade";
import { usePreferencias } from "@/contexts/PreferenciasContext";
import { nomeModalidade } from "@/lib/modalidades";

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
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="font-display text-2xl font-semibold uppercase">Meu perfil</h1>
        <Link to="/operador/$usuarioId" params={{ usuarioId: usuario.id }} search={{ aba: undefined }}><Botao variante="contorno">Ver perfil público</Botao></Link>
      </div>
      <div className="sm:hidden">
        <label htmlFor="aba-meu-perfil" className="sr-only">Seção</label>
        <select id="aba-meu-perfil" value={aba} onChange={(e) => irPara(e.target.value as Aba)} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
          {ABAS.map((a) => <option key={a} value={a}>{ROTULOS[a]}</option>)}
        </select>
      </div>
      <div role="tablist" aria-label="Seções do meu perfil" className="hidden flex-wrap gap-1 border-b border-border sm:flex">
        {ABAS.map((a) => (
          <button key={a} role="tab" type="button" aria-selected={aba === a} onClick={() => irPara(a)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium focus-visible:outline-2 focus-visible:outline-ring ${aba === a ? "border-accent text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
            {ROTULOS[a]}
          </button>
        ))}
      </div>
      <div role="tabpanel" aria-label={ROTULOS[aba]}>
        {aba === "perfil" ? <DadosConta /> : <GestaoPerfil aba={aba} usuarioId={usuario.id} />}
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
      {p.mapa ? <MapaBrasil operacoes={p.mapa} /> : <Restrito />}
    </div>
  );
  if (aba === "insignias") return (
    <div className="space-y-6">
      <AbaInsignias insignias={p.insignias} />
      {p.recompensas && <section><h2 className="mb-2 font-display text-lg font-semibold uppercase">Minhas recompensas</h2><AbaRecompensas recompensas={p.recompensas} /></section>}
    </div>
  );
  return (
    <Cartao>
      <h2 className="font-display text-lg font-semibold uppercase">Privacidade do perfil</h2>
      <p className="mt-1 text-sm text-muted-foreground">Escolha o que outras pessoas veem: histórico, mapa, insígnias, equipamentos e fotos. Notas fiscais nunca são públicas.</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Botao onClick={() => setPriv(true)}>Configurar privacidade</Botao>
        <Botao variante="contorno" onClick={() => setEditar(true)}>Editar perfil social</Botao>
      </div>
      {priv && <Privacidade perfil={p} aberto onFechar={() => setPriv(false)} onSalvo={recarregar} />}
      {editar && <EditarPerfil perfil={p} aberto onFechar={() => setEditar(false)} onSalvo={recarregar} />}
    </Cartao>
  );
}

function DadosConta() {
  const { usuario } = useAuth();
  const { tema, definirTema } = useTheme();
  if (!usuario) return null;
  const [a, m, d] = usuario.dataNascimento.split("-");
  return (
    <div className="space-y-4">
      <Cartao>
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div><dt className="text-muted-foreground">Nome</dt><dd>{usuario.nomeCompleto}</dd></div>
          <div><dt className="text-muted-foreground">E-mail</dt><dd>{usuario.email}</dd></div>
          <div><dt className="text-muted-foreground">CPF</dt><dd>{mascararCpf(usuario.cpf)}</dd></div>
          <div><dt className="text-muted-foreground">Nascimento</dt><dd>{`${d}/${m}/${a}`}</dd></div>
          <div><dt className="text-muted-foreground">WhatsApp</dt><dd>{mascararTelefone(usuario.whatsapp)}</dd></div>
          <div><dt className="text-muted-foreground">Cidade</dt><dd>{usuario.endereco.cidade}/{usuario.endereco.uf}</dd></div>
          {usuario.squad && <div><dt className="text-muted-foreground">Squad</dt><dd>{usuario.squad}</dd></div>}
          {usuario.instagram && <div><dt className="text-muted-foreground">Instagram</dt><dd>{usuario.instagram}</dd></div>}
          <div><dt className="text-muted-foreground">Aceite dos termos</dt><dd>{usuario.aceiteTermosVersao} em {formatarDataBR(usuario.aceiteTermosEm)}</dd></div>
        </dl>
      </Cartao>
      <Cartao>
        <h2 className="font-display text-lg font-semibold uppercase">Foto</h2>
        <div className="mt-3"><FotoPerfil /></div>
      </Cartao>
      <Cartao>
        <h2 className="font-display text-lg font-semibold uppercase">Configurações</h2>
        <div className="mt-3"><NomeExibicaoForm /></div>
        <div className="mt-3 max-w-xs">
          <Campo rotulo="Aparência" htmlFor="tema">
            <Selecao id="tema" value={tema} onChange={(e) => definirTema(e.target.value as "dark" | "light")}>
              <option value="dark">Escuro — Verde-oliva</option>
              <option value="light">Claro — TAN</option>
            </Selecao>
          </Campo>
        </div>
      </Cartao>
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
    <Cartao>
      <h2 className="font-display text-lg font-semibold uppercase">Preferências de eventos</h2>
      <p className="mt-1 text-sm text-muted-foreground">Atual: {atual}. Suas favoritas aparecem primeiro em “Para você”, sem esconder as demais. Salvo nesta conta, neste navegador.</p>
      {p.montado && (
        <>
          <div className="mt-3"><OpcoesModalidade selecionadas={sel} onAlternar={alternar} nome="perfil-mod" /></div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Botao disabled={!sel.length} onClick={() => p.salvar(sel)}>Salvar preferências</Botao>
            <Botao variante="secundario" onClick={p.explorarTodas}>Explorar todas</Botao>
          </div>
        </>
      )}
    </Cartao>
  );
}
