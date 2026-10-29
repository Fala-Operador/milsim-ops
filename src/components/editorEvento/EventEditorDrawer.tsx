// Painel lateral de criação/edição de eventos em etapas.
// Fecha somente por ação explícita (✕, Escape ou "Salvar e sair"): clique no fundo não fecha,
// e qualquer saída com alterações pendentes passa pela confirmação.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import type { Evento } from "@/lib/domain/types";
import { ETAPAS, problemasDoServidor, revisarEvento, validarEtapa, type Ocupacao, type Problema } from "@/lib/eventoEditor";
import type { OcupacaoLote } from "@/lib/vendas";
import { carregarBase } from "@/services/db";
import { publicarEvento, salvarEvento } from "@/api/organizador.functions";
import { apagarRascunhoLocal, lerRascunhoLocal, salvarRascunhoLocal } from "@/services/rascunhoEvento";
import { EventStepNavigation } from "./EventStepNavigation";
import { EtapaCronograma, EtapaExercitos, EtapaGeral, EtapaLocal } from "./EventBasicSteps";
import { EtapaImagem } from "./EventImageStep";
import { EtapaIngressos } from "./EventTicketsStep";
import { EtapaRevisao } from "./EventReviewStep";
import { ABRIR_SECAO } from "./comum";
import { AvisoRecebimento } from "@/components/AvisoRecebimento";
import { tr } from "@/i18n/components/editorEvento/EventEditorDrawer";

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
  // Pendências apontadas pelo servidor ao publicar/salvar, já separadas por etapa.
  const [errosServidor, setErrosServidor] = useState<Problema[]>([]);
  const [confirmar, setConfirmar] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [entrou, setEntrou] = useState(false);
  const [versao, setVersao] = useState(0);
  const versaoRef = useRef(0);
  const salvoRef = useRef(0);
  const silencioso = useRef(false);
  const salvandoRef = useRef(false);
  const focoPendente = useRef<string | null>(null);
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
        setMsg(tr("alteracoes_nao_publicadas_restauradas_de"));
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
      if (manual) { setEstado("erro"); setMsg(tr("de_um_nome_ao_evento_para")); }
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
      setMsg(e instanceof Error ? e.message : tr("falha_ao_salvar"));
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
      el?.closest("[data-secao]")?.dispatchEvent(new Event(ABRIR_SECAO));
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

  // Entrada animada; rolagem do fundo, foco preso e Esc (fecha a confirmação antes do painel) ficam com o Sheet/AlertDialog.
  // O foco volta para onde estava antes de abrir.
  const focoAnterior = useRef<HTMLElement | null>(null);
  useEffect(() => {
    focoAnterior.current = document.activeElement as HTMLElement | null;
    requestAnimationFrame(() => setEntrou(true));
    return () => focoAnterior.current?.focus?.();
  }, []);

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
      setMsg(probs.length === 1 ? tr("revise_1_campo") : tr("revise_n_campos", { n: probs.length }));
      return;
    }
    setErros({});
    setMsg("");
    const prox = etapa + 1;
    setAlcancada((a) => Math.max(a, prox));
    setEtapa(prox);
  };

  const revisao = useMemo(() => revisarEvento(ev, ocupacao, new Date(), p.ocupacaoLote), [ev, ocupacao, p.ocupacaoLote]);
  // Etapas já percorridas que ainda têm pendência (as futuras ainda não foram preenchidas).
  const etapasComErro = useMemo(
    () => new Set([...revisao.erros.filter((e) => e.etapa <= alcancada).map((e) => e.etapa), ...errosServidor.map((e) => e.etapa)]),
    [revisao.erros, errosServidor, alcancada],
  );

  const irParaProblema = (x: Problema) => {
    irPara(x.etapa, x.campo || undefined);
    if (x.campo) setErros((atual) => ({ ...atual, [x.campo]: x.mensagem }));
  };

  const finalizar = async () => {
    if (revisao.erros.length) {
      setMsg(tr("ainda_ha_pendencias_que_impedem_concluir"));
      return;
    }
    setEnviando(true);
    setMsg("");
    setErrosServidor([]);
    try {
      if (modoServidor) {
        if (!(await persistir(true))) return;
        await publicarEvento(inicial.id);
        await apagarRascunhoLocal(inicial.id);
        p.onConcluido(tr("operacao_publicada"));
      } else {
        setEstado("salvando");
        await salvarEvento(structuredClone(form.getValues()));
        await apagarRascunhoLocal(inicial.id);
        p.onConcluido(tr("alteracoes_salvas"));
      }
      setEntrou(false);
      setTimeout(p.onFechar, 200);
    } catch (e) {
      setEstado("erro");
      const mensagem = e instanceof Error ? e.message : tr("falha_ao_concluir");
      const probs = problemasDoServidor(mensagem, form.getValues());
      // Só vira lista por etapa quando é validação do evento (falha de rede etc. segue como texto).
      if (probs.some((x) => x.etapa < ETAPAS.length - 1)) {
        setErrosServidor(probs);
        // Erros com campo (ex.: cada atividade do cronograma) também aparecem no próprio card.
        setErros(Object.fromEntries(probs.filter((x) => x.campo).map((x) => [x.campo, x.mensagem])));
        setMsg(probs.length === 1 ? tr("nao_foi_possivel_concluir_corrija_a") : tr("nao_foi_possivel_concluir_corrija_as", { length: probs.length }));
      } else {
        setMsg(mensagem);
      }
    } finally {
      setEnviando(false);
    }
  };

  const textoEstado =
    estado === "salvando" ? tr("salvando")
    : estado === "erro" ? tr("falha_ao_salvar_2")
    : pendente ? tr("alteracoes_nao_salvas")
    : estado === "salvo" ? (modoServidor ? tr("salvo") : tr("salvo_neste_dispositivo"))
    : "";
  const ultima = etapa === ETAPAS.length - 1;
  const titulo = p.existente ? tr("editar_operacao") : tr("criar_operacao");

  return (
    <Sheet open={entrou} onOpenChange={(abrir) => !abrir && pedirFechar()}>
      {/* Fundo: não fecha ao clicar (evita perder o preenchimento por um clique fora). */}
      <SheetContent
        side="right"
        showCloseButton={false}
        aria-describedby={undefined}
        overlayClassName="bg-background/70 backdrop-blur-[1px] data-[state=closed]:duration-200 data-[state=open]:duration-200"
        onInteractOutside={(e) => e.preventDefault()}
        onOpenAutoFocus={(e) => { e.preventDefault(); tituloRef.current?.focus(); }}
        onCloseAutoFocus={(e) => e.preventDefault()}
        className="flex h-dvh w-full flex-col gap-0 p-0 shadow-2xl ease-out data-[state=closed]:duration-200 data-[state=open]:duration-200 motion-reduce:animate-none sm:max-w-none md:w-[80vw]"
      >
        <header className="space-y-3 border-b border-border px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] md:px-6">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
            <div className="min-w-0">
              <SheetTitle id="editor-evento-titulo" ref={tituloRef} tabIndex={-1} className="uppercase tracking-wide focus:outline-none">{titulo}</SheetTitle>
              <p className="truncate text-sm text-muted-foreground">
                {ev.nome ? <span className="text-foreground">{ev.nome} · </span> : null}{tr("etapa_valor_de_length", { valor: etapa + 1, length: ETAPAS.length })}
                {textoEstado && <span role="status" className={`ml-2 ${estado === "erro" ? "text-destructive" : ""}`}>· {textoEstado}</span>}
              </p>
            </div>
            <Button type="button" variant="ghost" aria-label={tr("fechar_editor")} onClick={pedirFechar}>✕</Button>
          </div>
          <EventStepNavigation atual={etapa} alcancada={alcancada} comErro={etapasComErro} irPara={(i) => irPara(i)} />
        </header>

        <div ref={conteudoRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-5 md:px-6">
          <div className="mx-auto max-w-5xl">
            <AvisoRecebimento organizacaoId={ev.organizacaoId} className="mb-4" />
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
          {errosServidor.length > 0 && (
            <ul className="mb-3 max-h-40 space-y-1 overflow-y-auto text-sm" aria-label={tr("pendencias_por_etapa")}>
              {errosServidor.map((x, i) => (
                <li key={i} className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-1.5 text-destructive">
                  <span className="shrink-0 font-medium">{tr("etapa_valor_titulo", { valor: x.etapa + 1, titulo: ETAPAS[x.etapa]?.titulo })}</span>
                  <span className="min-w-0 flex-1 break-words">{x.mensagem}</span>
                  <Button type="button" variant="outline" className="h-7 shrink-0 px-2 text-xs" onClick={() => irParaProblema(x)}>{tr("ir_para_a_etapa")}</Button>
                </li>
              ))}
            </ul>
          )}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Button type="button" variant="outline" disabled={etapa === 0} onClick={() => { setErros({}); setEtapa(etapa - 1); }}>{tr("voltar")}</Button>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="ghost" disabled={enviando || estado === "salvando"} onClick={salvarESair}
                title={modoServidor ? undefined : tr("guarda_as_alteracoes_neste_dispositivo_s")}>{tr("salvar_e_sair")}</Button>
              {ultima ? (
                <Button type="button" disabled={enviando || estado === "salvando"} onClick={finalizar}>
                  {enviando ? tr("enviando") : modoServidor ? tr("publicar_operacao") : tr("salvar_alteracoes")}
                </Button>
              ) : (
                <Button type="button" onClick={continuar}>{tr("continuar")}</Button>
              )}
            </div>
          </div>
        </footer>

        <AlertDialog open={confirmar} onOpenChange={setConfirmar}>
          <AlertDialogContent
            overlayClassName="bg-background/80"
            onOpenAutoFocus={(e) => e.preventDefault()}
            className="block w-[calc(100%-2rem)] max-w-md rounded-lg bg-card p-5 text-card-foreground"
          >
            <AlertDialogTitle className="text-base uppercase">{tr("sair_do_editor")}</AlertDialogTitle>
            <AlertDialogDescription className="mt-1">
              {estado === "erro" ? `${tr("o_ultimo_salvamento_falhou")} ` : ""}{tr("ha_alteracoes_que_ainda_nao_foram")}</AlertDialogDescription>
            <div className="mt-4 flex flex-col gap-2">
              <Button type="button" autoFocus onClick={salvarESair}>{tr("salvar_e_sair")}</Button>
              <Button type="button" variant="destructive" onClick={descartar}>{tr("descartar_alteracoes_nao_salvas")}</Button>
              <Button type="button" variant="outline" onClick={() => setConfirmar(false)}>{tr("continuar_editando")}</Button>
            </div>
          </AlertDialogContent>
        </AlertDialog>
      </SheetContent>
    </Sheet>
  );
}
