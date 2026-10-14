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
import { AreaTexto, Badge, Botao, Campo, EstadoVazio, Entrada, Modal, Selecao } from "@/components/ui";
import { IconeInsignia } from "./IconeInsignia";

const msg = (e: unknown) => (e instanceof Error ? e.message : "Algo deu errado.");

// ---------- Operações ----------
/** Únicos badges de participação: Participando (âmbar) e Participou (verde). */
export function BadgeParticipacao({ estado }: { estado: OperacaoDTO["estado"] }) {
  return estado === "participou" ? <Badge tom="sucesso">Participou</Badge> : <Badge tom="aviso">Participando</Badge>;
}

export function CartaoOperacao({ o, proprio, onMudou }: { o: OperacaoDTO; proprio: boolean; onMudou?: () => void }) {
  const [ocupado, setOcupado] = useState(false);
  return (
    <article className={`overflow-hidden rounded-lg border border-border bg-card ${o.oculta ? "opacity-70" : ""}`}>
      <div className="topo-bg h-24 bg-secondary">{o.imagemUrl && <img src={o.imagemUrl} alt="" className="h-full w-full object-cover" />}</div>
      <div className="space-y-1 p-3 text-sm">
        <div className="flex flex-wrap gap-1">
          <BadgeParticipacao estado={o.estado} />
          {proprio && o.oculta && <Badge>Oculta no perfil</Badge>}
        </div>
        <Link to="/eventos/$eventoId" params={{ eventoId: o.eventoId }} className="block font-display text-base font-semibold uppercase hover:underline">{o.nome}</Link>
        <p className="text-muted-foreground">{formatarDataBR(o.inicioEm)} · {o.cidade}{o.uf ? `/${o.uf}` : ""}</p>
        <p className="text-muted-foreground">{nomeModalidade(o.modalidade)} · {o.organizacao}</p>
        {proprio && onMudou && o.estado === "participou" && (
          <Botao variante="fantasma" className="-ml-2 px-2 py-1 text-xs" disabled={ocupado} onClick={async () => {
            setOcupado(true);
            try { await ocultarOperacao(o.eventoId, !o.oculta); onMudou(); } finally { setOcupado(false); }
          }}>
            {o.oculta ? <><Eye className="h-3.5 w-3.5" /> Mostrar no perfil</> : <><EyeOff className="h-3.5 w-3.5" /> Ocultar do perfil</>}
          </Botao>
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
          <h3 className="font-display text-lg font-semibold uppercase">Participando (só você vê)</h3>
          <div className="mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{futuras.map((o) => <CartaoOperacao key={o.eventoId} o={o} proprio />)}</div>
        </section>
      )}
      <section>
        <h3 className="font-display text-lg font-semibold uppercase">Histórico</h3>
        {proprio && <p className="text-xs text-muted-foreground">Ocultar uma operação a tira do perfil público (contadores, mapa e insígnias), mas ela continua valendo para a sua progressão.</p>}
        {operacoes.length === 0 ? (
          <div className="mt-2"><EstadoVazio titulo="Nenhuma participação ainda" descricao="Uma operação vira “Participou” quando o evento é finalizado e sua presença foi confirmada no check-in." /></div>
        ) : (
          <div className="mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{operacoes.map((o) => <CartaoOperacao key={o.eventoId} o={o} proprio={proprio} onMudou={onMudou} />)}</div>
        )}
      </section>
    </div>
  );
}

export function Restrito() {
  return <EstadoVazio titulo="Bloco privado" descricao="O operador escolheu não compartilhar esta parte do perfil." />;
}

// ---------- Insígnias ----------
export function AbaInsignias({ insignias }: { insignias?: InsigniaDTO[] | undefined }) {
  if (!insignias) return <Restrito />;
  if (!insignias.length) return <EstadoVazio titulo="Nenhuma insígnia para mostrar" />;
  return (
    <div>
      <p className="mb-3 text-xs text-muted-foreground">Títulos lúdicos da plataforma — não representam patentes nem qualificações militares reais. Sem ranking público.</p>
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {insignias.map((i) => {
          const pct = Math.round((i.atual / i.meta) * 100);
          return (
            <li key={i.id} className={`rounded-lg border p-4 ${i.estado === "conquistada" ? "border-warning bg-card" : "border-border bg-card/60"}`}>
              <div className="flex items-start gap-3">
                <span aria-hidden="true" className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-2 ${i.estado === "conquistada" ? "border-warning bg-warning/15 text-warning" : "border-border bg-secondary text-muted-foreground"}`}><IconeInsignia icone={i.icone} /></span>
                <div className="min-w-0">
                  <p className="font-display text-base font-semibold uppercase">{i.nome}</p>
                  <p className="text-xs text-muted-foreground">{i.descricao}</p>
                </div>
              </div>
              <p className="mt-3 text-xs text-muted-foreground">Critério: {i.criterio}</p>
              <div className="mt-1 h-2 overflow-hidden rounded-full bg-secondary" role="progressbar" aria-valuemin={0} aria-valuemax={i.meta} aria-valuenow={i.atual} aria-label={`Progresso de ${i.nome}`}>
                <div className={`h-full ${i.estado === "conquistada" ? "bg-warning" : "bg-primary"}`} style={{ width: `${pct}%` }} />
              </div>
              <p className="mt-1 text-xs">
                {i.estado === "conquistada" ? `Conquistada em ${formatarDataBR(i.conquistadaEm!)}` : i.estado === "em_progresso" ? `Em progresso: ${i.atual}/${i.meta}` : `Bloqueada: ${i.atual}/${i.meta}`}
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
    if (!marca.trim() || !modelo.trim()) return setErro("Marca, tipo e modelo são obrigatórios.");
    setSalvando(true); setErro("");
    try {
      await salvarEquipamento({ id: inicial?.id, marca, tipo, modelo, apelido, observacoes: obs, fotos, visivel });
      onFechar();
    } catch (e) { setErro(msg(e)); } finally { setSalvando(false); }
  };
  return (
    <Modal aberto titulo={inicial ? "Editar equipamento" : "Novo equipamento"} onFechar={onFechar}>
      <div className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-3">
          <Campo rotulo="Marca *" htmlFor="eq-marca"><Entrada id="eq-marca" value={marca} onChange={(e) => setMarca(e.target.value)} maxLength={60} /></Campo>
          <Campo rotulo="Tipo *" htmlFor="eq-tipo">
            <Selecao id="eq-tipo" value={tipo} onChange={(e) => setTipo(e.target.value as TipoEquipamento)}>
              {Object.entries(TIPOS_EQUIPAMENTO).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </Selecao>
          </Campo>
          <Campo rotulo="Modelo *" htmlFor="eq-modelo"><Entrada id="eq-modelo" value={modelo} onChange={(e) => setModelo(e.target.value)} maxLength={80} /></Campo>
        </div>
        <Campo rotulo="Apelido (opcional)" htmlFor="eq-apelido"><Entrada id="eq-apelido" value={apelido} onChange={(e) => setApelido(e.target.value)} maxLength={60} /></Campo>
        <Campo rotulo="Observações (opcional)" htmlFor="eq-obs"><AreaTexto id="eq-obs" rows={3} value={obs} onChange={(e) => setObs(e.target.value)} maxLength={500} /></Campo>
        <div>
          <p className="text-sm font-medium">Fotos (opcional, até {MAX_FOTOS_EQUIPAMENTO})</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {fotos.map((f, i) => (
              <div key={i} className="relative">
                <img src={f} alt={`Foto ${i + 1} do equipamento`} className="h-20 w-20 rounded-md object-cover" />
                <button type="button" aria-label={`Remover foto ${i + 1}`} onClick={() => setFotos(fotos.filter((_, j) => j !== i))} className="absolute -right-1 -top-1 rounded-full bg-destructive px-1.5 text-xs text-destructive-foreground">✕</button>
              </div>
            ))}
            {fotos.length < MAX_FOTOS_EQUIPAMENTO && (
              <label className="flex h-20 w-20 cursor-pointer items-center justify-center rounded-md border border-dashed border-border text-xs text-muted-foreground hover:bg-secondary">
                + Foto
                <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={async (e) => {
                  const f = e.target.files?.[0]; e.target.value = "";
                  if (!f) return;
                  try { const d = await arquivoParaDataUrl(f, 1200); setFotos((x) => [...x, d]); } catch (err) { setErro(msg(err)); }
                }} />
              </label>
            )}
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={visivel} onChange={(e) => setVisivel(e.target.checked)} /> Mostrar no meu perfil (marca, tipo, modelo, fotos e observações)
        </label>
        {erro && <p role="alert" className="text-sm text-destructive">{erro}</p>}
        <div className="flex justify-end gap-2">
          <Botao variante="contorno" onClick={onFechar}>Cancelar</Botao>
          <Botao onClick={salvar} disabled={salvando}>{salvando ? "Salvando…" : "Salvar"}</Botao>
        </div>
      </div>
    </Modal>
  );
}

const TIPOS_NOTA = "application/pdf,image/jpeg,image/png,image/webp";

function NotaFiscal({ eq, onMudou }: { eq: Equipamento; onMudou: () => void }) {
  const [erro, setErro] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const run = async (fn: () => Promise<unknown>) => {
    setOcupado(true); setErro("");
    try { await fn(); onMudou(); } catch (e) { setErro(msg(e)); } finally { setOcupado(false); }
  };
  const abrir = (baixar: boolean) => run(async () => { const url = await linkNota(eq.id, baixar); window.open(url, "_blank", "noopener,noreferrer"); });
  return (
    <div className="mt-3 rounded-md border border-dashed border-border p-3 text-xs">
      <p className="flex items-center gap-1 font-medium"><FileText className="h-3.5 w-3.5" /> Nota fiscal — privada</p>
      {eq.nota ? (
        <p className="mt-1 text-muted-foreground">{eq.nota.nome} · {(eq.nota.tamanho / 1024).toFixed(0)} KB · {formatarDataBR(eq.nota.enviadaEm)}</p>
      ) : <p className="mt-1 text-muted-foreground">Nenhum documento anexado.</p>}
      <div className="mt-2 flex flex-wrap gap-1">
        {eq.nota && <Botao variante="contorno" className="px-2 py-1 text-xs" disabled={ocupado} onClick={() => abrir(false)}>Ver</Botao>}
        {eq.nota && <Botao variante="contorno" className="px-2 py-1 text-xs" disabled={ocupado} onClick={() => abrir(true)}>Baixar</Botao>}
        <label className={`inline-flex cursor-pointer items-center gap-1 rounded-md border border-border px-2 py-1 hover:bg-secondary ${ocupado ? "pointer-events-none opacity-50" : ""}`}>
          <Upload className="h-3 w-3" /> {eq.nota ? "Substituir" : "Anexar"}
          <input type="file" accept={TIPOS_NOTA} className="sr-only" onChange={(e) => {
            const f = e.target.files?.[0]; e.target.value = "";
            if (!f) return;
            if (!TIPOS_NOTA.split(",").includes(f.type)) return setErro("Envie PDF, JPEG, PNG ou WebP.");
            if (f.size > 5 * 1024 * 1024) return setErro("Arquivo acima de 5 MB.");
            run(() => new Promise<void>((ok, falha) => {
              const r = new FileReader();
              r.onload = () => enviarNota(eq.id, f.name, String(r.result)).then(() => ok(), falha);
              r.onerror = () => falha(new Error("Não foi possível ler o arquivo."));
              r.readAsDataURL(f);
            }));
          }} />
        </label>
        {eq.nota && <Botao variante="fantasma" className="px-2 py-1 text-xs" disabled={ocupado} onClick={() => window.confirm("Excluir a nota fiscal?") && run(() => excluirNota(eq.id))}>Excluir</Botao>}
      </div>
      <p className="mt-2 text-muted-foreground">PDF, JPEG, PNG ou WebP, até 5 MB. Só você acessa este arquivo — ele não aparece no perfil, para organizadores nem para a administração. Anexar não torna o equipamento "verificado". Use arquivos fictícios nesta demonstração.</p>
      {erro && <p role="alert" className="mt-1 text-destructive">{erro}</p>}
    </div>
  );
}

export function AbaEquipamentos({ equipamentos, proprio, onMudou }: { equipamentos?: EquipamentoDTO[] | undefined; proprio: boolean; onMudou: () => void }) {
  const versao = useVersaoBase();
  const [editando, setEditando] = useState<Equipamento | null | "novo">(null);
  const [meus, setMeus] = useState<Equipamento[]>([]);
  useEffect(() => { if (proprio) setMeus(carregarBase().equipamentos); }, [proprio, versao]);

  if (!proprio) {
    if (!equipamentos) return <Restrito />;
    if (!equipamentos.length) return <EstadoVazio titulo="Nenhum equipamento compartilhado" />;
    return <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{equipamentos.map((e) => <CartaoEquip key={e.id} e={e} />)}</div>;
  }
  return (
    <div>
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="font-display text-lg font-semibold uppercase">Meus equipamentos</h2>
          <p className="text-xs text-muted-foreground">Cadastro privado. Só aparecem no perfil os equipamentos marcados como visíveis (e se o bloco Equipamentos estiver compartilhado). A nota fiscal é sempre só sua.</p>
        </div>
        <Botao className="w-full shrink-0 sm:w-auto" onClick={() => setEditando("novo")}>Adicionar equipamento</Botao>
      </div>
      {meus.length === 0 ? (
        <div className="rounded-md border border-dashed border-border p-6 text-center">
          <p className="font-medium">Você ainda não cadastrou equipamentos.</p>
          <p className="mt-1 text-sm text-muted-foreground">Adicione marca, tipo, modelo e fotos. Se desejar, guarde a nota fiscal de forma privada.</p>
          <Botao className="mt-3" onClick={() => setEditando("novo")}>Cadastrar primeiro equipamento</Botao>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {meus.map((e) => (
            <CartaoEquip key={e.id} e={e} extra={
              <>
                <div className="mt-2 flex flex-wrap items-center gap-1">
                  <Badge tom={e.visivel ? "sucesso" : "padrao"}>{e.visivel ? "Visível no perfil" : "Privado"}</Badge>
                  <Botao variante="fantasma" className="px-2 py-1 text-xs" onClick={() => setEditando(e)}><Pencil className="h-3 w-3" /> Editar</Botao>
                  <Botao variante="fantasma" className="px-2 py-1 text-xs" onClick={async () => {
                    if (!window.confirm("Excluir este equipamento e sua nota fiscal?")) return;
                    await excluirEquipamento(e.id); onMudou();
                  }}><Trash2 className="h-3 w-3" /> Excluir</Botao>
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
        <Badge tom="destaque">{TIPOS_EQUIPAMENTO[e.tipo]}</Badge>
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
    <Modal aberto largo titulo={`Foto ${indice + 1} de ${fotos.length}`} onFechar={onFechar}>
      <figure>
        <img src={f.url} alt={f.alt ?? f.legenda ?? "Foto da galeria"} className="mx-auto max-h-[65vh] rounded-md object-contain" />
        {f.legenda && <figcaption className="mt-2 text-center text-sm text-muted-foreground">{f.legenda}</figcaption>}
      </figure>
      {fotos.length > 1 && (
        <div className="mt-3 flex justify-center gap-2">
          <Botao variante="contorno" onClick={() => onIndice((indice - 1 + fotos.length) % fotos.length)} aria-label="Foto anterior">← Anterior</Botao>
          <Botao variante="contorno" onClick={() => onIndice((indice + 1) % fotos.length)} aria-label="Próxima foto">Próxima →</Botao>
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
  useEffect(() => { if (proprio) setVisiveis(new Map(carregarBase().fotosPerfil.map((f) => [f.id, f.visivel]))); }, [proprio, versao]);
  if (!fotos) return <Restrito />;
  return (
    <div>
      {proprio && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">Fotos novas começam privadas. Fotos de chamados, notas fiscais e missões nunca entram aqui automaticamente.</p>
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90">
            Adicionar foto
            <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={async (e) => {
              const f = e.target.files?.[0]; e.target.value = "";
              if (!f) return;
              try { setNova({ dataUrl: await arquivoParaDataUrl(f, 1600), legenda: "", alt: "" }); } catch (err) { setErro(msg(err)); }
            }} />
          </label>
        </div>
      )}
      {erro && <p role="alert" className="mb-2 text-sm text-destructive">{erro}</p>}
      {fotos.length === 0 ? <EstadoVazio titulo="Nenhuma foto" /> : (
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {fotos.map((f, i) => (
            <li key={f.id} className="overflow-hidden rounded-md border border-border bg-card">
              <button type="button" onClick={() => setAmpliada(i)} className="block w-full focus-visible:outline-2 focus-visible:outline-ring" aria-label={`Ampliar ${f.legenda ?? `foto ${i + 1}`}`}>
                <img src={f.url} alt={f.alt ?? ""} className="aspect-square w-full object-cover" />
              </button>
              {(f.legenda || proprio) && (
                <div className="space-y-1 p-2 text-xs">
                  {f.legenda && <p className="truncate">{f.legenda}</p>}
                  {proprio && (
                    <div className="flex flex-wrap gap-1">
                      <Botao variante="fantasma" className="px-2 py-0.5 text-xs" onClick={async () => {
                        try { await editarFoto({ id: f.id, legenda: f.legenda, alt: f.alt, visivel: !visiveis.get(f.id) }); onMudou(); } catch (e) { setErro(msg(e)); }
                      }}>{visiveis.get(f.id) ? <><Eye className="h-3 w-3" /> Visível</> : <><EyeOff className="h-3 w-3" /> Privada</>}</Botao>
                      <Botao variante="fantasma" className="px-2 py-0.5 text-xs" aria-label="Excluir foto" onClick={async () => {
                        if (!window.confirm("Excluir esta foto?")) return;
                        await excluirFoto(f.id); onMudou();
                      }}><Trash2 className="h-3 w-3" /></Botao>
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
        <Modal aberto titulo="Nova foto" onFechar={() => setNova(null)}>
          <img src={nova.dataUrl} alt="Prévia" className="mx-auto max-h-64 rounded-md" />
          <div className="mt-3 space-y-3">
            <Campo rotulo="Legenda (opcional)" htmlFor="ft-leg"><Entrada id="ft-leg" maxLength={200} value={nova.legenda} onChange={(e) => setNova({ ...nova, legenda: e.target.value })} /></Campo>
            <Campo rotulo="Texto alternativo (opcional)" htmlFor="ft-alt"><Entrada id="ft-alt" maxLength={200} value={nova.alt} onChange={(e) => setNova({ ...nova, alt: e.target.value })} placeholder="Descreva a imagem para leitores de tela" /></Campo>
            <p className="text-xs text-muted-foreground">A foto será salva como privada. Você pode torná-la visível depois.</p>
            <div className="flex justify-end gap-2">
              <Botao variante="contorno" onClick={() => setNova(null)}>Cancelar</Botao>
              <Botao onClick={async () => {
                try { await adicionarFoto(nova); setNova(null); onMudou(); } catch (e) { setErro(msg(e)); setNova(null); }
              }}>Salvar foto</Botao>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ---------- Recompensas ----------
const ROTULO_STATUS: Record<RecompensaDTO["status"], { t: string; tom: "sucesso" | "padrao" | "aviso" | "perigo" }> = {
  disponivel: { t: "Disponível", tom: "sucesso" },
  utilizada: { t: "Utilizada", tom: "padrao" },
  expirada: { t: "Expirada", tom: "aviso" },
  revogada: { t: "Revogada", tom: "perigo" },
};

export function AbaRecompensas({ recompensas }: { recompensas: RecompensaDTO[] }) {
  return (
    <div className="space-y-3">
      <p className="rounded-md border border-border bg-elevated p-3 text-xs text-muted-foreground">
        Insígnias são reconhecimento; benefícios só existem quando há uma campanha ativa. Cada benefício pertence à sua conta, não é transferível
        e <strong>não reserva vaga</strong>. Pagamentos e benefícios são simulados nesta demonstração.
      </p>
      {recompensas.length === 0 ? <EstadoVazio titulo="Nenhuma recompensa ainda" descricao="Quando uma conquista for elegível a uma campanha ativa, o benefício aparece aqui." /> : (
        <ul className="grid gap-3 md:grid-cols-2">
          {recompensas.map((r) => (
            <li key={r.id} className="rounded-lg border border-border bg-card p-4 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-display text-lg font-semibold uppercase">{descreverBeneficio(r.beneficio)}</p>
                <Badge tom={ROTULO_STATUS[r.status].tom}>{ROTULO_STATUS[r.status].t}</Badge>
              </div>
              <p className="text-muted-foreground">{r.beneficio.nome} · origem: {r.origem}</p>
              <p className="mt-1 text-xs text-muted-foreground">Válido até {formatarDataBR(r.beneficio.resgatarAte)}</p>
              {r.status === "disponivel" && <p className="mt-2 font-mono text-xs">Código: {r.codigo}</p>}
              {r.beneficio.regras && <p className="mt-2 text-xs">{r.beneficio.regras}</p>}
              {r.motivo && <p className="mt-1 text-xs text-muted-foreground">{r.motivo}</p>}
              {r.ocorrencia && <p className="mt-1 text-xs text-warning">{r.ocorrencia}</p>}
              <div className="mt-3">
                <p className="text-xs font-medium">Eventos elegíveis</p>
                <ul className="mt-1 space-y-1">
                  {r.eventos.map((e) => (
                    <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 text-xs">
                      <span>{e.nome}</span>
                      {r.status === "disponivel" && (
                        <Link to="/inscricao/$eventoId" params={{ eventoId: e.id }} search={{ cortesia: undefined, voucher: r.id }} className="rounded-md bg-primary px-2 py-1 text-primary-foreground hover:opacity-90">Usar benefício</Link>
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
