import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, GripVertical, MoreHorizontal } from "lucide-react";
import { carregarBase } from "@/services/db";
import { useVersaoBase } from "@/hooks/useVersaoBase";
import { useAuth } from "@/contexts/AuthContext";
import type {
  Abrangencia, BaseDados, DestaqueEvento, LinkParceiro, Parceiro, SecaoInicial, TipoSecao,
} from "@/lib/domain/types";
import {
  NACIONAL, REGIOES, UF_REGIAO, eventoElegivel, erroDoLink, hrefDoLink, linksPendentes, montarPaginaInicial, rotuloAbrangencia, rotuloDoLink,
} from "@/lib/divulgacao";
import type { DadosParceiro, DadosSecao } from "@/services/divulgacao";
import {
  alterarStatusSecao, excluirParceiro, excluirSecao, reordenarSecoes, salvarParceiro, salvarSecao,
} from "@/api/divulgacao.functions";
import { arquivoParaDataUrl } from "@/lib/imagens";
import { SecoesPublicas, SeletorLocalizacao } from "@/components/divulgacao";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { Campo, EstadoVazio, Modal, SkeletonPagina } from "@/components/ui";
import { gerarId } from "@/services/db";
import { GestaoImpulsionamentos } from "@/components/impulsionamentos";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { tr } from "@/i18n/routes/admin.divulgacao";

export const Route = createFileRoute("/admin/divulgacao")({
  head: () => ({
    meta: [
      { title: tr("pagina_inicial_e_divulgacao_milsim_ops") },
      { name: "description", content: tr("configure_secoes_destaques_regionais_pat") },
      { property: "og:title", content: tr("pagina_inicial_e_divulgacao_milsim_ops") },
      { property: "og:description", content: tr("gestao_administrativa_da_pagina_inicial") },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  validateSearch: (s: Record<string, unknown>): { aba?: "secoes" | "parceiros" | "impulsionamentos" | undefined; evento?: string | undefined } => ({
    aba: s["aba"] === "parceiros" || s["aba"] === "impulsionamentos" ? s["aba"] : undefined,
    evento: typeof s["evento"] === "string" ? s["evento"] : undefined,
  }),
  component: PaginaDivulgacao,
});

const ROTULO_TIPO: Record<TipoSecao, string> = {
  get destaques() { return tr("operacoes_em_destaque"); }, get regional() { return tr("eventos_por_regiao"); }, get patrocinadores() { return tr("patrocinadores"); },
  get apoiadores() { return tr("apoiadores"); }, get banner() { return tr("banner_promocional"); },
};
const UFS = Object.keys(UF_REGIAO).sort();
const paraLocal = (iso?: string) => (iso ? new Date(new Date(iso).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : "");
const deLocal = (v: string) => (v ? new Date(v).toISOString() : undefined);
const tomStatus = { rascunho: "warning", publicada: "success", desativada: "secondary" } as const;

function PaginaDivulgacao() {
  const versao = useVersaoBase();
  const [base, setBase] = useState<BaseDados | null>(null);
  const pesquisa = Route.useSearch();
  const [aba, setAba] = useState<"secoes" | "parceiros" | "impulsionamentos">(pesquisa.aba ?? "secoes");
  useEffect(() => setBase(structuredClone(carregarBase())), [versao]);
  if (!base) return <SkeletonPagina />;
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="titulo-pagina">{tr("pagina_inicial_e_divulgacao")}</h2>
          <p className="subtitulo-pagina">{tr("agendamentos_sao_aplicados_sempre_que_a")}</p>
        </div>
        <Tabs value={aba} onValueChange={(v) => setAba(v as typeof aba)}>
          <TabsList className="flex-wrap gap-2">
            <TabsTrigger value="secoes" asChild><Button variant={aba === "secoes" ? "default" : "outline"}>{tr("secoes")}</Button></TabsTrigger>
            <TabsTrigger value="parceiros" asChild><Button variant={aba === "parceiros" ? "default" : "outline"}>{tr("parceiros")}</Button></TabsTrigger>
            <TabsTrigger value="impulsionamentos" asChild><Button variant={aba === "impulsionamentos" ? "default" : "outline"}>{tr("impulsionamentos")}</Button></TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
      <div className="mt-4">
        {aba === "secoes" ? <GestaoSecoes base={base} />
          : aba === "parceiros" ? <GestaoParceiros base={base} />
          : (
            <div className="space-y-6">
              <p className="text-sm text-muted-foreground">{tr("preco_validade_e_imagem_dos_impulsos")}{" "}<Link to="/admin/loja" hash="impulsos" className="underline">{tr("loja_da_plataforma")}</Link>.
              </p>
              <GestaoImpulsionamentos base={base} eventoInicial={pesquisa.evento} irParaSecoes={() => setAba("secoes")} />
            </div>
          )}
      </div>
    </div>
  );
}

// ================= Seções =================
function GestaoSecoes({ base }: { base: BaseDados }) {
  const { usuario } = useAuth();
  const ordenadas = base.secoesInicio.slice().sort((a, b) => a.ordem - b.ordem);
  const [editando, setEditando] = useState<DadosSecao | null>(null);
  const [previa, setPrevia] = useState(false);
  const [arrastando, setArrastando] = useState<string | null>(null);
  const [excluir, setExcluir] = useState<SecaoInicial | null>(null);

  const mover = (de: number, para: number) => {
    if (para < 0 || para >= ordenadas.length) return;
    const ids = ordenadas.map((s) => s.id);
    const [x] = ids.splice(de, 1);
    if (!x) return;
    ids.splice(para, 0, x);
    reordenarSecoes(ids);
  };

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => setEditando(secaoVazia("destaques"))}>{tr("nova_secao")}</Button>
        <Button variant="outline" onClick={() => setPrevia(true)}>{tr("previa_da_pagina")}</Button>
      </div>
      <ul className="mt-4 divide-y divide-border border-y border-border" aria-label={tr("secoes_da_pagina_inicial_arraste_para")}>
        {ordenadas.map((s, i) => (
          <li key={s.id} draggable
            onDragStart={() => setArrastando(s.id)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => { if (arrastando) mover(ordenadas.findIndex((x) => x.id === arrastando), i); setArrastando(null); }}
            className={`flex flex-wrap items-center gap-x-3 gap-y-2 py-3 ${arrastando === s.id ? "opacity-50" : ""}`}>
            <GripVertical className="hidden h-4 w-4 shrink-0 cursor-grab text-muted-foreground sm:block" aria-hidden />
            <span className="w-5 shrink-0 font-mono text-xs text-muted-foreground">{i + 1}</span>
            <div className="min-w-0 flex-1">
              <p className="font-medium">{s.titulo}</p>
              <p className="text-xs text-muted-foreground">
                {ROTULO_TIPO[s.tipo]} · {rotuloAbrangencia(s.abrangencia)} · {s.layout}
                {s.tipo === "destaques" || s.tipo === "regional" ? ` · ${s.modo === "manual" ? tr("length_destaques", { length: s.destaques.length }) : tr("automatica")}` : ""}
                {s.agendamento.inicioEm || s.agendamento.fimEm ? ` ${tr("agendada")}` : ""}
              </p>
            </div>
            <Badge variant={tomStatus[s.status]}>{s.status}</Badge>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" aria-label={tr("mover_titulo_para_cima", { titulo: s.titulo })} disabled={i === 0} onClick={() => mover(i, i - 1)}><ArrowUp className="h-4 w-4" /></Button>
              <Button variant="ghost" size="icon" aria-label={tr("mover_titulo_para_baixo", { titulo: s.titulo })} disabled={i === ordenadas.length - 1} onClick={() => mover(i, i + 1)}><ArrowDown className="h-4 w-4" /></Button>
              <Button variant="outline" size="sm" onClick={() => setEditando(structuredClone(s))}>{tr("editar")}</Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" aria-label={tr("mais_acoes_de_titulo", { titulo: s.titulo })}><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {s.status !== "publicada"
                    ? <DropdownMenuItem onSelect={() => alterarStatusSecao(s.id, "publicada")}>{tr("publicar")}</DropdownMenuItem>
                    : <DropdownMenuItem onSelect={() => alterarStatusSecao(s.id, "desativada")}>{tr("desativar")}</DropdownMenuItem>}
                  <DropdownMenuItem className="text-destructive" onSelect={() => setExcluir(s)}>{tr("excluir")}</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </li>
        ))}
      </ul>
      {ordenadas.length === 0 && <EstadoVazio titulo={tr("nenhuma_secao_criada")} />}

      {editando && <EditorSecao base={base} inicial={editando} onFechar={() => setEditando(null)} />}
      <Previa base={base} aberto={previa} onFechar={() => setPrevia(false)} />
      <Modal aberto={!!excluir} titulo={tr("excluir_secao")} onFechar={() => setExcluir(null)}>
        <p className="text-sm text-muted-foreground">{tr("a_secao_titulo_sera_removida_eventos", { titulo: excluir?.titulo })}</p>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setExcluir(null)}>{tr("voltar")}</Button>
          <Button variant="destructive" onClick={async () => { await excluirSecao(excluir!.id); setExcluir(null); }}>{tr("excluir")}</Button>
        </div>
      </Modal>
    </div>
  );
}

function secaoVazia(tipo: TipoSecao): DadosSecao {
  return {
    titulo: "", tipo, abrangencia: NACIONAL, status: "rascunho", agendamento: {},
    layout: tipo === "banner" ? "banner" : "grade", modo: "manual", destaques: [], mostrarEsgotados: true,
    automatica: { abrangencia: NACIONAL, maximo: 6, incluirEsgotados: true, ordenacao: "data" },
    parceiros: [], tamanhoLogo: "m", mostrarDescricoes: false, superficieLogo: "clara",
    banner: tipo === "banner" ? { textoAlt: "" } : undefined,
  };
}

function EditorAbrangencia({ valor, onMudar, rotulo }: { valor: Abrangencia; onMudar: (a: Abrangencia) => void; rotulo: string }) {
  return (
    <fieldset className="grid gap-2 sm:grid-cols-3">
      <legend className="mb-1 text-sm font-medium">{rotulo}</legend>
      <NativeSelect aria-label={tr("rotulo_escopo", { rotulo })} value={valor.escopo} onChange={(e) => {
        const escopo = e.target.value as Abrangencia["escopo"];
        onMudar(escopo === "nacional" ? NACIONAL : { escopo, regiao: "Sudeste", uf: "SP", cidade: escopo === "cidade" ? "São Paulo" : undefined });
      }}>
        <option value="nacional">{tr("nacional")}</option><option value="regiao">{tr("regiao")}</option>
        <option value="estado">{tr("estado")}</option><option value="cidade">{tr("cidade")}</option>
      </NativeSelect>
      {valor.escopo === "regiao" && (
        <NativeSelect aria-label={tr("rotulo_regiao", { rotulo })} value={valor.regiao} onChange={(e) => onMudar({ escopo: "regiao", regiao: e.target.value as Abrangencia["regiao"] })}>
          {REGIOES.map((r) => <option key={r}>{r}</option>)}
        </NativeSelect>
      )}
      {(valor.escopo === "estado" || valor.escopo === "cidade") && (
        <NativeSelect aria-label={tr("rotulo_estado", { rotulo })} value={valor.uf} onChange={(e) => onMudar({ ...valor, regiao: undefined, uf: e.target.value })}>
          {UFS.map((u) => <option key={u}>{u}</option>)}
        </NativeSelect>
      )}
      {valor.escopo === "cidade" && (
        <Input aria-label={tr("rotulo_cidade", { rotulo })} value={valor.cidade ?? ""} onChange={(e) => onMudar({ ...valor, cidade: e.target.value })} placeholder={tr("cidade")} />
      )}
    </fieldset>
  );
}

function EditorSecao({ base, inicial, onFechar }: { base: BaseDados; inicial: DadosSecao; onFechar: () => void }) {
  const { usuario } = useAuth();
  const [d, setD] = useState<DadosSecao>(inicial);
  const [erro, setErro] = useState("");
  const set = (p: Partial<DadosSecao>) => setD((x) => ({ ...x, ...p }));
  const ehEventos = d.tipo === "destaques" || d.tipo === "regional";
  const ehParceiros = d.tipo === "patrocinadores" || d.tipo === "apoiadores";
  const elegiveis = base.eventos.filter((e) => eventoElegivel(e, new Date()));
  const setDestaque = (i: number, p: Partial<DestaqueEvento>) =>
    set({ destaques: d.destaques.map((x, j) => (j === i ? { ...x, ...p } : x)) });
  const auto = d.automatica ?? { abrangencia: NACIONAL, maximo: 6, incluirEsgotados: true, ordenacao: "data" as const };

  const salvar = async (status?: SecaoInicial["status"]) => {
    setErro("");
    try {
      await salvarSecao({ ...d, status: status ?? d.status });
      onFechar();
    } catch (e) { setErro((e as Error).message); }
  };

  return (
    <Modal aberto titulo={d.id ? tr("editar_secao") : tr("nova_secao")} onFechar={onFechar}>
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Campo htmlFor="sec-titulo" rotulo={tr("titulo")}><Input id="sec-titulo" value={d.titulo} onChange={(e) => set({ titulo: e.target.value })} /></Campo>
          <Campo htmlFor="sec-sub" rotulo={tr("subtitulo_opcional")}><Input id="sec-sub" value={d.subtitulo ?? ""} onChange={(e) => set({ subtitulo: e.target.value || undefined })} /></Campo>
          <Campo htmlFor="sec-tipo" rotulo={tr("tipo")}>
            <NativeSelect id="sec-tipo" value={d.tipo} disabled={!!d.id} onChange={(e) => { const t = e.target.value as TipoSecao; setD({ ...secaoVazia(t), titulo: d.titulo }); }}>
              {Object.entries(ROTULO_TIPO).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </NativeSelect>
          </Campo>
          <Campo htmlFor="sec-layout" rotulo={tr("layout")}>
            <NativeSelect id="sec-layout" value={d.layout} onChange={(e) => set({ layout: e.target.value as SecaoInicial["layout"] })}>
              {d.tipo === "banner" ? <option value="banner">{tr("banner")}</option> : <><option value="grade">{tr("grade")}</option><option value="carrossel">{tr("carrossel")}</option></>}
            </NativeSelect>
          </Campo>
        </div>
        <EditorAbrangencia rotulo={tr("abrangencia")} valor={d.abrangencia} onMudar={(a) => set({ abrangencia: a })} />
        <div className="grid gap-3 sm:grid-cols-2">
          <Campo htmlFor="sec-ini" rotulo={tr("inicio_da_exibicao_opcional")}><Input id="sec-ini" type="datetime-local" value={paraLocal(d.agendamento.inicioEm)} onChange={(e) => set({ agendamento: { ...d.agendamento, inicioEm: deLocal(e.target.value) } })} /></Campo>
          <Campo htmlFor="sec-fim" rotulo={tr("termino_da_exibicao_opcional")}><Input id="sec-fim" type="datetime-local" value={paraLocal(d.agendamento.fimEm)} onChange={(e) => set({ agendamento: { ...d.agendamento, fimEm: deLocal(e.target.value) } })} /></Campo>
        </div>

        {ehEventos && (
          <div className="space-y-3 rounded-lg border border-border p-3">
            <div className="flex flex-wrap gap-3 text-sm">
              <RadioGroup className="contents" value={d.modo} onValueChange={(modo) => set(modo === "manual" ? { modo: "manual" } : { modo: "automatico", automatica: auto })}>
                <Label className="flex items-center gap-1 text-[length:inherit] font-normal text-inherit"><RadioGroupItem value="manual" />{" "}{tr("curadoria_manual")}</Label>
                <Label className="flex items-center gap-1 text-[length:inherit] font-normal text-inherit"><RadioGroupItem value="automatico" />{" "}{tr("selecao_automatica")}</Label>
              </RadioGroup>
              <Label className="flex items-center gap-1 text-[length:inherit] font-normal text-inherit"><Checkbox checked={d.mostrarEsgotados} onCheckedChange={(marcado) => set({ mostrarEsgotados: marcado === true })} />{" "}{tr("manter_esgotados_visiveis")}</Label>
            </div>
            {d.modo === "manual" ? (
              <div className="space-y-3">
                {d.destaques.sort((a, b) => a.posicao - b.posicao).map((x, i) => (
                  <div key={x.id} className="grid gap-2 rounded-md border border-border p-2 sm:grid-cols-2">
                    <NativeSelect aria-label={tr("evento")} value={x.eventoId} onChange={(e) => setDestaque(i, { eventoId: e.target.value })}>
                      {base.eventos.filter((e) => eventoElegivel(e, new Date()) || e.id === x.eventoId).map((e) => (
                        <option key={e.id} value={e.id}>{e.nome} — {e.cidade}/{e.uf}{eventoElegivel(e, new Date()) ? "" : ` ${tr("fora_da_divulgacao")}`}</option>
                      ))}
                    </NativeSelect>
                    <Input aria-label={tr("posicao")} type="number" min={1} value={x.posicao} onChange={(e) => setDestaque(i, { posicao: Number(e.target.value) })} />
                    <Input aria-label={tr("selo")} placeholder={tr("selo_ex_destaque_da_semana")} value={x.selo ?? ""} onChange={(e) => setDestaque(i, { selo: e.target.value || undefined })} />
                    <Input aria-label={tr("chamada_curta")} placeholder={tr("chamada_curta")} maxLength={90} value={x.chamada ?? ""} onChange={(e) => setDestaque(i, { chamada: e.target.value || undefined })} />
                    <Input aria-label={tr("inicio_da_divulgacao")} type="datetime-local" value={paraLocal(x.agendamento.inicioEm)} onChange={(e) => setDestaque(i, { agendamento: { ...x.agendamento, inicioEm: deLocal(e.target.value) } })} />
                    <Input aria-label={tr("termino_da_divulgacao")} type="datetime-local" value={paraLocal(x.agendamento.fimEm)} onChange={(e) => setDestaque(i, { agendamento: { ...x.agendamento, fimEm: deLocal(e.target.value) } })} />
                    <div className="flex flex-wrap items-center gap-2 text-xs sm:col-span-2">
                      <Label className="cursor-pointer rounded-md border border-border px-2 py-1 text-[length:inherit] font-normal text-inherit">
                        {x.imagemPromocional ? tr("trocar_imagem_promocional") : tr("imagem_promocional_opcional")}
                        <input type="file" accept="image/*" className="sr-only" onChange={async (e) => {
                          const f = e.target.files?.[0]; if (!f) return;
                          try { setDestaque(i, { imagemPromocional: await arquivoParaDataUrl(f, 960) }); } catch (er) { setErro((er as Error).message); }
                        }} />
                      </Label>
                      {x.imagemPromocional && <Button variant="ghost" onClick={() => setDestaque(i, { imagemPromocional: undefined })}>{tr("usar_imagem_original")}</Button>}
                      <Button variant="ghost" className="ml-auto" onClick={() => set({ destaques: d.destaques.filter((_, j) => j !== i) })}>{tr("remover_destaque")}</Button>
                    </div>
                  </div>
                ))}
                <Button variant="outline" disabled={!elegiveis.length} onClick={() => set({
                  destaques: [...d.destaques, { id: gerarId("dst"), eventoId: elegiveis[0]!.id, posicao: d.destaques.length + 1, agendamento: {} }],
                })}>{tr("adicionar_evento")}</Button>
                <p className="text-xs text-muted-foreground">{tr("nome_data_local_vagas_e_preco")}</p>
              </div>
            ) : (
              <div className="space-y-3">
                <EditorAbrangencia rotulo={tr("filtrar_eventos_por")} valor={auto.abrangencia} onMudar={(a) => set({ automatica: { ...auto, abrangencia: a } })} />
                <div className="grid gap-3 sm:grid-cols-3">
                  <Campo htmlFor="au-per" rotulo={tr("proximos_dias_vazio_todos")}><Input id="au-per" type="number" min={1} value={auto.periodoDias ?? ""} onChange={(e) => set({ automatica: { ...auto, periodoDias: e.target.value ? Number(e.target.value) : undefined } })} /></Campo>
                  <Campo htmlFor="au-max" rotulo={tr("maximo_de_cards")}><Input id="au-max" type="number" min={1} value={auto.maximo} onChange={(e) => set({ automatica: { ...auto, maximo: Number(e.target.value) } })} /></Campo>
                  <Campo htmlFor="au-ord" rotulo={tr("ordenacao")}>
                    <NativeSelect id="au-ord" value={auto.ordenacao} onChange={(e) => set({ automatica: { ...auto, ordenacao: e.target.value as "data" | "recentes" } })}>
                      <option value="data">{tr("data_mais_proxima")}</option><option value="recentes">{tr("publicacao_mais_recente")}</option>
                    </NativeSelect>
                  </Campo>
                </div>
                <Label className="flex items-center gap-2 text-sm font-normal text-inherit"><Checkbox checked={auto.incluirEsgotados} onCheckedChange={(marcado) => set({ automatica: { ...auto, incluirEsgotados: marcado === true } })} />{" "}{tr("incluir_eventos_esgotados")}</Label>
              </div>
            )}
          </div>
        )}

        {ehParceiros && (
          <div className="space-y-3 rounded-lg border border-border p-3">
            <p className="text-sm font-medium">{tr("parceiros_marque_e_defina_a_ordem")}</p>
            {base.parceiros.filter((p) => p.tipo === "ambos" || p.tipo === (d.tipo === "patrocinadores" ? "patrocinador" : "apoiador")).map((p) => {
              const item = d.parceiros.find((i) => i.parceiroId === p.id);
              return (
                <div key={p.id} className="flex items-center gap-2 text-sm">
                  <Checkbox id={`sp-${p.id}`} checked={!!item} onCheckedChange={(marcado) => set({
                    parceiros: marcado === true ? [...d.parceiros, { parceiroId: p.id, posicao: d.parceiros.length + 1 }] : d.parceiros.filter((i) => i.parceiroId !== p.id),
                  })} />
                  <Label htmlFor={`sp-${p.id}`} className="flex-1 text-[length:inherit] font-normal text-inherit">{p.nome}{!p.ativo && ` ${tr("inativo")}`}</Label>
                  {item && <Input aria-label={tr("posicao_de_nome", { nome: p.nome })} type="number" min={1} className="!w-20" value={item.posicao} onChange={(e) => set({
                    parceiros: d.parceiros.map((i) => (i.parceiroId === p.id ? { ...i, posicao: Number(e.target.value) } : i)),
                  })} />}
                </div>
              );
            })}
            <div className="grid gap-3 sm:grid-cols-3">
              <Campo htmlFor="sp-tam" rotulo={tr("tamanho_dos_logos")}>
                <NativeSelect id="sp-tam" value={d.tamanhoLogo} onChange={(e) => set({ tamanhoLogo: e.target.value as "p" | "m" | "g" })}>
                  <option value="p">{tr("pequeno")}</option><option value="m">{tr("medio")}</option><option value="g">{tr("grande")}</option>
                </NativeSelect>
              </Campo>
              <Campo htmlFor="sp-sup" rotulo={tr("superficie_atras_do_logo")}>
                <NativeSelect id="sp-sup" value={d.superficieLogo} onChange={(e) => set({ superficieLogo: e.target.value as SecaoInicial["superficieLogo"] })}>
                  <option value="nenhuma">{tr("nenhuma")}</option><option value="clara">{tr("neutra_clara")}</option><option value="escura">{tr("neutra_escura")}</option>
                </NativeSelect>
              </Campo>
              <Label className="flex items-center gap-2 pt-6 text-sm font-normal text-inherit"><Checkbox checked={d.mostrarDescricoes} onCheckedChange={(marcado) => set({ mostrarDescricoes: marcado === true })} />{" "}{tr("mostrar_descricoes")}</Label>
            </div>
          </div>
        )}

        {d.tipo === "banner" && <EditorBanner base={base} d={d} set={set} setErro={setErro} />}

        {erro && <p role="alert" className="text-sm text-destructive">{erro}</p>}
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="ghost" onClick={onFechar}>{tr("cancelar")}</Button>
          <Button variant="outline" onClick={() => salvar("rascunho")}>{tr("salvar_rascunho")}</Button>
          <Button onClick={() => salvar("publicada")}>{tr("salvar_e_publicar")}</Button>
        </div>
      </div>
    </Modal>
  );
}

function EditorBanner({ base, d, set, setErro }: { base: BaseDados; d: DadosSecao; set: (p: Partial<DadosSecao>) => void; setErro: (s: string) => void }) {
  const b = d.banner ?? { textoAlt: "" };
  const up = (p: Partial<typeof b>) => set({ banner: { ...b, ...p } });
  const imagem = (campo: "imagemDesktop" | "imagemCelular", rotulo: string) => (
    <Label className="block cursor-pointer rounded-md border border-dashed border-border p-2 text-center text-xs font-normal text-inherit">
      {b[campo] ? <img src={b[campo]} alt="" className="mx-auto h-16 object-contain" /> : rotulo}
      <input type="file" accept="image/*" className="sr-only" onChange={async (e) => {
        const f = e.target.files?.[0]; if (!f) return;
        try { up({ [campo]: await arquivoParaDataUrl(f, 1600) }); } catch (er) { setErro((er as Error).message); }
      }} />
    </Label>
  );
  return (
    <div className="space-y-3 rounded-lg border border-border p-3">
      <div className="grid gap-3 sm:grid-cols-2">{imagem("imagemDesktop", tr("imagem_para_desktop"))}{imagem("imagemCelular", tr("imagem_para_celular_opcional"))}</div>
      <Campo htmlFor="bn-alt" rotulo={tr("texto_alternativo")}><Input id="bn-alt" value={b.textoAlt} onChange={(e) => up({ textoAlt: e.target.value })} /></Campo>
      <Label className="flex items-center gap-2 text-sm font-normal text-inherit">
        <Checkbox checked={!!d.naComunidade} onCheckedChange={(marcado) => set({ naComunidade: marcado === true || undefined })} />{tr("exibir_tambem_na_lateral_da_comunidade")}</Label>
      <div className="grid gap-3 sm:grid-cols-2">
        <Campo htmlFor="bn-cha" rotulo={tr("chamada_opcional")}><Input id="bn-cha" value={b.chamada ?? ""} onChange={(e) => up({ chamada: e.target.value || undefined })} /></Campo>
        <Campo htmlFor="bn-bot" rotulo={tr("texto_do_botao")}><Input id="bn-bot" value={b.textoBotao ?? ""} onChange={(e) => up({ textoBotao: e.target.value || undefined })} /></Campo>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Campo htmlFor="bn-dt" rotulo={tr("destino_opcional")}>
          <NativeSelect id="bn-dt" value={b.destino?.tipo ?? ""} onChange={(e) => {
            const t = e.target.value;
            up({ destino: t ? ({ tipo: t, valor: "" } as NonNullable<typeof b.destino>) : undefined });
          }}>
            <option value="">{tr("sem_destino_nao_clicavel")}</option><option value="evento">{tr("evento_interno")}</option>
            <option value="secao">{tr("secao_interna")}</option><option value="parceiro">{tr("parceiro_cadastrado")}</option><option value="externo">{tr("link_externo")}</option>
          </NativeSelect>
        </Campo>
        {b.destino && (
          <Campo htmlFor="bn-dv" rotulo={tr("alvo")}>
            {b.destino.tipo === "externo" ? (
              <Input id="bn-dv" placeholder="https://..." value={b.destino.valor} onChange={(e) => up({ destino: { tipo: "externo", valor: e.target.value } })} />
            ) : (
              <NativeSelect id="bn-dv" value={b.destino.valor} onChange={(e) => up({ destino: { ...b.destino!, valor: e.target.value } as NonNullable<typeof b.destino> })}>
                <option value="">{tr("selecione")}</option>
                {(b.destino.tipo === "evento" ? base.eventos.filter((e) => eventoElegivel(e, new Date())).map((e) => [e.id, e.nome])
                  : b.destino.tipo === "secao" ? base.secoesInicio.filter((s) => s.id !== d.id).map((s) => [s.id, s.titulo])
                  : base.parceiros.map((p) => [p.id, p.nome])).map(([v, r]) => <option key={v} value={v}>{r}</option>)}
              </NativeSelect>
            )}
          </Campo>
        )}
      </div>
      <p className="text-xs text-muted-foreground">{tr("evite_texto_essencial_dentro_da_imagem")}</p>
    </div>
  );
}

// ================= Prévia =================
function Previa({ base, aberto, onFechar }: { base: BaseDados; aberto: boolean; onFechar: () => void }) {
  const [celular, setCelular] = useState(false);
  const [tema, setTema] = useState<"escuro" | "claro">("escuro");
  const [local, setLocal] = useState<Abrangencia>(NACIONAL);
  const [data, setData] = useState(paraLocal(new Date().toISOString()));
  const [rascunhos, setRascunhos] = useState(true);
  const secoes = montarPaginaInicial(base, local, data ? new Date(data) : new Date(), { incluirRascunhos: rascunhos });
  return (
    <Modal aberto={aberto} titulo={tr("previa_da_pagina_inicial")} onFechar={onFechar} largo>
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex gap-1">
          <Button variant={!celular ? "default" : "outline"} onClick={() => setCelular(false)}>{tr("desktop")}</Button>
          <Button variant={celular ? "default" : "outline"} onClick={() => setCelular(true)}>{tr("celular")}</Button>
        </div>
        <div className="flex gap-1">
          <Button variant={tema === "escuro" ? "default" : "outline"} onClick={() => setTema("escuro")}>{tr("tema_escuro")}</Button>
          <Button variant={tema === "claro" ? "default" : "outline"} onClick={() => setTema("claro")}>{tr("tema_claro")}</Button>
        </div>
        <Label className="text-sm font-normal text-inherit"><span className="mb-1 block text-xs text-muted-foreground">{tr("data_e_horario_simulados")}</span>
          <Input type="datetime-local" value={data} onChange={(e) => setData(e.target.value)} /></Label>
        <Label className="flex items-center gap-2 text-sm font-normal text-inherit"><Checkbox checked={rascunhos} onCheckedChange={(marcado) => setRascunhos(marcado === true)} />{" "}{tr("incluir_rascunhos")}</Label>
      </div>
      <div className="mt-3"><SeletorLocalizacao base={base} valor={local} onMudar={setLocal} /></div>
      <div className={`mx-auto mt-4 rounded-lg border border-border bg-background p-4 text-foreground ${tema === "claro" ? "tema-claro" : "tema-escuro"} ${celular ? "max-w-[390px]" : ""}`}>
        {secoes.length ? <SecoesPublicas secoes={secoes} base={base} local={local} celular={celular} />
          : <EstadoVazio titulo={tr("nenhuma_secao_visivel")} descricao={tr("secoes_vazias_fora_do_periodo_ou")} />}
      </div>
    </Modal>
  );
}

// ================= Parceiros =================
function parceiroVazio(): DadosParceiro {
  return { nome: "", tipo: "patrocinador", textoAlt: "", links: [], ativo: true };
}

function GestaoParceiros({ base }: { base: BaseDados }) {
  const { usuario } = useAuth();
  const [editando, setEditando] = useState<DadosParceiro | null>(null);
  return (
    <div>
      <Button onClick={() => setEditando(parceiroVazio())}>{tr("novo_parceiro")}</Button>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {base.parceiros.map((p) => (
          <Card key={p.id}>
            <div className="flex flex-wrap items-center gap-3">
              {p.logoUrl ? <img src={p.logoUrl} alt={p.textoAlt} className="h-12 w-20 shrink-0 rounded bg-secondary object-contain" /> : <div className="h-12 w-20 shrink-0 rounded bg-secondary" />}
              <div className="min-w-0 flex-1">
                <p className="font-medium">{p.nome}</p>
                <p className="text-xs text-muted-foreground">{p.tipo} · {p.links.length ? tr("length_link_s", { length: p.links.length }) : tr("sem_link")}</p>
              </div>
              <Badge variant={p.ativo ? "success" : "secondary"}>{p.ativo ? "ativo" : "inativo"}</Badge>
            </div>
            {/* Pendências: links antigos que não puderam ser normalizados com segurança */}
            {linksPendentes(p).map(({ link, erro }) => (
              <p key={link.id} role="status" className="mt-2 rounded-md border border-warning/40 bg-warning/10 px-2 py-1 text-xs text-warning">{tr("pendencia_link_valor_erro", { link: rotuloDoLink(link), valor: link.url ?? link.telefone ?? "", erro })}
              </p>
            ))}
            <div className="mt-3 flex flex-wrap gap-x-4 text-sm">
              <Button variant="link" size="none" onClick={() => setEditando(structuredClone(p))}>{tr("editar")}</Button>
              <Button variant="link" size="none" className="text-muted-foreground hover:text-destructive" onClick={() => excluirParceiro(p.id)}>{tr("excluir")}</Button>
            </div>
          </Card>
        ))}
      </div>
      {editando && <EditorParceiro inicial={editando} onFechar={() => setEditando(null)} />}
    </div>
  );
}

function EditorParceiro({ inicial, onFechar }: { inicial: DadosParceiro; onFechar: () => void }) {
  const { usuario } = useAuth();
  const [d, setD] = useState(inicial);
  const [erro, setErro] = useState("");
  const set = (p: Partial<DadosParceiro>) => setD((x) => ({ ...x, ...p }));
  const setLink = (i: number, p: Partial<LinkParceiro>) => set({ links: d.links.map((l, j) => (j === i ? { ...l, ...p } : l)) });
  return (
    <Modal aberto titulo={d.id ? tr("editar_parceiro") : tr("novo_parceiro")} onFechar={onFechar}>
      <div className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <Campo htmlFor="pa-nome" rotulo={tr("nome")}><Input id="pa-nome" value={d.nome} onChange={(e) => set({ nome: e.target.value })} /></Campo>
          <Campo htmlFor="pa-tipo" rotulo={tr("tipo")}>
            <NativeSelect id="pa-tipo" value={d.tipo} onChange={(e) => set({ tipo: e.target.value as Parceiro["tipo"] })}>
              <option value="patrocinador">{tr("patrocinador")}</option><option value="apoiador">{tr("apoiador")}</option><option value="ambos">{tr("ambos")}</option>
            </NativeSelect>
          </Campo>
        </div>
        <Campo htmlFor="pa-desc" rotulo={tr("descricao_curta_opcional")}><Textarea id="pa-desc" maxLength={160} value={d.descricao ?? ""} onChange={(e) => set({ descricao: e.target.value || undefined })} /></Campo>
        <div className="flex flex-wrap items-center gap-3">
          {d.logoUrl && <img src={d.logoUrl} alt="" className="h-14 w-24 rounded bg-secondary object-contain" />}
          <Label className="cursor-pointer rounded-md border border-border px-3 py-2 text-sm font-normal text-inherit">
            {d.logoUrl ? tr("trocar_logo") : tr("enviar_logo")}
            <input type="file" accept="image/*" className="sr-only" onChange={async (e) => {
              const f = e.target.files?.[0]; if (!f) return;
              try { set({ logoUrl: await arquivoParaDataUrl(f, 480, "image/png") }); } catch (er) { setErro((er as Error).message); }
            }} />
          </Label>
          {d.logoUrl && <Button variant="ghost" onClick={() => set({ logoUrl: undefined })}>{tr("remover_logo")}</Button>}
        </div>
        <Campo htmlFor="pa-alt" rotulo={tr("texto_alternativo_do_logo")}><Input id="pa-alt" value={d.textoAlt} onChange={(e) => set({ textoAlt: e.target.value })} /></Campo>
        <Label className="flex items-center gap-2 text-sm font-normal text-inherit"><Checkbox checked={d.ativo} onCheckedChange={(marcado) => set({ ativo: marcado === true })} />{" "}{tr("ativo")}</Label>
        <Label className="flex items-center gap-2 text-sm font-normal text-inherit">
          <Checkbox checked={!!d.naComunidade} onCheckedChange={(marcado) => set({ naComunidade: marcado === true || undefined })} />{tr("destacar_na_lateral_da_comunidade_patroc")}</Label>

        <fieldset className="space-y-2 rounded-lg border border-border p-3">
          <legend className="text-sm font-medium">{tr("links_nenhum_e_obrigatorio")}</legend>
          {d.links.map((l, i) => {
            const href = hrefDoLink(l);
            const erroLink = erroDoLink(l);
            const vazio = l.tipo === "whatsapp" ? !l.telefone?.trim() : !l.url?.trim();
            return (
              <div key={l.id} className="grid gap-2 rounded-md border border-border p-2 sm:grid-cols-2">
                <NativeSelect aria-label={tr("tipo_de_link")} value={l.tipo} onChange={(e) => setLink(i, { tipo: e.target.value as LinkParceiro["tipo"] })}>
                  <option value="site">{tr("site")}</option><option value="instagram">{tr("instagram")}</option><option value="whatsapp">{tr("whatsapp")}</option>
                  <option value="externo">{tr("pagina_externa")}</option><option value="outro">{tr("outro")}</option>
                </NativeSelect>
                {l.tipo === "whatsapp" ? (
                  <>
                    <Input aria-label={tr("telefone_com_codigo_do_pais")} placeholder="+55 11 99999-0000" value={l.telefone ?? ""} onChange={(e) => setLink(i, { telefone: e.target.value })} />
                    <Input aria-label={tr("mensagem_inicial_opcional")} placeholder={tr("mensagem_inicial_opcional")} className="sm:col-span-2" value={l.mensagem ?? ""} onChange={(e) => setLink(i, { mensagem: e.target.value || undefined })} />
                  </>
                ) : l.tipo === "instagram" ? (
                  <div className="space-y-1">
                    <Label htmlFor={`pa-ig-${l.id}`} className="block text-xs font-medium text-inherit">{tr("instagram_do_parceiro")}</Label>
                    <Input id={`pa-ig-${l.id}`} placeholder="@nomedoperfil" value={l.url ?? ""}
                      aria-describedby={`pa-ig-${l.id}-ajuda`} aria-invalid={!vazio && !!erroLink}
                      onChange={(e) => setLink(i, { url: e.target.value })} />
                    <p id={`pa-ig-${l.id}-ajuda`} className="text-xs text-muted-foreground">{tr("informe_o_do_perfil_ou_cole")}</p>
                  </div>
                ) : (
                  <Input aria-label={tr("endereco")} placeholder="https://..." value={l.url ?? ""} onChange={(e) => setLink(i, { url: e.target.value })} />
                )}
                {l.tipo === "outro" && <Input aria-label={tr("rotulo")} placeholder={tr("rotulo_do_botao")} value={l.rotulo ?? ""} onChange={(e) => setLink(i, { rotulo: e.target.value })} />}
                <div className="flex flex-wrap items-center gap-2 text-xs sm:col-span-2">
                  <RadioGroup className="contents" value={l.principal ? "principal" : ""} onValueChange={() => set({ links: d.links.map((x, j) => ({ ...x, principal: j === i })) })}>
                    <Label className="flex items-center gap-1 text-[length:inherit] font-normal text-inherit"><RadioGroupItem value="principal" />{" "}{tr("link_principal")}</Label>
                  </RadioGroup>
                  {href && !erroLink ? (
                    <span className="break-all text-muted-foreground">{tr("destino_href", { href })}</span>
                  ) : (
                    <span role={vazio ? undefined : "alert"} className={vazio ? "text-muted-foreground" : "text-destructive"}>
                      {vazio ? tr("preencha_para_validar_o_link") : erroLink}
                    </span>
                  )}
                  <Button variant="outline" className="!py-1" disabled={!href || !!erroLink} aria-label={tr("testar_l", { l: rotuloDoLink(l) })}
                    onClick={() => href && window.open(href, "_blank", "noopener,noreferrer")}>{tr("testar_link")}</Button>
                  <Button variant="ghost" className="ml-auto !py-1" onClick={() => set({ links: d.links.filter((_, j) => j !== i) })}>{tr("remover")}</Button>
                </div>
              </div>
            );
          })}
          <Button variant="outline" onClick={() => set({ links: [...d.links, { id: gerarId("lk"), tipo: "site", url: "", principal: d.links.length === 0 }] })}>{tr("adicionar_link")}</Button>
          <p className="text-xs text-muted-foreground">{tr("a_validacao_confere_apenas_o_formato")}</p>
        </fieldset>
        {erro && <p role="alert" className="text-sm text-destructive">{erro}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onFechar}>{tr("cancelar")}</Button>
          <Button onClick={async () => { setErro(""); try { await salvarParceiro(d); onFechar(); } catch (e) { setErro((e as Error).message); } }}>{tr("salvar_parceiro")}</Button>
        </div>
      </div>
    </Modal>
  );
}
