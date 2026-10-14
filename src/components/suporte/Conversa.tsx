// Conversa de um chamado: histórico paginado, separadores por dia, eventos de
// histórico, estados de envio e compositor. Rolagem fica restrita ao histórico.
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, ArrowDown, FileText, Loader2, Paperclip, RotateCw, X } from "lucide-react";
import { linkAnexo } from "@/api/suporte.functions";
import { useSuporte } from "@/contexts/SuporteContext";
import { useConversa } from "./useConversa";
import { canalDe, diaDe, papelNoChamado, ROTULO_PAPEL, TAMANHO_MAX_ANEXO, TIPOS_ANEXO } from "@/lib/suporte";
import type { BaseDados, Chamado, MensagemChamado } from "@/lib/domain/types";
import { Botao } from "@/components/ui";

const PAGINA = 30;
const hora = (iso: string) => new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
const rotuloDia = (iso: string) => {
  const d = diaDe(iso);
  const hoje = diaDe(new Date().toISOString());
  const ontem = diaDe(new Date(Date.now() - 864e5).toISOString());
  if (d === hoje) return "Hoje";
  if (d === ontem) return "Ontem";
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
};
const kb = (n: number) => (n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

export function lerArquivo(f: File): Promise<string> {
  return new Promise((ok, falha) => {
    const r = new FileReader();
    r.onload = () => ok(String(r.result));
    r.onerror = () => falha(new Error("Não foi possível ler o arquivo."));
    r.readAsDataURL(f);
  });
}

export function validarArquivo(f: File): string | null {
  if (!(TIPOS_ANEXO as readonly string[]).includes(f.type)) return "Formato não aceito. Envie imagem (JPEG, PNG, WebP) ou PDF.";
  if (f.size > TAMANHO_MAX_ANEXO) return "Arquivo acima de 5 MB.";
  return null;
}

function BotaoAnexo({ chamadoId, m }: { chamadoId: string; m: MensagemChamado }) {
  const [abrindo, setAbrindo] = useState(false);
  const [erro, setErro] = useState("");
  if (!m.anexo) return null;
  const abrir = async () => {
    setAbrindo(true); setErro("");
    // Abre a aba antes da espera para não ser bloqueada; o link assinado vale 60 s.
    const janela = window.open("", "_blank");
    try {
      const url = await linkAnexo(chamadoId, m.id);
      if (janela) { janela.opener = null; janela.location.href = url; } else window.location.assign(url);
    } catch (e) { janela?.close(); setErro(e instanceof Error ? e.message : "Falha ao abrir."); } finally { setAbrindo(false); }
  };
  return (
    <div className="mt-2">
      <button type="button" onClick={abrir} disabled={abrindo}
        className="inline-flex max-w-full items-center gap-2 rounded-md border border-border bg-background/60 px-2 py-1 text-xs hover:bg-secondary">
        {abrindo ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4 shrink-0" />}
        <span className="truncate">{m.anexo.nome}</span>
        <span className="shrink-0 text-muted-foreground">{kb(m.anexo.tamanho)}</span>
      </button>
      {erro && <p className="mt-1 text-xs text-destructive">{erro}</p>}
    </div>
  );
}

interface PropsConversa {
  base: BaseDados; chamado: Chamado; usuarioId: string; somenteLeitura: boolean;
  /** Comunicação interna: mensagens desse encaminhamento e envio só para ele. */
  encaminhamentoId?: string | undefined;
  rotuloEnviar?: string; aviso?: string; textoVazio?: string;
}

export function Conversa({ base, chamado, usuarioId, somenteLeitura, encaminhamentoId, rotuloEnviar = "Enviar", aviso, textoVazio }: PropsConversa) {
  const { lidoAte, marcarLido } = useSuporte();
  const { rascunho, setRascunho, anexo, setAnexo, enviar, pendentes, tentarNovamente, descartar } = useConversa(chamado.id, usuarioId, encaminhamentoId);
  const [visiveis, setVisiveis] = useState(PAGINA);
  const [novas, setNovas] = useState(false);
  const [erroArquivo, setErroArquivo] = useState("");
  const rolagem = useRef<HTMLDivElement>(null);
  const campo = useRef<HTMLTextAreaElement>(null);
  const arquivo = useRef<HTMLInputElement>(null);
  const preservar = useRef<number | null>(null);
  const pertoDoFim = useRef(true);
  // Divisor "não lidas" fixado na abertura do chamado.
  const [lidoNaAbertura, setLidoNaAbertura] = useState<string | undefined>(() => lidoAte(chamado.id));

  useEffect(() => { setVisiveis(PAGINA); setNovas(false); pertoDoFim.current = true; setLidoNaAbertura(lidoAte(chamado.id)); setErroArquivo(""); },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [chamado.id]);

  const enviadas = new Set(chamado.mensagens.map((m) => m.clienteId).filter(Boolean));
  const meusPendentes = pendentes.filter((p) => !enviadas.has(p.clienteId));
  const todas = useMemo(() => chamado.mensagens.filter((m) => encaminhamentoId
    ? m.encaminhamentoId === encaminhamentoId
    : canalDe(m) === "participante"), [chamado.mensagens, encaminhamentoId]);
  const inicio = Math.max(0, todas.length - visiveis);
  const lista = todas.slice(inicio);
  const ultima = todas.at(-1);

  const nomeDe = (id: string) => {
    const u = base.usuarios.find((x) => x.id === id);
    return id === usuarioId ? "Você" : u ? (u.nomeExibicao || u.nomeCompleto) : "Pessoa removida";
  };

  const verificarFim = () => {
    const el = rolagem.current;
    if (!el) return;
    pertoDoFim.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    if (pertoDoFim.current) {
      setNovas(false);
      if (ultima && document.visibilityState === "visible") marcarLido(chamado.id, ultima.criadoEm);
    }
  };

  // Novas mensagens: acompanha se estiver perto do fim; senão só avisa.
  useLayoutEffect(() => {
    const el = rolagem.current;
    if (!el) return;
    if (preservar.current !== null) { el.scrollTop = el.scrollHeight - preservar.current; preservar.current = null; return; }
    if (pertoDoFim.current) { el.scrollTop = el.scrollHeight; verificarFim(); }
    else setNovas(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [todas.length, meusPendentes.length, chamado.id, encaminhamentoId]);

  useEffect(() => {
    const f = () => document.visibilityState === "visible" && verificarFim();
    document.addEventListener("visibilitychange", f);
    return () => document.removeEventListener("visibilitychange", f);
  });

  // Altura do campo acompanha o texto.
  useLayoutEffect(() => {
    const el = campo.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 180)}px`;
  }, [rascunho]);

  const carregarAnteriores = () => {
    const el = rolagem.current;
    if (el) preservar.current = el.scrollHeight - el.scrollTop;
    setVisiveis((v) => v + PAGINA);
  };

  const escolherArquivo = async (f: File | undefined) => {
    setErroArquivo("");
    if (!f) return;
    const e = validarArquivo(f);
    if (e) { setErroArquivo(e); return; }
    try { setAnexo({ nome: f.name, dataUrl: await lerArquivo(f) }); } catch (er) { setErroArquivo((er as Error).message); }
  };

  const submeter = () => {
    pertoDoFim.current = true;
    if (enviar()) campo.current?.focus();
  };

  const desktop = typeof window !== "undefined" && window.matchMedia("(pointer: fine)").matches;
  let diaAnterior = inicio > 0 ? diaDe(todas[inicio - 1]!.criadoEm) : "";
  let divisorMostrado = false;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div ref={rolagem} onScroll={verificarFim} className="relative min-h-0 flex-1 overflow-y-auto px-3 py-3 sm:px-4" aria-live="polite" aria-label="Histórico da conversa">
        {inicio > 0 && (
          <div className="mb-3 text-center">
            <Botao type="button" variante="contorno" className="!py-1 text-xs" onClick={carregarAnteriores}>Carregar mensagens anteriores</Botao>
          </div>
        )}
        {todas.length === 0 && textoVazio && <p className="py-6 text-center text-sm text-muted-foreground">{textoVazio}</p>}
        <ol className="space-y-2">
          {lista.map((m) => {
            const dia = diaDe(m.criadoEm);
            const separador = dia !== diaAnterior;
            diaAnterior = dia;
            const naoLida = !divisorMostrado && m.tipo !== "sistema" && m.autorId !== usuarioId && !!lidoNaAbertura && m.criadoEm > lidoNaAbertura;
            if (naoLida) divisorMostrado = true;
            const eu = m.autorId === usuarioId;
            const papel = papelNoChamado(base, m.autorId, chamado);
            return (
              <li key={m.id}>
                {separador && <p className="my-3 text-center text-xs font-medium text-muted-foreground"><span className="rounded-full bg-secondary px-3 py-1">{rotuloDia(m.criadoEm)}</span></p>}
                {naoLida && <p className="my-2 flex items-center gap-2 text-xs font-semibold text-accent"><span className="h-px flex-1 bg-accent/50" />Não lidas<span className="h-px flex-1 bg-accent/50" /></p>}
                {m.tipo === "sistema" ? (
                  <p className="mx-auto max-w-md rounded-md border border-dashed border-border px-3 py-1.5 text-center text-xs text-muted-foreground">
                    {m.acao?.tipo === "retorno" ? <>{nomeDe(m.autorId)}: {m.corpo}</> : m.acao?.tipo === "status" && m.acao.valor === "resolvido" ? <>Resolvido por {nomeDe(m.autorId)}: <span className="text-foreground">{m.corpo}</span></> : m.corpo}
                    <span className="ml-1">· {hora(m.criadoEm)}</span>
                  </p>
                ) : (
                  <div className={`flex ${eu ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[85%] rounded-lg border px-3 py-2 text-sm sm:max-w-[75%] ${eu ? "border-primary/30 bg-primary/10" : "border-border bg-secondary/60"}`}>
                      <p className="text-xs font-semibold">
                        {nomeDe(m.autorId)} <span className="font-normal text-muted-foreground">· {ROTULO_PAPEL[papel]}</span>
                      </p>
                      {m.corpo && <p className="mt-1 whitespace-pre-wrap break-words">{m.corpo}</p>}
                      <BotaoAnexo chamadoId={chamado.id} m={m} />
                      <p className="mt-1 text-right text-[11px] text-muted-foreground">
                        <time dateTime={m.criadoEm}>{hora(m.criadoEm)}</time>{eu && " · Enviada"}
                      </p>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
          {meusPendentes.map((p) => (
            <li key={p.clienteId} className="flex justify-end">
              <div className={`max-w-[85%] rounded-lg border px-3 py-2 text-sm sm:max-w-[75%] ${p.estado === "falha" ? "border-destructive/60 bg-destructive/10" : "border-primary/30 bg-primary/5 opacity-80"}`}>
                <p className="text-xs font-semibold">Você</p>
                {p.corpo && <p className="mt-1 whitespace-pre-wrap break-words">{p.corpo}</p>}
                {p.anexo && <p className="mt-1 flex items-center gap-1 text-xs"><FileText className="h-3.5 w-3.5" />{p.anexo.nome}</p>}
                {p.estado === "enviando" ? (
                  <p className="mt-1 flex items-center justify-end gap-1 text-[11px] text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin" />Enviando…</p>
                ) : (
                  <div className="mt-1 text-[11px]">
                    <p role="alert" className="flex items-center gap-1 text-destructive"><AlertCircle className="h-3 w-3" />Falha no envio{p.erro ? `: ${p.erro}` : ""}</p>
                    <div className="mt-1 flex justify-end gap-2">
                      <button type="button" className="inline-flex items-center gap-1 font-medium text-foreground underline-offset-2 hover:underline" onClick={() => tentarNovamente(p.clienteId)}><RotateCw className="h-3 w-3" />Tentar novamente</button>
                      <button type="button" className="text-muted-foreground hover:underline" onClick={() => descartar(p.clienteId)}>Voltar ao rascunho</button>
                    </div>
                  </div>
                )}
              </div>
            </li>
          ))}
        </ol>
        {novas && (
          <div className="sticky bottom-2 flex justify-center">
            <Botao type="button" className="!py-1 text-xs shadow-lg" onClick={() => { const el = rolagem.current; if (el) el.scrollTop = el.scrollHeight; verificarFim(); }}>
              <ArrowDown className="h-3.5 w-3.5" />Novas mensagens
            </Botao>
          </div>
        )}
      </div>

      {somenteLeitura ? (
        <p className="border-t border-border px-4 py-3 text-sm text-muted-foreground">Chamado fechado — somente leitura.</p>
      ) : (
        <div className="border-t border-border bg-card px-3 py-3 sm:px-4">
          {aviso && <p className="mb-2 text-[11px] font-medium text-muted-foreground">{aviso}</p>}
          {anexo && (
            <p className="mb-2 inline-flex max-w-full items-center gap-2 rounded-md border border-border px-2 py-1 text-xs">
              <Paperclip className="h-3.5 w-3.5 shrink-0" /><span className="truncate">{anexo.nome}</span>
              <button type="button" aria-label="Remover anexo" onClick={() => setAnexo(null)}><X className="h-3.5 w-3.5" /></button>
            </p>
          )}
          {erroArquivo && <p role="alert" className="mb-2 text-xs text-destructive">{erroArquivo}</p>}
          <div className="flex items-end gap-2">
            <input ref={arquivo} type="file" accept={TIPOS_ANEXO.join(",")} className="sr-only" tabIndex={-1}
              onChange={(e) => { void escolherArquivo(e.target.files?.[0]); e.target.value = ""; }} />
            <Botao type="button" variante="contorno" className="!px-2.5" aria-label="Anexar imagem ou PDF (até 5 MB)" title="Anexar imagem ou PDF (até 5 MB)" onClick={() => arquivo.current?.click()}>
              <Paperclip className="h-4 w-4" />
            </Botao>
            <label htmlFor={`msg-${chamado.id}${encaminhamentoId ?? ""}`} className="sr-only">Mensagem</label>
            <textarea id={`msg-${chamado.id}${encaminhamentoId ?? ""}`} ref={campo} rows={1} value={rascunho} maxLength={4000}
              placeholder="Escreva sua mensagem"
              onChange={(e) => setRascunho(e.target.value)}
              onKeyDown={(e) => { if (desktop && e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); submeter(); } }}
              className="min-h-10 flex-1 resize-none rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/40" />
            <Botao type="button" onClick={submeter} disabled={!rascunho.trim() && !anexo}>{rotuloEnviar}</Botao>
          </div>
          <p className="mt-1 hidden text-[11px] text-muted-foreground sm:block">Enter envia · Shift+Enter quebra linha · Anexos: imagem ou PDF até 5 MB</p>
        </div>
      )}
    </div>
  );
}
