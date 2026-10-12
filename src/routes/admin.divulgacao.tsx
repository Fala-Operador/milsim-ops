import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, GripVertical } from "lucide-react";
import { carregarBase } from "@/services/db";
import { useVersaoBase } from "@/hooks/useVersaoBase";
import { useAuth } from "@/contexts/AuthContext";
import type {
  Abrangencia, BaseDados, DestaqueEvento, LinkParceiro, Parceiro, SecaoInicial, TipoSecao,
} from "@/lib/domain/types";
import {
  NACIONAL, REGIOES, UF_REGIAO, eventoElegivel, hrefDoLink, montarPaginaInicial, rotuloAbrangencia, rotuloDoLink,
} from "@/lib/divulgacao";
import {
  alterarStatusSecao, excluirParceiro, excluirSecao, reordenarSecoes, salvarParceiro, salvarSecao,
  type DadosParceiro, type DadosSecao,
} from "@/services/divulgacao";
import { arquivoParaDataUrl } from "@/lib/imagens";
import { SecoesPublicas, SeletorLocalizacao } from "@/components/divulgacao";
import { AreaTexto, Badge, Botao, Campo, Cartao, Entrada, EstadoVazio, Modal, Selecao, SkeletonPagina } from "@/components/ui";
import { gerarId } from "@/services/db";

export const Route = createFileRoute("/admin/divulgacao")({
  head: () => ({
    meta: [
      { title: "Página inicial e divulgação — MilSim Ops" },
      { name: "description", content: "Configure seções, destaques regionais, patrocinadores, apoiadores e banners da página inicial." },
      { property: "og:title", content: "Página inicial e divulgação — MilSim Ops" },
      { property: "og:description", content: "Gestão administrativa da página inicial." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PaginaDivulgacao,
});

const ROTULO_TIPO: Record<TipoSecao, string> = {
  destaques: "Operações em destaque", regional: "Eventos por região", patrocinadores: "Patrocinadores",
  apoiadores: "Apoiadores", banner: "Banner promocional",
};
const UFS = Object.keys(UF_REGIAO).sort();
const paraLocal = (iso?: string) => (iso ? new Date(new Date(iso).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : "");
const deLocal = (v: string) => (v ? new Date(v).toISOString() : undefined);
const tomStatus = { rascunho: "aviso", publicada: "sucesso", desativada: "padrao" } as const;

function PaginaDivulgacao() {
  const versao = useVersaoBase();
  const [base, setBase] = useState<BaseDados | null>(null);
  const [aba, setAba] = useState<"secoes" | "parceiros">("secoes");
  useEffect(() => setBase(structuredClone(carregarBase())), [versao]);
  if (!base) return <SkeletonPagina />;
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-semibold uppercase">Página inicial e divulgação</h2>
          <p className="text-sm text-muted-foreground">
            Agendamentos são calculados ao abrir e atualizar a página (demonstração sem tarefas no servidor).
          </p>
        </div>
        <div className="flex gap-1" role="tablist">
          <Botao role="tab" aria-selected={aba === "secoes"} variante={aba === "secoes" ? "primario" : "contorno"} onClick={() => setAba("secoes")}>Seções</Botao>
          <Botao role="tab" aria-selected={aba === "parceiros"} variante={aba === "parceiros" ? "primario" : "contorno"} onClick={() => setAba("parceiros")}>Parceiros</Botao>
        </div>
      </div>
      <div className="mt-4">{aba === "secoes" ? <GestaoSecoes base={base} /> : <GestaoParceiros base={base} />}</div>
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
    reordenarSecoes(usuario, ids);
  };

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        <Botao onClick={() => setEditando(secaoVazia("destaques"))}>Nova seção</Botao>
        <Botao variante="contorno" onClick={() => setPrevia(true)}>Prévia da página</Botao>
      </div>
      <ul className="mt-4 space-y-2" aria-label="Seções da página inicial (arraste para reordenar)">
        {ordenadas.map((s, i) => (
          <li key={s.id} draggable
            onDragStart={() => setArrastando(s.id)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => { if (arrastando) mover(ordenadas.findIndex((x) => x.id === arrastando), i); setArrastando(null); }}
            className={`flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card p-3 ${arrastando === s.id ? "opacity-50" : ""}`}>
            <GripVertical className="h-4 w-4 cursor-grab text-muted-foreground" aria-hidden />
            <span className="w-6 font-mono text-xs text-muted-foreground">{i + 1}</span>
            <div className="min-w-0 flex-1">
              <p className="font-medium">{s.titulo}</p>
              <p className="text-xs text-muted-foreground">
                {ROTULO_TIPO[s.tipo]} · {rotuloAbrangencia(s.abrangencia)} · {s.layout}
                {s.tipo === "destaques" || s.tipo === "regional" ? ` · ${s.modo === "manual" ? `${s.destaques.length} destaques` : "automática"}` : ""}
                {s.agendamento.inicioEm || s.agendamento.fimEm ? " · agendada" : ""}
              </p>
            </div>
            <Badge tom={tomStatus[s.status]}>{s.status}</Badge>
            <div className="flex gap-1">
              <Botao variante="fantasma" className="!px-2" aria-label={`Mover ${s.titulo} para cima`} disabled={i === 0} onClick={() => mover(i, i - 1)}><ArrowUp className="h-4 w-4" /></Botao>
              <Botao variante="fantasma" className="!px-2" aria-label={`Mover ${s.titulo} para baixo`} disabled={i === ordenadas.length - 1} onClick={() => mover(i, i + 1)}><ArrowDown className="h-4 w-4" /></Botao>
              <Botao variante="contorno" onClick={() => setEditando(structuredClone(s))}>Editar</Botao>
              {s.status !== "publicada" ? (
                <Botao variante="secundario" onClick={() => alterarStatusSecao(usuario, s.id, "publicada")}>Publicar</Botao>
              ) : (
                <Botao variante="secundario" onClick={() => alterarStatusSecao(usuario, s.id, "desativada")}>Desativar</Botao>
              )}
              <Botao variante="fantasma" onClick={() => setExcluir(s)}>Excluir</Botao>
            </div>
          </li>
        ))}
      </ul>
      {ordenadas.length === 0 && <EstadoVazio titulo="Nenhuma seção criada" />}

      {editando && <EditorSecao base={base} inicial={editando} onFechar={() => setEditando(null)} />}
      <Previa base={base} aberto={previa} onFechar={() => setPrevia(false)} />
      <Modal aberto={!!excluir} titulo="Excluir seção" onFechar={() => setExcluir(null)}>
        <p className="text-sm text-muted-foreground">A seção “{excluir?.titulo}” será removida. Eventos e parceiros continuam cadastrados.</p>
        <div className="mt-4 flex justify-end gap-2">
          <Botao variante="fantasma" onClick={() => setExcluir(null)}>Voltar</Botao>
          <Botao variante="perigo" onClick={async () => { await excluirSecao(usuario, excluir!.id); setExcluir(null); }}>Excluir</Botao>
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
      <Selecao aria-label={`${rotulo}: escopo`} value={valor.escopo} onChange={(e) => {
        const escopo = e.target.value as Abrangencia["escopo"];
        onMudar(escopo === "nacional" ? NACIONAL : { escopo, regiao: "Sudeste", uf: "SP", cidade: escopo === "cidade" ? "São Paulo" : undefined });
      }}>
        <option value="nacional">Nacional</option><option value="regiao">Região</option>
        <option value="estado">Estado</option><option value="cidade">Cidade</option>
      </Selecao>
      {valor.escopo === "regiao" && (
        <Selecao aria-label={`${rotulo}: região`} value={valor.regiao} onChange={(e) => onMudar({ escopo: "regiao", regiao: e.target.value as Abrangencia["regiao"] })}>
          {REGIOES.map((r) => <option key={r}>{r}</option>)}
        </Selecao>
      )}
      {(valor.escopo === "estado" || valor.escopo === "cidade") && (
        <Selecao aria-label={`${rotulo}: estado`} value={valor.uf} onChange={(e) => onMudar({ ...valor, regiao: undefined, uf: e.target.value })}>
          {UFS.map((u) => <option key={u}>{u}</option>)}
        </Selecao>
      )}
      {valor.escopo === "cidade" && (
        <Entrada aria-label={`${rotulo}: cidade`} value={valor.cidade ?? ""} onChange={(e) => onMudar({ ...valor, cidade: e.target.value })} placeholder="Cidade" />
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
      await salvarSecao(usuario, { ...d, status: status ?? d.status });
      onFechar();
    } catch (e) { setErro((e as Error).message); }
  };

  return (
    <Modal aberto titulo={d.id ? "Editar seção" : "Nova seção"} onFechar={onFechar}>
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Campo htmlFor="sec-titulo" rotulo="Título"><Entrada id="sec-titulo" value={d.titulo} onChange={(e) => set({ titulo: e.target.value })} /></Campo>
          <Campo htmlFor="sec-sub" rotulo="Subtítulo (opcional)"><Entrada id="sec-sub" value={d.subtitulo ?? ""} onChange={(e) => set({ subtitulo: e.target.value || undefined })} /></Campo>
          <Campo htmlFor="sec-tipo" rotulo="Tipo">
            <Selecao id="sec-tipo" value={d.tipo} disabled={!!d.id} onChange={(e) => { const t = e.target.value as TipoSecao; setD({ ...secaoVazia(t), titulo: d.titulo }); }}>
              {Object.entries(ROTULO_TIPO).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </Selecao>
          </Campo>
          <Campo htmlFor="sec-layout" rotulo="Layout">
            <Selecao id="sec-layout" value={d.layout} onChange={(e) => set({ layout: e.target.value as SecaoInicial["layout"] })}>
              {d.tipo === "banner" ? <option value="banner">Banner</option> : <><option value="grade">Grade</option><option value="carrossel">Carrossel</option></>}
            </Selecao>
          </Campo>
        </div>
        <EditorAbrangencia rotulo="Abrangência" valor={d.abrangencia} onMudar={(a) => set({ abrangencia: a })} />
        <div className="grid gap-3 sm:grid-cols-2">
          <Campo htmlFor="sec-ini" rotulo="Início da exibição (opcional)"><Entrada id="sec-ini" type="datetime-local" value={paraLocal(d.agendamento.inicioEm)} onChange={(e) => set({ agendamento: { ...d.agendamento, inicioEm: deLocal(e.target.value) } })} /></Campo>
          <Campo htmlFor="sec-fim" rotulo="Término da exibição (opcional)"><Entrada id="sec-fim" type="datetime-local" value={paraLocal(d.agendamento.fimEm)} onChange={(e) => set({ agendamento: { ...d.agendamento, fimEm: deLocal(e.target.value) } })} /></Campo>
        </div>

        {ehEventos && (
          <div className="space-y-3 rounded-lg border border-border p-3">
            <div className="flex flex-wrap gap-3 text-sm">
              <label className="flex items-center gap-1"><input type="radio" checked={d.modo === "manual"} onChange={() => set({ modo: "manual" })} /> Curadoria manual</label>
              <label className="flex items-center gap-1"><input type="radio" checked={d.modo === "automatico"} onChange={() => set({ modo: "automatico", automatica: auto })} /> Seleção automática</label>
              <label className="flex items-center gap-1"><input type="checkbox" checked={d.mostrarEsgotados} onChange={(e) => set({ mostrarEsgotados: e.target.checked })} /> Manter esgotados visíveis</label>
            </div>
            {d.modo === "manual" ? (
              <div className="space-y-3">
                {d.destaques.sort((a, b) => a.posicao - b.posicao).map((x, i) => (
                  <div key={x.id} className="grid gap-2 rounded-md border border-border p-2 sm:grid-cols-2">
                    <Selecao aria-label="Evento" value={x.eventoId} onChange={(e) => setDestaque(i, { eventoId: e.target.value })}>
                      {base.eventos.filter((e) => eventoElegivel(e, new Date()) || e.id === x.eventoId).map((e) => (
                        <option key={e.id} value={e.id}>{e.nome} — {e.cidade}/{e.uf}{eventoElegivel(e, new Date()) ? "" : " (fora da divulgação)"}</option>
                      ))}
                    </Selecao>
                    <Entrada aria-label="Posição" type="number" min={1} value={x.posicao} onChange={(e) => setDestaque(i, { posicao: Number(e.target.value) })} />
                    <Entrada aria-label="Selo" placeholder="Selo (ex.: Destaque da semana)" value={x.selo ?? ""} onChange={(e) => setDestaque(i, { selo: e.target.value || undefined })} />
                    <Entrada aria-label="Chamada curta" placeholder="Chamada curta" maxLength={90} value={x.chamada ?? ""} onChange={(e) => setDestaque(i, { chamada: e.target.value || undefined })} />
                    <Entrada aria-label="Início da divulgação" type="datetime-local" value={paraLocal(x.agendamento.inicioEm)} onChange={(e) => setDestaque(i, { agendamento: { ...x.agendamento, inicioEm: deLocal(e.target.value) } })} />
                    <Entrada aria-label="Término da divulgação" type="datetime-local" value={paraLocal(x.agendamento.fimEm)} onChange={(e) => setDestaque(i, { agendamento: { ...x.agendamento, fimEm: deLocal(e.target.value) } })} />
                    <div className="flex flex-wrap items-center gap-2 text-xs sm:col-span-2">
                      <label className="cursor-pointer rounded-md border border-border px-2 py-1">
                        {x.imagemPromocional ? "Trocar imagem promocional" : "Imagem promocional (opcional)"}
                        <input type="file" accept="image/*" className="sr-only" onChange={async (e) => {
                          const f = e.target.files?.[0]; if (!f) return;
                          try { setDestaque(i, { imagemPromocional: await arquivoParaDataUrl(f, 960) }); } catch (er) { setErro((er as Error).message); }
                        }} />
                      </label>
                      {x.imagemPromocional && <Botao variante="fantasma" onClick={() => setDestaque(i, { imagemPromocional: undefined })}>Usar imagem original</Botao>}
                      <Botao variante="fantasma" className="ml-auto" onClick={() => set({ destaques: d.destaques.filter((_, j) => j !== i) })}>Remover destaque</Botao>
                    </div>
                  </div>
                ))}
                <Botao variante="contorno" disabled={!elegiveis.length} onClick={() => set({
                  destaques: [...d.destaques, { id: gerarId("dst"), eventoId: elegiveis[0]!.id, posicao: d.destaques.length + 1, agendamento: {} }],
                })}>Adicionar evento</Botao>
                <p className="text-xs text-muted-foreground">Nome, data, local, vagas e preço vêm do cadastro do evento. Cancelados ou despublicados saem da página pública automaticamente.</p>
              </div>
            ) : (
              <div className="space-y-3">
                <EditorAbrangencia rotulo="Filtrar eventos por" valor={auto.abrangencia} onMudar={(a) => set({ automatica: { ...auto, abrangencia: a } })} />
                <div className="grid gap-3 sm:grid-cols-3">
                  <Campo htmlFor="au-per" rotulo="Próximos dias (vazio = todos)"><Entrada id="au-per" type="number" min={1} value={auto.periodoDias ?? ""} onChange={(e) => set({ automatica: { ...auto, periodoDias: e.target.value ? Number(e.target.value) : undefined } })} /></Campo>
                  <Campo htmlFor="au-max" rotulo="Máximo de cards"><Entrada id="au-max" type="number" min={1} value={auto.maximo} onChange={(e) => set({ automatica: { ...auto, maximo: Number(e.target.value) } })} /></Campo>
                  <Campo htmlFor="au-ord" rotulo="Ordenação">
                    <Selecao id="au-ord" value={auto.ordenacao} onChange={(e) => set({ automatica: { ...auto, ordenacao: e.target.value as "data" | "recentes" } })}>
                      <option value="data">Data mais próxima</option><option value="recentes">Publicação mais recente</option>
                    </Selecao>
                  </Campo>
                </div>
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={auto.incluirEsgotados} onChange={(e) => set({ automatica: { ...auto, incluirEsgotados: e.target.checked } })} /> Incluir eventos esgotados</label>
              </div>
            )}
          </div>
        )}

        {ehParceiros && (
          <div className="space-y-3 rounded-lg border border-border p-3">
            <p className="text-sm font-medium">Parceiros (marque e defina a ordem)</p>
            {base.parceiros.filter((p) => p.tipo === "ambos" || p.tipo === (d.tipo === "patrocinadores" ? "patrocinador" : "apoiador")).map((p) => {
              const item = d.parceiros.find((i) => i.parceiroId === p.id);
              return (
                <div key={p.id} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" id={`sp-${p.id}`} checked={!!item} onChange={(e) => set({
                    parceiros: e.target.checked ? [...d.parceiros, { parceiroId: p.id, posicao: d.parceiros.length + 1 }] : d.parceiros.filter((i) => i.parceiroId !== p.id),
                  })} />
                  <label htmlFor={`sp-${p.id}`} className="flex-1">{p.nome}{!p.ativo && " (inativo)"}</label>
                  {item && <Entrada aria-label={`Posição de ${p.nome}`} type="number" min={1} className="!w-20" value={item.posicao} onChange={(e) => set({
                    parceiros: d.parceiros.map((i) => (i.parceiroId === p.id ? { ...i, posicao: Number(e.target.value) } : i)),
                  })} />}
                </div>
              );
            })}
            <div className="grid gap-3 sm:grid-cols-3">
              <Campo htmlFor="sp-tam" rotulo="Tamanho dos logos">
                <Selecao id="sp-tam" value={d.tamanhoLogo} onChange={(e) => set({ tamanhoLogo: e.target.value as "p" | "m" | "g" })}>
                  <option value="p">Pequeno</option><option value="m">Médio</option><option value="g">Grande</option>
                </Selecao>
              </Campo>
              <Campo htmlFor="sp-sup" rotulo="Superfície atrás do logo">
                <Selecao id="sp-sup" value={d.superficieLogo} onChange={(e) => set({ superficieLogo: e.target.value as SecaoInicial["superficieLogo"] })}>
                  <option value="nenhuma">Nenhuma</option><option value="clara">Neutra clara</option><option value="escura">Neutra escura</option>
                </Selecao>
              </Campo>
              <label className="flex items-center gap-2 pt-6 text-sm"><input type="checkbox" checked={d.mostrarDescricoes} onChange={(e) => set({ mostrarDescricoes: e.target.checked })} /> Mostrar descrições</label>
            </div>
          </div>
        )}

        {d.tipo === "banner" && <EditorBanner base={base} d={d} set={set} setErro={setErro} />}

        {erro && <p role="alert" className="text-sm text-destructive">{erro}</p>}
        <div className="flex flex-wrap justify-end gap-2">
          <Botao variante="fantasma" onClick={onFechar}>Cancelar</Botao>
          <Botao variante="contorno" onClick={() => salvar("rascunho")}>Salvar rascunho</Botao>
          <Botao onClick={() => salvar("publicada")}>Salvar e publicar</Botao>
        </div>
      </div>
    </Modal>
  );
}

function EditorBanner({ base, d, set, setErro }: { base: BaseDados; d: DadosSecao; set: (p: Partial<DadosSecao>) => void; setErro: (s: string) => void }) {
  const b = d.banner ?? { textoAlt: "" };
  const up = (p: Partial<typeof b>) => set({ banner: { ...b, ...p } });
  const imagem = (campo: "imagemDesktop" | "imagemCelular", rotulo: string) => (
    <label className="block cursor-pointer rounded-md border border-dashed border-border p-2 text-center text-xs">
      {b[campo] ? <img src={b[campo]} alt="" className="mx-auto h-16 object-contain" /> : rotulo}
      <input type="file" accept="image/*" className="sr-only" onChange={async (e) => {
        const f = e.target.files?.[0]; if (!f) return;
        try { up({ [campo]: await arquivoParaDataUrl(f, 1600) }); } catch (er) { setErro((er as Error).message); }
      }} />
    </label>
  );
  return (
    <div className="space-y-3 rounded-lg border border-border p-3">
      <div className="grid gap-3 sm:grid-cols-2">{imagem("imagemDesktop", "Imagem para desktop")}{imagem("imagemCelular", "Imagem para celular (opcional)")}</div>
      <Campo htmlFor="bn-alt" rotulo="Texto alternativo"><Entrada id="bn-alt" value={b.textoAlt} onChange={(e) => up({ textoAlt: e.target.value })} /></Campo>
      <div className="grid gap-3 sm:grid-cols-2">
        <Campo htmlFor="bn-cha" rotulo="Chamada (opcional)"><Entrada id="bn-cha" value={b.chamada ?? ""} onChange={(e) => up({ chamada: e.target.value || undefined })} /></Campo>
        <Campo htmlFor="bn-bot" rotulo="Texto do botão"><Entrada id="bn-bot" value={b.textoBotao ?? ""} onChange={(e) => up({ textoBotao: e.target.value || undefined })} /></Campo>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Campo htmlFor="bn-dt" rotulo="Destino (opcional)">
          <Selecao id="bn-dt" value={b.destino?.tipo ?? ""} onChange={(e) => {
            const t = e.target.value;
            up({ destino: t ? ({ tipo: t, valor: "" } as NonNullable<typeof b.destino>) : undefined });
          }}>
            <option value="">Sem destino (não clicável)</option><option value="evento">Evento interno</option>
            <option value="secao">Seção interna</option><option value="parceiro">Parceiro cadastrado</option><option value="externo">Link externo</option>
          </Selecao>
        </Campo>
        {b.destino && (
          <Campo htmlFor="bn-dv" rotulo="Alvo">
            {b.destino.tipo === "externo" ? (
              <Entrada id="bn-dv" placeholder="https://..." value={b.destino.valor} onChange={(e) => up({ destino: { tipo: "externo", valor: e.target.value } })} />
            ) : (
              <Selecao id="bn-dv" value={b.destino.valor} onChange={(e) => up({ destino: { ...b.destino!, valor: e.target.value } as NonNullable<typeof b.destino> })}>
                <option value="">Selecione</option>
                {(b.destino.tipo === "evento" ? base.eventos.filter((e) => eventoElegivel(e, new Date())).map((e) => [e.id, e.nome])
                  : b.destino.tipo === "secao" ? base.secoesInicio.filter((s) => s.id !== d.id).map((s) => [s.id, s.titulo])
                  : base.parceiros.map((p) => [p.id, p.nome])).map(([v, r]) => <option key={v} value={v}>{r}</option>)}
              </Selecao>
            )}
          </Campo>
        )}
      </div>
      <p className="text-xs text-muted-foreground">Evite texto essencial dentro da imagem: chamada e botão são exibidos como texto da página.</p>
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
    <Modal aberto={aberto} titulo="Prévia da página inicial" onFechar={onFechar} largo>
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex gap-1">
          <Botao variante={!celular ? "primario" : "contorno"} onClick={() => setCelular(false)}>Desktop</Botao>
          <Botao variante={celular ? "primario" : "contorno"} onClick={() => setCelular(true)}>Celular</Botao>
        </div>
        <div className="flex gap-1">
          <Botao variante={tema === "escuro" ? "primario" : "contorno"} onClick={() => setTema("escuro")}>Tema escuro</Botao>
          <Botao variante={tema === "claro" ? "primario" : "contorno"} onClick={() => setTema("claro")}>Tema claro</Botao>
        </div>
        <label className="text-sm"><span className="mb-1 block text-xs text-muted-foreground">Data e horário simulados</span>
          <Entrada type="datetime-local" value={data} onChange={(e) => setData(e.target.value)} /></label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={rascunhos} onChange={(e) => setRascunhos(e.target.checked)} /> Incluir rascunhos</label>
      </div>
      <div className="mt-3"><SeletorLocalizacao base={base} valor={local} onMudar={setLocal} /></div>
      <div className={`mx-auto mt-4 rounded-lg border border-border bg-background p-4 text-foreground ${tema === "claro" ? "tema-claro" : "tema-escuro"} ${celular ? "max-w-[390px]" : ""}`}>
        {secoes.length ? <SecoesPublicas secoes={secoes} base={base} local={local} celular={celular} />
          : <EstadoVazio titulo="Nenhuma seção visível" descricao="Seções vazias, fora do período ou de outra região não aparecem." />}
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
      <Botao onClick={() => setEditando(parceiroVazio())}>Novo parceiro</Botao>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {base.parceiros.map((p) => (
          <Cartao key={p.id}>
            <div className="flex items-center gap-3">
              {p.logoUrl ? <img src={p.logoUrl} alt={p.textoAlt} className="h-12 w-20 rounded bg-secondary object-contain" /> : <div className="h-12 w-20 rounded bg-secondary" />}
              <div className="min-w-0 flex-1">
                <p className="font-medium">{p.nome}</p>
                <p className="text-xs text-muted-foreground">{p.tipo} · {p.links.length ? `${p.links.length} link(s)` : "sem link"}</p>
              </div>
              <Badge tom={p.ativo ? "sucesso" : "padrao"}>{p.ativo ? "ativo" : "inativo"}</Badge>
            </div>
            <div className="mt-3 flex gap-2">
              <Botao variante="contorno" onClick={() => setEditando(structuredClone(p))}>Editar</Botao>
              <Botao variante="fantasma" onClick={() => excluirParceiro(usuario, p.id)}>Excluir</Botao>
            </div>
          </Cartao>
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
    <Modal aberto titulo={d.id ? "Editar parceiro" : "Novo parceiro"} onFechar={onFechar}>
      <div className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <Campo htmlFor="pa-nome" rotulo="Nome"><Entrada id="pa-nome" value={d.nome} onChange={(e) => set({ nome: e.target.value })} /></Campo>
          <Campo htmlFor="pa-tipo" rotulo="Tipo">
            <Selecao id="pa-tipo" value={d.tipo} onChange={(e) => set({ tipo: e.target.value as Parceiro["tipo"] })}>
              <option value="patrocinador">Patrocinador</option><option value="apoiador">Apoiador</option><option value="ambos">Ambos</option>
            </Selecao>
          </Campo>
        </div>
        <Campo htmlFor="pa-desc" rotulo="Descrição curta (opcional)"><AreaTexto id="pa-desc" maxLength={160} value={d.descricao ?? ""} onChange={(e) => set({ descricao: e.target.value || undefined })} /></Campo>
        <div className="flex flex-wrap items-center gap-3">
          {d.logoUrl && <img src={d.logoUrl} alt="" className="h-14 w-24 rounded bg-secondary object-contain" />}
          <label className="cursor-pointer rounded-md border border-border px-3 py-2 text-sm">
            {d.logoUrl ? "Trocar logo" : "Enviar logo"}
            <input type="file" accept="image/*" className="sr-only" onChange={async (e) => {
              const f = e.target.files?.[0]; if (!f) return;
              try { set({ logoUrl: await arquivoParaDataUrl(f, 480, "image/png") }); } catch (er) { setErro((er as Error).message); }
            }} />
          </label>
          {d.logoUrl && <Botao variante="fantasma" onClick={() => set({ logoUrl: undefined })}>Remover logo</Botao>}
        </div>
        <Campo htmlFor="pa-alt" rotulo="Texto alternativo do logo"><Entrada id="pa-alt" value={d.textoAlt} onChange={(e) => set({ textoAlt: e.target.value })} /></Campo>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={d.ativo} onChange={(e) => set({ ativo: e.target.checked })} /> Ativo</label>

        <fieldset className="space-y-2 rounded-lg border border-border p-3">
          <legend className="text-sm font-medium">Links (nenhum é obrigatório)</legend>
          {d.links.map((l, i) => {
            const href = hrefDoLink(l);
            return (
              <div key={l.id} className="grid gap-2 rounded-md border border-border p-2 sm:grid-cols-2">
                <Selecao aria-label="Tipo de link" value={l.tipo} onChange={(e) => setLink(i, { tipo: e.target.value as LinkParceiro["tipo"] })}>
                  <option value="site">Site</option><option value="instagram">Instagram</option><option value="whatsapp">WhatsApp</option>
                  <option value="externo">Página externa</option><option value="outro">Outro</option>
                </Selecao>
                {l.tipo === "whatsapp" ? (
                  <>
                    <Entrada aria-label="Telefone com código do país" placeholder="+55 11 99999-0000" value={l.telefone ?? ""} onChange={(e) => setLink(i, { telefone: e.target.value })} />
                    <Entrada aria-label="Mensagem inicial (opcional)" placeholder="Mensagem inicial (opcional)" className="sm:col-span-2" value={l.mensagem ?? ""} onChange={(e) => setLink(i, { mensagem: e.target.value || undefined })} />
                  </>
                ) : (
                  <Entrada aria-label="Endereço" placeholder={l.tipo === "instagram" ? "@perfil ou link" : "https://..."} value={l.url ?? ""} onChange={(e) => setLink(i, { url: e.target.value })} />
                )}
                {l.tipo === "outro" && <Entrada aria-label="Rótulo" placeholder="Rótulo do botão" value={l.rotulo ?? ""} onChange={(e) => setLink(i, { rotulo: e.target.value })} />}
                <div className="flex flex-wrap items-center gap-2 text-xs sm:col-span-2">
                  <label className="flex items-center gap-1"><input type="radio" name="principal" checked={!!l.principal} onChange={() => set({ links: d.links.map((x, j) => ({ ...x, principal: j === i })) })} /> Link principal</label>
                  <span className={href ? "text-muted-foreground" : "text-destructive"}>{href ? `Formato válido: ${href}` : "Formato inválido"}</span>
                  <Botao variante="contorno" className="!py-1" disabled={!href} aria-label={`Testar ${rotuloDoLink(l)}`}
                    onClick={() => href && window.open(href, "_blank", "noopener,noreferrer")}>Testar link</Botao>
                  <Botao variante="fantasma" className="ml-auto !py-1" onClick={() => set({ links: d.links.filter((_, j) => j !== i) })}>Remover</Botao>
                </div>
              </div>
            );
          })}
          <Botao variante="contorno" onClick={() => set({ links: [...d.links, { id: gerarId("lk"), tipo: "site", url: "", principal: d.links.length === 0 }] })}>Adicionar link</Botao>
          <p className="text-xs text-muted-foreground">A validação confere apenas o formato; não garante que o destino esteja disponível.</p>
        </fieldset>
        {erro && <p role="alert" className="text-sm text-destructive">{erro}</p>}
        <div className="flex justify-end gap-2">
          <Botao variante="fantasma" onClick={onFechar}>Cancelar</Botao>
          <Botao onClick={async () => { setErro(""); try { await salvarParceiro(usuario, d); onFechar(); } catch (e) { setErro((e as Error).message); } }}>Salvar parceiro</Botao>
        </div>
      </div>
    </Modal>
  );
}
