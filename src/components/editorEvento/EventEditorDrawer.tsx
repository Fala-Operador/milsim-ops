// Painel lateral de criação/edição de eventos em etapas.
// Fecha somente por ação explícita (✕, Escape ou "Salvar e sair"): clique no fundo não fecha,
// e qualquer saída com alterações pendentes passa pela confirmação.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { Botao } from "@/components/ui";
import type { Evento } from "@/lib/domain/types";
import { ETAPAS, revisarEvento, validarEtapa, type Ocupacao } from "@/lib/eventoEditor";
import type { OcupacaoLote } from "@/lib/vendas";
import { carregarBase } from "@/services/db";
import { publicarEvento, salvarEvento } from "@/api/organizador.functions";
import { apagarRascunhoLocal, lerRascunhoLocal, salvarRascunhoLocal } from "@/services/rascunhoEvento";
import { EventStepNavigation } from "./EventStepNavigation";
import { EtapaCronograma, EtapaExercitos, EtapaGeral, EtapaLocal } from "./EventBasicSteps";
import { EtapaImagem } from "./EventImageStep";
import { EtapaIngressos } from "./EventTicketsStep";
import { EtapaRevisao } from "./EventReviewStep";

type EstadoSalvamento = "ocioso" | "salvando" | "salvo" | "erro";
const ESPERA_AUTOSAVE = 1500;

export interface PropsEditor {
  inicial: Evento;
  /** O evento já existe no servidor. */
  existente: boolean;
  etapaInicial?: number;
  ocupacao: Ocupacao;
  ocupacaoLote: OcupacaoLote;
  organizacoes: { id: string; nome: string }[];
  podeEscolherOrg: boolean;
  onFechar: () => void;
  onConcluido: (mensagem: string) => void;
}

function primeiraEtapaInvalida(ev: Evento, oc: Ocupacao) {
  for (let i = 0; i < ETAPAS.length - 1; i++) if (validarEtapa(ev, i, oc).length) return i;
  return ETAPAS.length - 1;
}

export function EventEditorDrawer(p: PropsEditor) {
  const { inicial, ocupacao } = p;
  const form = useForm<Evento>({ defaultValues: inicial });
  const ev = form.watch();
  // Evento publicado: edições ficam no dispositivo até "Salvar alterações".
  const modoServidor = inicial.status === "rascunho";
  const existeRef = useRef(p.existente);

  const [etapa, setEtapa] = useState(p.etapaInicial ?? 0);
  const [alcancada, setAlcancada] = useState(() => (p.existente ? Math.max(p.etapaInicial ?? 0, primeiraEtapaInvalida(inicial, ocupacao)) : (p.etapaInicial ?? 0)));
  const [erros, setErros] = useState<Record<string, string>>({});
  const [estado, setEstado] = useState<EstadoSalvamento>("ocioso");
  const [msg, setMsg] = useState("");
  const [confirmar, setConfirmar] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [entrou, setEntrou] = useState(false);
  const [versao, setVersao] = useState(0);
  const versaoRef = useRef(0);
  const salvoRef = useRef(0);
  const silencioso = useRef(false);
  const salvandoRef = useRef(false);
  const focoPendente = useRef<string | null>(null);
  const painelRef = useRef<HTMLDivElement>(null);
  const conteudoRef = useRef<HTMLDivElement>(null);
  const tituloRef = useRef<HTMLHeadingElement>(null);

  const set = useCallback(<K extends keyof Evento>(k: K, v: Evento[K]) => {
    form.setValue(k as never, v as never, { shouldDirty: true });
  }, [form]);
  const avisar = useCallback((m: string) => setMsg(m), []);

  // Cada alteração (exceto as internas de sincronização) conta como pendente.
  useEffect(() => {
    const sub = form.watch(() => {
      if (silencioso.current) return;
      versaoRef.current += 1;
      setVersao(versaoRef.current);
    });
    return () => sub.unsubscribe();
  }, [form]);

  // Restaura etapa e, para eventos publicados, as alterações locais pendentes.
  useEffect(() => {
    let vivo = true;
    void lerRascunhoLocal(inicial.id).then((r) => {
      if (!vivo || !r) return;
      if (!modoServidor && r.evento) {
        silencioso.current = true;
        form.reset(r.evento);
        silencioso.current = false;
        versaoRef.current += 1;
        setVersao(versaoRef.current);
        setMsg("Alterações não publicadas restauradas deste dispositivo.");
      }
      if (p.etapaInicial === undefined && r.etapa > 0) {
        const lim = primeiraEtapaInvalida(form.getValues(), ocupacao);
        setAlcancada((a) => Math.max(a, Math.min(r.etapa, lim)));
        setEtapa(Math.min(r.etapa, Math.max(lim, 0)));
      }
    });
    return () => { vivo = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inicial.id]);

  const pendente = versao !== salvoRef.current;

  const persistir = useCallback(async (manual: boolean): Promise<boolean> => {
    if (salvandoRef.current) return false;
    const snap = structuredClone(form.getValues());
    const v = versaoRef.current;
    if (modoServidor && !existeRef.current && !snap.nome.trim()) {
      if (manual) { setEstado("erro"); setMsg("Dê um nome ao evento para salvar o rascunho."); }
      return false;
    }
    salvandoRef.current = true;
    setEstado("salvando");
    try {
      if (modoServidor) {
        await salvarEvento(snap);
        existeRef.current = true;
        // Troca os arquivos recém-enviados pelas URLs persistidas, sem tocar em edições feitas durante o envio.
        const salvo = carregarBase().eventos.find((e) => e.id === snap.id);
        if (salvo) {
          const atual = form.getValues();
          silencioso.current = true;
          if (atual.imagemUrl === snap.imagemUrl && salvo.imagemUrl) form.setValue("imagemUrl", salvo.imagemUrl);
          if (salvo.imagem && JSON.stringify(atual.imagem) === JSON.stringify(snap.imagem)) form.setValue("imagem", salvo.imagem);
          if (salvo.regras && JSON.stringify(atual.regras) === JSON.stringify(snap.regras)) form.setValue("regras", salvo.regras);
          silencioso.current = false;
        }
      }
      await salvarRascunhoLocal({ eventoId: snap.id, etapa, evento: modoServidor ? undefined : snap });
      salvoRef.current = v;
      setVersao(versaoRef.current);
      setEstado("salvo");
      setMsg("");
      return true;
    } catch (e) {
      setEstado("erro");
      setMsg(e instanceof Error ? e.message : "Falha ao salvar.");
      return false;
    } finally {
      salvandoRef.current = false;
    }
  }, [form, modoServidor, etapa]);

  // Salvamento progressivo com espera.
  useEffect(() => {
    if (!pendente || estado === "salvando" || enviando) return;
    const t = setTimeout(() => { if (!salvandoRef.current) void persistir(false); }, ESPERA_AUTOSAVE);
    return () => clearTimeout(t);
  }, [versao, pendente, estado, enviando, persistir]);

  // Guarda a etapa atual para reabrir no mesmo ponto.
  useEffect(() => {
    void salvarRascunhoLocal({ eventoId: inicial.id, etapa, evento: modoServidor ? undefined : form.getValues() }).catch(() => undefined);
    conteudoRef.current?.scrollTo({ top: 0 });
  }, [etapa, inicial.id, modoServidor, form]);

  // Move o foco ao campo indicado (abrindo seções recolhidas).
  useEffect(() => {
    const id = focoPendente.current;
    if (!id) return;
    focoPendente.current = null;
    requestAnimationFrame(() => {
      const el = document.getElementById(id);
      el?.closest("details")?.setAttribute("open", "");
      el?.focus();
      el?.scrollIntoView({ block: "center" });
    });
  });

  const fecharDeVez = useCallback(() => {
    setEntrou(false);
    setTimeout(p.onFechar, 200);
  }, [p.onFechar]);

  const pedirFechar = useCallback(() => {
    if (pendente || estado === "erro" || estado === "salvando") setConfirmar(true);
    else fecharDeVez();
  }, [pendente, estado, fecharDeVez]);

  const salvarESair = async () => {
    setConfirmar(false);
    if (!pendente && estado !== "erro") return fecharDeVez();
    if (await persistir(true)) fecharDeVez();
  };

  const descartar = async () => {
    setConfirmar(false);
    if (!modoServidor) await apagarRascunhoLocal(inicial.id);
    fecharDeVez();
  };

  // Entrada animada, rolagem do fundo bloqueada, foco inicial.
  useEffect(() => {
    const anterior = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const foco = document.activeElement as HTMLElement | null;
    requestAnimationFrame(() => { setEntrou(true); tituloRef.current?.focus(); });
    return () => { document.body.style.overflow = anterior; foco?.focus?.(); };
  }, []);

  // Escape: fecha primeiro a confirmação; no painel, segue a mesma proteção do ✕. Tab fica preso no painel.
  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (e.defaultPrevented) return;
        e.preventDefault();
        if (confirmar) setConfirmar(false);
        else pedirFechar();
      } else if (e.key === "Tab" && painelRef.current) {
        const focaveis = [...painelRef.current.querySelectorAll<HTMLElement>("button:not([disabled]),input:not([disabled]):not(.sr-only),select,textarea,summary,canvas[tabindex],[tabindex='0']")]
          .filter((el) => el.offsetParent !== null);
        const prim = focaveis[0];
        const ult = focaveis[focaveis.length - 1];
        if (!prim || !ult) return;
        if (e.shiftKey && document.activeElement === prim) { e.preventDefault(); ult.focus(); }
        else if (!e.shiftKey && document.activeElement === ult) { e.preventDefault(); prim.focus(); }
      }
    };
    document.addEventListener("keydown", aoTeclar);
    return () => document.removeEventListener("keydown", aoTeclar);
  }, [confirmar, pedirFechar]);

  const irPara = useCallback((i: number, campo?: string) => {
    if (i > alcancada) return;
    const probs = i < ETAPAS.length - 1 ? validarEtapa(form.getValues(), i, ocupacao) : [];
    setErros(campo ? Object.fromEntries(probs.map((x) => [x.campo, x.mensagem])) : {});
    focoPendente.current = campo || null;
    setEtapa(i);
  }, [alcancada, form, ocupacao]);

  const continuar = () => {
    const probs = validarEtapa(form.getValues(), etapa, ocupacao);
    if (probs.length) {
      setErros(Object.fromEntries(probs.map((x) => [x.campo, x.mensagem])));
      focoPendente.current = probs[0]?.campo ?? null;
      setVersao((v) => v); // força o efeito de foco
      setMsg(`Revise ${probs.length === 1 ? "1 campo" : `${probs.length} campos`} desta etapa.`);
      return;
    }
    setErros({});
    setMsg("");
    const prox = etapa + 1;
    setAlcancada((a) => Math.max(a, prox));
    setEtapa(prox);
  };

  const revisao = useMemo(() => revisarEvento(ev, ocupacao, new Date(), p.ocupacaoLote), [ev, ocupacao, p.ocupacaoLote]);

  const finalizar = async () => {
    if (revisao.erros.length) {
      setMsg("Ainda há pendências que impedem concluir. Use os links da revisão.");
      return;
    }
    setEnviando(true);
    setMsg("");
    try {
      if (modoServidor) {
        if (!(await persistir(true))) return;
        await publicarEvento(inicial.id);
        await apagarRascunhoLocal(inicial.id);
        p.onConcluido("Operação publicada.");
      } else {
        setEstado("salvando");
        await salvarEvento(structuredClone(form.getValues()));
        await apagarRascunhoLocal(inicial.id);
        p.onConcluido("Alterações salvas.");
      }
      setEntrou(false);
      setTimeout(p.onFechar, 200);
    } catch (e) {
      setEstado("erro");
      setMsg(e instanceof Error ? e.message : "Falha ao concluir.");
    } finally {
      setEnviando(false);
    }
  };

  const textoEstado =
    estado === "salvando" ? "Salvando…"
    : estado === "erro" ? "Falha ao salvar"
    : pendente ? "Alterações não salvas"
    : estado === "salvo" ? (modoServidor ? "Salvo" : "Salvo neste dispositivo")
    : "";
  const ultima = etapa === ETAPAS.length - 1;
  const titulo = p.existente ? "Editar operação" : "Criar operação";

  return (
    <div className="fixed inset-0 z-50" role="presentation">
      {/* Fundo: não fecha ao clicar (evita perder o preenchimento por um clique fora). */}
      <div aria-hidden className={`absolute inset-0 bg-background/70 backdrop-blur-[1px] transition-opacity duration-200 motion-reduce:transition-none ${entrou ? "opacity-100" : "opacity-0"}`} />
      <div
        ref={painelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="editor-evento-titulo"
        className={`absolute inset-y-0 right-0 flex h-dvh w-full flex-col border-l border-border bg-popover text-popover-foreground shadow-2xl transition-transform duration-200 ease-out motion-reduce:transition-none md:w-[80vw] ${entrou ? "translate-x-0" : "translate-x-full"}`}
      >
        <header className="space-y-3 border-b border-border px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] md:px-6">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
            <div className="min-w-0">
              <h2 id="editor-evento-titulo" ref={tituloRef} tabIndex={-1} className="font-display text-lg font-semibold uppercase tracking-wide focus:outline-none">{titulo}</h2>
              <p className="truncate text-sm text-muted-foreground">
                {ev.nome ? <span className="text-foreground">{ev.nome} · </span> : null}
                Etapa {etapa + 1} de {ETAPAS.length}
                {textoEstado && <span role="status" className={`ml-2 ${estado === "erro" ? "text-destructive" : ""}`}>· {textoEstado}</span>}
              </p>
            </div>
            <Botao type="button" variante="fantasma" aria-label="Fechar editor" onClick={pedirFechar}>✕</Botao>
          </div>
          <EventStepNavigation atual={etapa} alcancada={alcancada} irPara={(i) => irPara(i)} />
        </header>

        <div ref={conteudoRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-5 md:px-6">
          <div className="mx-auto max-w-5xl">
            <h3 className="mb-4 font-display text-base font-semibold uppercase tracking-wider text-muted-foreground">{ETAPAS[etapa]?.titulo}</h3>
            {etapa === 0 && <EtapaGeral ev={ev} set={set} erros={erros} organizacoes={p.organizacoes} podeEscolherOrg={p.podeEscolherOrg && !p.existente} />}
            {etapa === 1 && <EtapaLocal ev={ev} set={set} erros={erros} />}
            {etapa === 2 && <EtapaImagem ev={ev} set={set} erros={erros} onErro={avisar} />}
            {etapa === 3 && <EtapaExercitos ev={ev} set={set} erros={erros} ocupacao={ocupacao} />}
            {etapa === 4 && <EtapaIngressos ev={ev} set={set} erros={erros} ocupacaoLote={p.ocupacaoLote} />}
            {etapa === 5 && <EtapaCronograma ev={ev} set={set} erros={erros} onErroArquivo={avisar} />}
            {etapa === 6 && <EtapaRevisao ev={ev} erros={revisao.erros} avisos={revisao.avisos} irPara={irPara} />}
          </div>
        </div>

        <footer className="border-t border-border px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 md:px-6">
          {msg && <p role="alert" className={`mb-2 text-sm ${estado === "erro" ? "text-destructive" : "text-muted-foreground"}`}>{msg}</p>}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Botao type="button" variante="contorno" disabled={etapa === 0} onClick={() => { setErros({}); setEtapa(etapa - 1); }}>Voltar</Botao>
            <div className="flex flex-wrap gap-2">
              <Botao type="button" variante="fantasma" disabled={enviando || estado === "salvando"} onClick={salvarESair}
                title={modoServidor ? undefined : "Guarda as alterações neste dispositivo sem alterar a página pública"}>Salvar e sair</Botao>
              {ultima ? (
                <Botao type="button" disabled={enviando || estado === "salvando"} onClick={finalizar}>
                  {enviando ? "Enviando…" : modoServidor ? "Publicar operação" : "Salvar alterações"}
                </Botao>
              ) : (
                <Botao type="button" onClick={continuar}>Continuar</Botao>
              )}
            </div>
          </div>
        </footer>

        {confirmar && (
          <div className="absolute inset-0 z-10 grid place-items-center bg-background/80 p-4">
            <div role="alertdialog" aria-modal="true" aria-labelledby="sair-titulo" aria-describedby="sair-desc" className="w-full max-w-md rounded-lg border border-border bg-card p-5 shadow-xl">
              <h3 id="sair-titulo" className="font-display text-base font-semibold uppercase">Sair do editor?</h3>
              <p id="sair-desc" className="mt-1 text-sm text-muted-foreground">
                {estado === "erro" ? "O último salvamento falhou. " : ""}Há alterações que ainda não foram salvas.
              </p>
              <div className="mt-4 flex flex-col gap-2">
                <Botao type="button" autoFocus onClick={salvarESair}>Salvar e sair</Botao>
                <Botao type="button" variante="perigo" onClick={descartar}>Descartar alterações não salvas</Botao>
                <Botao type="button" variante="contorno" onClick={() => setConfirmar(false)}>Continuar editando</Botao>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
