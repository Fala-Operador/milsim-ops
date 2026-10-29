// Abas do Perfil do Operador: operações, insígnias, equipamentos, fotos e recompensas.
import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { EyeOff, Eye, FileText, Trash2, Pencil, Upload } from "lucide-react";
import {
  adicionarFoto, editarFoto, enviarNota, excluirEquipamento, excluirFoto, excluirNota, linkNota, ocultarOperacao, salvarEquipamento,
} from "@/api/perfil.functions";
import { carregarBase } from "@/services/db";
import { useVersaoBase } from "@/hooks/useVersaoBase";
import { arquivoParaDataUrl } from "@/lib/imagens";
import { nomeModalidade } from "@/lib/modalidades";
import { formatarDataBR } from "@/lib/domain/money";
import { descreverBeneficio } from "@/lib/participacao";
import { MAX_FOTOS_EQUIPAMENTO, TIPOS_EQUIPAMENTO } from "@/services/perfilOperador";
import type { EquipamentoDTO, FotoDTO, InsigniaDTO, OperacaoDTO, RecompensaDTO } from "@/lib/perfilSocial";
import type { Equipamento, TipoEquipamento } from "@/lib/domain/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { Campo, EstadoVazio, Modal, TextoLivre } from "@/components/ui";
import { useConfirmacao } from "@/contexts/ConfirmacaoContext";
import { IconeInsignia } from "./IconeInsignia";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Label } from "@/components/ui/label";
import { tr } from "@/i18n/components/perfil/abas";

const msg = (e: unknown) => (e instanceof Error ? e.message : tr("algo_deu_errado"));

// ---------- Operações ----------
/** Únicos badges de participação: Participando (âmbar) e Participou (verde). */
export function BadgeParticipacao({ estado }: { estado: OperacaoDTO["estado"] }) {
  return estado === "participou" ? <Badge variant="success">{tr("participou")}</Badge> : <Badge variant="warning">{tr("participando")}</Badge>;
}

export function CartaoOperacao({ o, proprio, onMudou }: { o: OperacaoDTO; proprio: boolean; onMudou?: () => void }) {
  const [ocupado, setOcupado] = useState(false);
  return (
    <article className={`overflow-hidden rounded-lg border border-border bg-card ${o.oculta ? "opacity-70" : ""}`}>
      <div className="topo-bg h-24 bg-secondary">{o.imagemUrl && <img src={o.imagemUrl} alt="" className="h-full w-full object-cover" />}</div>
      <div className="space-y-1 p-3 text-sm">
        <div className="flex flex-wrap gap-1">
          <BadgeParticipacao estado={o.estado} />
          {proprio && o.oculta && <Badge>{tr("oculta_no_perfil")}</Badge>}
        </div>
        <Link to="/eventos/$eventoId" params={{ eventoId: o.eventoId }} className="block font-display text-base font-semibold uppercase hover:underline">{o.nome}</Link>
        <p className="text-muted-foreground">{formatarDataBR(o.inicioEm)} · {o.cidade}{o.uf ? `/${o.uf}` : ""}</p>
        <p className="text-muted-foreground">{nomeModalidade(o.modalidade)} · {o.organizacao}</p>
        {proprio && onMudou && o.estado === "participou" && (
          <Button variant="ghost" className="-ml-2 text-xs" disabled={ocupado} onClick={async () => {
            setOcupado(true);
            try { await ocultarOperacao(o.eventoId, !o.oculta); onMudou(); } finally { setOcupado(false); }
          }}>
            {o.oculta ? <><Eye className="h-3.5 w-3.5" />{" "}{tr("mostrar_no_perfil")}</> : <><EyeOff className="h-3.5 w-3.5" />{" "}{tr("ocultar_do_perfil")}</>}
          </Button>
        )}
      </div>
    </article>
  );
}

export function AbaOperacoes({ operacoes, futuras, proprio, onMudou }: { operacoes?: OperacaoDTO[] | undefined; futuras?: OperacaoDTO[] | undefined; proprio: boolean; onMudou: () => void }) {
  if (!operacoes) return <Restrito />;
  return (
    <div className="space-y-6">
      {proprio && !!futuras?.length && (
        <section>
          <h3 className="font-display text-lg font-semibold uppercase">{tr("participando_so_voce_ve")}</h3>
          <div className="mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{futuras.map((o) => <CartaoOperacao key={o.eventoId} o={o} proprio />)}</div>
        </section>
      )}
      <section>
        <h3 className="font-display text-lg font-semibold uppercase">{tr("historico")}</h3>
        {proprio && <p className="text-xs text-muted-foreground">{tr("ocultar_uma_operacao_a_tira_do")}</p>}
        {operacoes.length === 0 ? (
          <div className="mt-2"><EstadoVazio titulo={tr("nenhuma_participacao_ainda")} descricao={tr("uma_operacao_vira_participou_quando_o")} /></div>
        ) : (
          <div className="mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{operacoes.map((o) => <CartaoOperacao key={o.eventoId} o={o} proprio={proprio} onMudou={onMudou} />)}</div>
        )}
      </section>
    </div>
  );
}

export function Restrito() {
  return <EstadoVazio titulo={tr("bloco_privado")} descricao={tr("o_operador_escolheu_nao_compartilhar_est")} />;
}

// ---------- Insígnias ----------
export function AbaInsignias({ insignias }: { insignias?: InsigniaDTO[] | undefined }) {
  if (!insignias) return <Restrito />;
  if (!insignias.length) return <EstadoVazio titulo={tr("nenhuma_insignia_para_mostrar")} />;
  return (
    <div>
      <p className="mb-3 text-xs text-muted-foreground">{tr("titulos_ludicos_da_plataforma_nao_repres")}</p>
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {insignias.map((i) => {
          return (
            <li key={i.id} className={`rounded-lg border p-4 ${i.estado === "conquistada" ? "border-warning bg-card" : "border-border bg-card/60"}`}>
              <div className="flex items-start gap-3">
                <span aria-hidden="true" className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-2 ${i.estado === "conquistada" ? "border-warning bg-warning/15 text-warning" : "border-border bg-secondary text-muted-foreground"}`}><IconeInsignia icone={i.icone} /></span>
                <div className="min-w-0">
                  <p className="font-display text-base font-semibold uppercase">{i.nome}</p>
                  <TextoLivre texto={i.descricao} className="text-xs text-muted-foreground" />
                </div>
              </div>
              <p className="mt-3 text-xs text-muted-foreground">{tr("criterio_criterio", { criterio: i.criterio })}</p>
              <Progress className="mt-1" value={Math.min(i.atual, i.meta)} max={i.meta} aria-label={tr("progresso_de_nome", { nome: i.nome })}
                indicatorClassName={i.estado === "conquistada" ? "bg-warning" : "bg-primary"} />
              <p className="mt-1 text-xs">
                {i.estado === "conquistada" ? tr("conquistada_em_valor", { valor: formatarDataBR(i.conquistadaEm!) }) : i.estado === "em_progresso" ? tr("em_progresso_atual_meta", { atual: i.atual, meta: i.meta }) : tr("bloqueada_atual_meta", { atual: i.atual, meta: i.meta })}
              </p>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// ---------- Equipamentos ----------
function FormEquipamento({ inicial, onFechar }: { inicial: Equipamento | null; onFechar: () => void }) {
  const [marca, setMarca] = useState(inicial?.marca ?? "");
  const [tipo, setTipo] = useState<TipoEquipamento>(inicial?.tipo ?? "aeg");
  const [modelo, setModelo] = useState(inicial?.modelo ?? "");
  const [apelido, setApelido] = useState(inicial?.apelido ?? "");
  const [obs, setObs] = useState(inicial?.observacoes ?? "");
  const [fotos, setFotos] = useState<string[]>(inicial?.fotos ?? []);
  const [visivel, setVisivel] = useState(inicial?.visivel ?? false);
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);
  const salvar = async () => {
    if (!marca.trim() || !modelo.trim()) return setErro(tr("marca_tipo_e_modelo_sao_obrigatorios"));
    setSalvando(true); setErro("");
    try {
      await salvarEquipamento({ id: inicial?.id, marca, tipo, modelo, apelido, observacoes: obs, fotos, visivel });
      onFechar();
    } catch (e) { setErro(msg(e)); } finally { setSalvando(false); }
  };
  return (
    <Modal aberto titulo={inicial ? tr("editar_equipamento") : tr("novo_equipamento")} onFechar={onFechar}>
      <div className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-3">
          <Campo rotulo={tr("marca")} htmlFor="eq-marca"><Input id="eq-marca" value={marca} onChange={(e) => setMarca(e.target.value)} maxLength={60} /></Campo>
          <Campo rotulo={tr("tipo")} htmlFor="eq-tipo">
            <NativeSelect id="eq-tipo" value={tipo} onChange={(e) => setTipo(e.target.value as TipoEquipamento)}>
              {Object.entries(TIPOS_EQUIPAMENTO).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </NativeSelect>
          </Campo>
          <Campo rotulo={tr("modelo")} htmlFor="eq-modelo"><Input id="eq-modelo" value={modelo} onChange={(e) => setModelo(e.target.value)} maxLength={80} /></Campo>
        </div>
        <Campo rotulo={tr("apelido_opcional")} htmlFor="eq-apelido"><Input id="eq-apelido" value={apelido} onChange={(e) => setApelido(e.target.value)} maxLength={60} /></Campo>
        <Campo rotulo={tr("observacoes_opcional")} htmlFor="eq-obs"><Textarea id="eq-obs" rows={3} value={obs} onChange={(e) => setObs(e.target.value)} maxLength={500} /></Campo>
        <div>
          <p className="text-sm font-medium">{tr("fotos_opcional_ate_max_fotos_equipamento", { MAX_FOTOS_EQUIPAMENTO })}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {fotos.map((f, i) => (
              <div key={i} className="relative">
                <img src={f} alt={tr("foto_valor_do_equipamento", { valor: i + 1 })} className="h-20 w-20 rounded-md object-cover" />
                <Button variant="plain" size="none" type="button" aria-label={tr("remover_foto_valor", { valor: i + 1 })} onClick={() => setFotos(fotos.filter((_, j) => j !== i))} className="absolute -right-1 -top-1 rounded-full bg-destructive px-1.5 text-xs text-destructive-foreground">✕</Button>
              </div>
            ))}
            {fotos.length < MAX_FOTOS_EQUIPAMENTO && (
              <Label className="flex h-20 w-20 cursor-pointer items-center justify-center rounded-md border border-dashed border-border text-xs text-muted-foreground hover:bg-secondary font-normal">{tr("foto")}<input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={async (e) => {
                  const f = e.target.files?.[0]; e.target.value = "";
                  if (!f) return;
                  try { const d = await arquivoParaDataUrl(f, 1200); setFotos((x) => [...x, d]); } catch (err) { setErro(msg(err)); }
                }} />
              </Label>
            )}
          </div>
        </div>
        <Label className="flex items-center gap-2 text-sm font-normal text-inherit">
          <Checkbox checked={visivel} onCheckedChange={(marcado) => setVisivel(marcado === true)} />{" "}{tr("mostrar_no_meu_perfil_marca_tipo")}</Label>
        {erro && <p role="alert" className="text-sm text-destructive">{erro}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onFechar}>{tr("cancelar")}</Button>
          <Button onClick={salvar} disabled={salvando}>{salvando ? tr("salvando") : tr("salvar")}</Button>
        </div>
      </div>
    </Modal>
  );
}

const TIPOS_NOTA = "application/pdf,image/jpeg,image/png,image/webp";

function NotaFiscal({ eq, onMudou }: { eq: Equipamento; onMudou: () => void }) {
  const { confirmar } = useConfirmacao();
  const [erro, setErro] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const run = async (fn: () => Promise<unknown>) => {
    setOcupado(true); setErro("");
    try { await fn(); onMudou(); } catch (e) { setErro(msg(e)); } finally { setOcupado(false); }
  };
  const abrir = (baixar: boolean) => run(async () => { const url = await linkNota(eq.id, baixar); window.open(url, "_blank", "noopener,noreferrer"); });
  return (
    <div className="mt-3 rounded-md border border-dashed border-border p-3 text-xs">
      <p className="flex items-center gap-1 font-medium"><FileText className="h-3.5 w-3.5" />{" "}{tr("nota_fiscal_privada")}</p>
      {eq.nota ? (
        <p className="mt-1 text-muted-foreground">{tr("nome_valor_kb_enviadaem", { nome: eq.nota.nome, valor: (eq.nota.tamanho / 1024).toFixed(0), enviadaEm: formatarDataBR(eq.nota.enviadaEm) })}</p>
      ) : <p className="mt-1 text-muted-foreground">{tr("nenhum_documento_anexado")}</p>}
      <div className="mt-2 flex flex-wrap gap-1">
        {eq.nota && <Button variant="outline" className="text-xs" disabled={ocupado} onClick={() => abrir(false)}>{tr("ver")}</Button>}
        {eq.nota && <Button variant="outline" className="text-xs" disabled={ocupado} onClick={() => abrir(true)}>{tr("baixar")}</Button>}
        <Label className={`inline-flex cursor-pointer items-center gap-1 rounded-md border border-border px-2 py-1 hover:bg-secondary ${ocupado ? "pointer-events-none opacity-50" : ""} text-[length:inherit] font-normal text-inherit`}>
          <Upload className="h-3 w-3" /> {eq.nota ? tr("substituir") : tr("anexar")}
          <input type="file" accept={TIPOS_NOTA} className="sr-only" onChange={(e) => {
            const f = e.target.files?.[0]; e.target.value = "";
            if (!f) return;
            if (!TIPOS_NOTA.split(",").includes(f.type)) return setErro(tr("envie_pdf_jpeg_png_ou_webp"));
            if (f.size > 5 * 1024 * 1024) return setErro(tr("arquivo_acima_de_5_mb"));
            run(() => new Promise<void>((ok, falha) => {
              const r = new FileReader();
              r.onload = () => enviarNota(eq.id, f.name, String(r.result)).then(() => ok(), falha);
              r.onerror = () => falha(new Error(tr("nao_foi_possivel_ler_o_arquivo")));
              r.readAsDataURL(f);
            }));
          }} />
        </Label>
        {eq.nota && <Button variant="ghost" className="text-xs" disabled={ocupado} onClick={async () => (await confirmar({ titulo: tr("excluir_a_nota_fiscal"), confirmar: tr("excluir"), destrutivo: true })) && run(() => excluirNota(eq.id))}>{tr("excluir")}</Button>}
      </div>
      <p className="mt-2 text-muted-foreground">{tr("pdf_jpeg_png_ou_webp_ate")}</p>
      {erro && <p role="alert" className="mt-1 text-destructive">{erro}</p>}
    </div>
  );
}

export function AbaEquipamentos({ equipamentos, proprio, onMudou }: { equipamentos?: EquipamentoDTO[] | undefined; proprio: boolean; onMudou: () => void }) {
  const versao = useVersaoBase();
  const [editando, setEditando] = useState<Equipamento | null | "novo">(null);
  const [meus, setMeus] = useState<Equipamento[]>([]);
  const { confirmar } = useConfirmacao();
  useEffect(() => { if (proprio) setMeus(carregarBase().equipamentos); }, [proprio, versao]);

  if (!proprio) {
    if (!equipamentos) return <Restrito />;
    if (!equipamentos.length) return <EstadoVazio titulo={tr("nenhum_equipamento_compartilhado")} />;
    return <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{equipamentos.map((e) => <CartaoEquip key={e.id} e={e} />)}</div>;
  }
  return (
    <div>
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="font-display text-lg font-semibold uppercase">{tr("meus_equipamentos")}</h2>
          <p className="text-xs text-muted-foreground">{tr("cadastro_privado_so_aparecem_no_perfil")}</p>
        </div>
        <Button className="w-full shrink-0 sm:w-auto" onClick={() => setEditando("novo")}>{tr("adicionar_equipamento")}</Button>
      </div>
      {meus.length === 0 ? (
        <div className="rounded-md border border-dashed border-border p-6 text-center">
          <p className="font-medium">{tr("voce_ainda_nao_cadastrou_equipamentos")}</p>
          <p className="mt-1 text-sm text-muted-foreground">{tr("adicione_marca_tipo_modelo_e_fotos")}</p>
          <Button className="mt-3" onClick={() => setEditando("novo")}>{tr("cadastrar_primeiro_equipamento")}</Button>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {meus.map((e) => (
            <CartaoEquip key={e.id} e={e} extra={
              <>
                <div className="mt-2 flex flex-wrap items-center gap-1">
                  <Badge variant={e.visivel ? "success" : "secondary"}>{e.visivel ? tr("visivel_no_perfil") : tr("privado")}</Badge>
                  <Button variant="ghost" className="text-xs" onClick={() => setEditando(e)}><Pencil className="h-3 w-3" />{" "}{tr("editar")}</Button>
                  <Button variant="ghost" className="text-xs" onClick={async () => {
                    if (!(await confirmar({ titulo: tr("excluir_este_equipamento"), descricao: tr("a_nota_fiscal_anexada_tambem_sera"), confirmar: tr("excluir"), destrutivo: true }))) return;
                    await excluirEquipamento(e.id); onMudou();
                  }}><Trash2 className="h-3 w-3" />{" "}{tr("excluir")}</Button>
                </div>
                <NotaFiscal eq={e} onMudou={onMudou} />
              </>
            } />
          ))}
        </div>
      )}
      {editando && <FormEquipamento inicial={editando === "novo" ? null : editando} onFechar={() => { setEditando(null); onMudou(); }} />}
    </div>
  );
}

function CartaoEquip({ e, extra }: { e: EquipamentoDTO; extra?: React.ReactNode }) {
  return (
    <article className="rounded-lg border border-border bg-card p-3 text-sm">
      {e.fotos[0] ? <img src={e.fotos[0]} alt={`${e.marca} ${e.modelo}`} className="h-36 w-full rounded-md object-cover" /> : <div className="topo-bg h-36 rounded-md bg-secondary" />}
      <div className="mt-2 flex items-center gap-2">
        <Badge variant="accent">{TIPOS_EQUIPAMENTO[e.tipo]}</Badge>
        {e.apelido && <span className="truncate text-xs text-muted-foreground">“{e.apelido}”</span>}
      </div>
      <p className="mt-1 font-display text-base font-semibold uppercase">{e.marca} {e.modelo}</p>
      {e.observacoes && <p className="mt-1 whitespace-pre-wrap text-xs text-muted-foreground">{e.observacoes}</p>}
      {e.fotos.length > 1 && <div className="mt-2 flex gap-1">{e.fotos.slice(1).map((f, i) => <img key={i} src={f} alt="" className="h-10 w-10 rounded object-cover" />)}</div>}
      {extra}
    </article>
  );
}

// ---------- Fotos ----------
function Ampliada({ fotos, indice, onFechar, onIndice }: { fotos: FotoDTO[]; indice: number; onFechar: () => void; onIndice: (i: number) => void }) {
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") onFechar();
      if (e.key === "ArrowRight") onIndice((indice + 1) % fotos.length);
      if (e.key === "ArrowLeft") onIndice((indice - 1 + fotos.length) % fotos.length);
    };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [indice, fotos.length, onFechar, onIndice]);
  const f = fotos[indice]!;
  return (
    <Modal aberto largo titulo={tr("foto_valor_de_length", { valor: indice + 1, length: fotos.length })} onFechar={onFechar}>
      <figure>
        <img src={f.url} alt={f.alt ?? f.legenda ?? tr("foto_da_galeria")} className="mx-auto max-h-[65vh] rounded-md object-contain" />
        {f.legenda && <figcaption className="mt-2 text-center text-sm text-muted-foreground">{f.legenda}</figcaption>}
      </figure>
      {fotos.length > 1 && (
        <div className="mt-3 flex justify-center gap-2">
          <Button variant="outline" onClick={() => onIndice((indice - 1 + fotos.length) % fotos.length)} aria-label={tr("foto_anterior")}>{tr("anterior")}</Button>
          <Button variant="outline" onClick={() => onIndice((indice + 1) % fotos.length)} aria-label={tr("proxima_foto")}>{tr("proxima")}</Button>
        </div>
      )}
    </Modal>
  );
}

export function AbaFotos({ fotos, proprio, onMudou }: { fotos?: FotoDTO[] | undefined; proprio: boolean; onMudou: () => void }) {
  const versao = useVersaoBase();
  const [ampliada, setAmpliada] = useState<number | null>(null);
  const [nova, setNova] = useState<{ dataUrl: string; legenda: string; alt: string } | null>(null);
  const [erro, setErro] = useState("");
  const [visiveis, setVisiveis] = useState<Map<string, boolean>>(new Map());
  const { confirmar } = useConfirmacao();
  useEffect(() => { if (proprio) setVisiveis(new Map(carregarBase().fotosPerfil.map((f) => [f.id, f.visivel]))); }, [proprio, versao]);
  if (!fotos) return <Restrito />;
  return (
    <div>
      {proprio && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">{tr("fotos_novas_comecam_privadas_fotos_de")}</p>
          <Label className="inline-flex cursor-pointer items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90">{tr("adicionar_foto")}<input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={async (e) => {
              const f = e.target.files?.[0]; e.target.value = "";
              if (!f) return;
              try { setNova({ dataUrl: await arquivoParaDataUrl(f, 1600), legenda: "", alt: "" }); } catch (err) { setErro(msg(err)); }
            }} />
          </Label>
        </div>
      )}
      {erro && <p role="alert" className="mb-2 text-sm text-destructive">{erro}</p>}
      {fotos.length === 0 ? <EstadoVazio titulo={tr("nenhuma_foto")} /> : (
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {fotos.map((f, i) => (
            <li key={f.id} className="overflow-hidden rounded-md border border-border bg-card">
              <Button variant="plain" size="none" type="button" onClick={() => setAmpliada(i)} className="block w-full focus-visible:outline-2 focus-visible:outline-ring" aria-label={tr("ampliar_valor", { valor: f.legenda ?? `foto ${i + 1}` })}>
                <img src={f.url} alt={f.alt ?? ""} className="aspect-square w-full object-cover" />
              </Button>
              {(f.legenda || proprio) && (
                <div className="space-y-1 p-2 text-xs">
                  {f.legenda && <p className="truncate">{f.legenda}</p>}
                  {proprio && (
                    <div className="flex flex-wrap gap-1">
                      <Button variant="ghost" className="text-xs" onClick={async () => {
                        try { await editarFoto({ id: f.id, legenda: f.legenda, alt: f.alt, visivel: !visiveis.get(f.id) }); onMudou(); } catch (e) { setErro(msg(e)); }
                      }}>{visiveis.get(f.id) ? <><Eye className="h-3 w-3" />{" "}{tr("visivel")}</> : <><EyeOff className="h-3 w-3" />{" "}{tr("privada")}</>}</Button>
                      <Button variant="ghost" className="text-xs" aria-label={tr("excluir_foto")} onClick={async () => {
                        if (!(await confirmar({ titulo: tr("excluir_esta_foto"), confirmar: tr("excluir"), destrutivo: true }))) return;
                        await excluirFoto(f.id); onMudou();
                      }}><Trash2 className="h-3 w-3" /></Button>
                    </div>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      {ampliada !== null && fotos[ampliada] && <Ampliada fotos={fotos} indice={ampliada} onFechar={() => setAmpliada(null)} onIndice={setAmpliada} />}
      {nova && (
        <Modal aberto titulo={tr("nova_foto")} onFechar={() => setNova(null)}>
          <img src={nova.dataUrl} alt={tr("previa")} className="mx-auto max-h-64 rounded-md" />
          <div className="mt-3 space-y-3">
            <Campo rotulo={tr("legenda_opcional")} htmlFor="ft-leg"><Input id="ft-leg" maxLength={200} value={nova.legenda} onChange={(e) => setNova({ ...nova, legenda: e.target.value })} /></Campo>
            <Campo rotulo={tr("texto_alternativo_opcional")} htmlFor="ft-alt"><Input id="ft-alt" maxLength={200} value={nova.alt} onChange={(e) => setNova({ ...nova, alt: e.target.value })} placeholder={tr("descreva_a_imagem_para_leitores_de")} /></Campo>
            <p className="text-xs text-muted-foreground">{tr("a_foto_sera_salva_como_privada")}</p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setNova(null)}>{tr("cancelar")}</Button>
              <Button onClick={async () => {
                try { await adicionarFoto(nova); setNova(null); onMudou(); } catch (e) { setErro(msg(e)); setNova(null); }
              }}>{tr("salvar_foto")}</Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ---------- Recompensas ----------
const ROTULO_STATUS: Record<RecompensaDTO["status"], { t: string; tom: "success" | "secondary" | "warning" | "destructive" }> = {
  disponivel: { get t() { return tr("disponivel"); }, tom: "success" },
  utilizada: { get t() { return tr("utilizada"); }, tom: "secondary" },
  expirada: { get t() { return tr("expirada"); }, tom: "warning" },
  revogada: { get t() { return tr("revogada"); }, tom: "destructive" },
};

export function AbaRecompensas({ recompensas }: { recompensas: RecompensaDTO[] }) {
  return (
    <div className="space-y-3">
      <p className="rounded-md border border-border bg-elevated p-3 text-xs text-muted-foreground">{tr("insignias_sao_reconhecimento_beneficios")}{" "}<strong>{tr("nao_reserva_vaga")}</strong>{tr("pagamentos_e_beneficios_sao_simulados_ne")}</p>
      {recompensas.length === 0 ? <EstadoVazio titulo={tr("nenhuma_recompensa_ainda")} descricao={tr("quando_uma_conquista_for_elegivel_a")} /> : (
        <ul className="grid gap-3 md:grid-cols-2">
          {recompensas.map((r) => (
            <li key={r.id} className="rounded-lg border border-border bg-card p-4 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-display text-lg font-semibold uppercase">{descreverBeneficio(r.beneficio)}</p>
                <Badge variant={ROTULO_STATUS[r.status].tom}>{ROTULO_STATUS[r.status].t}</Badge>
              </div>
              <p className="text-muted-foreground">{tr("nome_origem_origem", { nome: r.beneficio.nome, origem: r.origem })}</p>
              <p className="mt-1 text-xs text-muted-foreground">{tr("valido_ate_resgatarate", { resgatarAte: formatarDataBR(r.beneficio.resgatarAte) })}</p>
              {r.status === "disponivel" && <p className="mt-2 font-mono text-xs">{tr("codigo_codigo", { codigo: r.codigo })}</p>}
              {r.beneficio.regras && <p className="mt-2 text-xs">{r.beneficio.regras}</p>}
              {r.motivo && <p className="mt-1 text-xs text-muted-foreground">{r.motivo}</p>}
              {r.ocorrencia && <p className="mt-1 text-xs text-warning">{r.ocorrencia}</p>}
              <div className="mt-3">
                <p className="text-xs font-medium">{tr("eventos_elegiveis")}</p>
                <ul className="mt-1 space-y-1">
                  {r.eventos.map((e) => (
                    <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 text-xs">
                      <span>{e.nome}</span>
                      {r.status === "disponivel" && (
                        <Button asChild size="none" className="inline px-2 py-1 text-[length:inherit] font-normal"><Link to="/inscricao/$eventoId" params={{ eventoId: e.id }} search={{ cortesia: undefined, voucher: r.id }}>{tr("usar_beneficio")}</Link></Button>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
