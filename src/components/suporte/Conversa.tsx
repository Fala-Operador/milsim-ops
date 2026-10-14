// Conversa de um chamado: histórico paginado com rolagem própria, separadores por dia,
// eventos do atendimento discretos, estados de envio e área inferior (compositor ou,
// quando o status não aceita mensagens, o `rodape` recebido de quem chama).
import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  AlertCircle,
  ArrowDown,
  FileText,
  Loader2,
  Paperclip,
  RotateCw,
  SendHorizontal,
  X,
} from "lucide-react";
import { linkAnexo } from "@/api/suporte.functions";
import { useSuporte } from "@/contexts/SuporteContext";
import { useConversa } from "./useConversa";
import {
  canalDe,
  diaDe,
  papelNoChamado,
  ROTULO_PAPEL,
  TAMANHO_MAX_ANEXO,
  TIPOS_ANEXO,
} from "@/lib/suporte";
import type { BaseDados, Chamado, MensagemChamado } from "@/lib/domain/types";
import { Botao } from "@/components/ui";

const PAGINA = 30;
const AGRUPAR_MS = 10 * 60_000; // mensagens seguidas da mesma pessoa em até 10 min: sem repetir o nome
const hora = (iso: string) =>
  new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
const rotuloDia = (iso: string) => {
  const d = diaDe(iso);
  const hoje = diaDe(new Date().toISOString());
  const ontem = diaDe(new Date(Date.now() - 864e5).toISOString());
  if (d === hoje) return "Hoje";
  if (d === ontem) return "Ontem";
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
};
const kb = (n: number) =>
  n > 1024 * 1024
    ? `${(n / 1024 / 1024).toFixed(1)} MB`
    : `${Math.max(1, Math.round(n / 1024))} KB`;

/** Texto da mensagem com links http(s) clicáveis (o React escapa o resto; nada vira HTML). */
function TextoComLinks({ texto }: { texto: string }) {
  const partes = texto.split(/(https?:\/\/[^\s<>"]+)/g);
  return (
    <>
      {partes.map((p, i) =>
        i % 2 === 1 ? (
          <a
            key={i}
            href={p}
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2 [overflow-wrap:anywhere] hover:opacity-80"
          >
            {p}
          </a>
        ) : (
          <Fragment key={i}>{p}</Fragment>
        ),
      )}
    </>
  );
}

export function lerArquivo(f: File): Promise<string> {
  return new Promise((ok, falha) => {
    const r = new FileReader();
    r.onload = () => ok(String(r.result));
    r.onerror = () => falha(new Error("Não foi possível ler o arquivo."));
    r.readAsDataURL(f);
  });
}

export function validarArquivo(f: File): string | null {
  if (!(TIPOS_ANEXO as readonly string[]).includes(f.type))
    return "Formato não aceito. Envie imagem (JPEG, PNG, WebP) ou PDF.";
  if (f.size > TAMANHO_MAX_ANEXO) return "Arquivo acima de 5 MB.";
  return null;
}

function BotaoAnexo({ chamadoId, m }: { chamadoId: string; m: MensagemChamado }) {
  const [abrindo, setAbrindo] = useState(false);
  const [erro, setErro] = useState("");
  if (!m.anexo) return null;
  const abrir = async () => {
    setAbrindo(true);
    setErro("");
    // Abre a aba antes da espera para não ser bloqueada; o link assinado vale 60 s.
    const janela = window.open("", "_blank");
    try {
      const url = await linkAnexo(chamadoId, m.id);
      if (janela) {
        janela.opener = null;
        janela.location.href = url;
      } else window.location.assign(url);
    } catch (e) {
      janela?.close();
      setErro(e instanceof Error ? e.message : "Falha ao abrir.");
    } finally {
      setAbrindo(false);
    }
  };
  return (
    <div className="mt-2 min-w-0">
      <button
        type="button"
        onClick={abrir}
        disabled={abrindo}
        className="inline-flex max-w-full items-center gap-2 rounded-md border border-border bg-background/60 px-2 py-1 text-xs hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {abrindo ? (
          <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
        ) : (
          <FileText className="h-4 w-4 shrink-0" />
        )}
        <span className="min-w-0 truncate">{m.anexo.nome}</span>
        <span className="shrink-0 text-muted-foreground">{kb(m.anexo.tamanho)}</span>
      </button>
      {erro && <p className="mt-1 text-xs text-destructive">{erro}</p>}
    </div>
  );
}

const BALAO = "max-w-[88%] min-w-0 rounded-2xl px-3.5 py-2 text-sm leading-relaxed sm:max-w-[80%]";

export function Conversa({
  base,
  chamado,
  usuarioId,
  rodape,
  somenteLeitura = false,
  encaminhamentoId,
  rotuloEnviar = "Enviar",
  aviso,
  textoVazio,
}: {
  base: BaseDados;
  chamado: Chamado;
  usuarioId: string;
  /** Substitui o compositor quando o status não aceita mensagens (resolvido/fechado). */
  rodape?: ReactNode;
  /** Sem compositor (ex.: chamado fechado). */
  somenteLeitura?: boolean;
  /** Mostra só as mensagens desse encaminhamento; sem ele, a conversa com o participante. */
  encaminhamentoId?: string | undefined;
  rotuloEnviar?: string;
  /** Aviso discreto acima do compositor. */
  aviso?: string;
  textoVazio?: string;
}) {
  const { lidoAte, marcarLido } = useSuporte();
  const { rascunho, setRascunho, anexo, setAnexo, enviar, pendentes, tentarNovamente, descartar } =
    useConversa(chamado.id, usuarioId, encaminhamentoId);
  const [visiveis, setVisiveis] = useState(PAGINA);
  const [novas, setNovas] = useState(false);
  const [erroArquivo, setErroArquivo] = useState("");
  const rolagem = useRef<HTMLDivElement>(null);
  const campo = useRef<HTMLTextAreaElement>(null);
  const arquivo = useRef<HTMLInputElement>(null);
  const preservar = useRef<number | null>(null);
  const pertoDoFim = useRef(true);
  // Divisor "não lidas" fixado na abertura do chamado.
  const [lidoNaAbertura, setLidoNaAbertura] = useState<string | undefined>(() =>
    lidoAte(chamado.id),
  );

  useEffect(
    () => {
      setVisiveis(PAGINA);
      setNovas(false);
      pertoDoFim.current = true;
      setLidoNaAbertura(lidoAte(chamado.id));
      setErroArquivo("");
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [chamado.id],
  );

  const enviadas = new Set(chamado.mensagens.map((m) => m.clienteId).filter(Boolean));
  const meusPendentes = pendentes.filter((p) => !enviadas.has(p.clienteId));
  const todas = useMemo<MensagemChamado[]>(
    () =>
      chamado.mensagens.filter((m: MensagemChamado) =>
        encaminhamentoId ? (m as MensagemChamado & { encaminhamentoId?: string }).encaminhamentoId === encaminhamentoId : canalDe(m) === "participante",
      ),
    [chamado.mensagens, encaminhamentoId],
  );
  const inicio = Math.max(0, todas.length - visiveis);
  const lista = todas.slice(inicio);
  const ultima = todas.at(-1);

  const nomeDe = (id: string) => {
    const u = base.usuarios.find((x) => x.id === id);
    return id === usuarioId ? "Você" : u ? u.nomeExibicao || u.nomeCompleto : "Pessoa removida";
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

  // Novas mensagens: acompanha se estiver perto do fim; se a pessoa lê mensagens antigas, só avisa.
  useLayoutEffect(() => {
    const el = rolagem.current;
    if (!el) return;
    if (preservar.current !== null) {
      el.scrollTop = el.scrollHeight - preservar.current;
      preservar.current = null;
      return;
    }
    if (pertoDoFim.current) {
      el.scrollTop = el.scrollHeight;
      verificarFim();
    } else setNovas(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [todas.length, meusPendentes.length, chamado.id, encaminhamentoId]);

  useEffect(() => {
    const f = () => document.visibilityState === "visible" && verificarFim();
    document.addEventListener("visibilitychange", f);
    return () => document.removeEventListener("visibilitychange", f);
  });

  // Altura do campo acompanha o texto, com limite.
  useLayoutEffect(() => {
    const el = campo.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
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
    if (e) {
      setErroArquivo(e);
      return;
    }
    try {
      setAnexo({ nome: f.name, dataUrl: await lerArquivo(f) });
    } catch (er) {
      setErroArquivo((er as Error).message);
    }
  };

  const submeter = () => {
    pertoDoFim.current = true;
    if (enviar()) campo.current?.focus();
  };

  const desktop = typeof window !== "undefined" && window.matchMedia("(pointer: fine)").matches;
  let diaAnterior = inicio > 0 ? diaDe(todas[inicio - 1]!.criadoEm) : "";
  let anterior: MensagemChamado | undefined = inicio > 0 ? todas[inicio - 1] : undefined;
  let divisorMostrado = false;

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <div
        ref={rolagem}
        onScroll={verificarFim}
        role="region"
        className="rolagem-discreta relative min-h-0 flex-1 px-3 py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:px-4"
        aria-label="Histórico da conversa"
        tabIndex={0}
      >
        {inicio > 0 && (
          <div className="mb-3 text-center">
            <Botao
              type="button"
              variante="contorno"
              className="!py-1 text-xs"
              onClick={carregarAnteriores}
            >
              Carregar mensagens anteriores
            </Botao>
          </div>
        )}
        <ol className="flex flex-col" aria-live="polite">
          {lista.map((m) => {
            const dia = diaDe(m.criadoEm);
            const separador = dia !== diaAnterior;
            diaAnterior = dia;
            const naoLida =
              !divisorMostrado &&
              m.tipo !== "sistema" &&
              m.autorId !== usuarioId &&
              !!lidoNaAbertura &&
              m.criadoEm > lidoNaAbertura;
            if (naoLida) divisorMostrado = true;
            const eu = m.autorId === usuarioId;
            const continuacao =
              !separador &&
              !naoLida &&
              anterior?.tipo !== "sistema" &&
              anterior?.autorId === m.autorId &&
              Date.parse(m.criadoEm) - Date.parse(anterior!.criadoEm) < AGRUPAR_MS;
            anterior = m;
            const papel = papelNoChamado(base, m.autorId, chamado);
            return (
              <li key={m.id} className={continuacao ? "mt-1" : "mt-3 first:mt-0"}>
                {separador && (
                  <p className="mb-3 flex justify-center">
                    <span className="rounded-full bg-secondary px-3 py-1 text-xs font-medium text-muted-foreground">
                      {rotuloDia(m.criadoEm)}
                    </span>
                  </p>
                )}
                {naoLida && (
                  <p className="mb-3 flex items-center gap-2 text-xs font-semibold text-accent">
                    <span className="h-px flex-1 bg-accent/50" />
                    Não lidas
                    <span className="h-px flex-1 bg-accent/50" />
                  </p>
                )}
                {m.tipo === "sistema" ? (
                  <p className="mx-auto w-fit max-w-[92%] break-words rounded-md bg-secondary/50 px-3 py-1 text-center text-xs text-muted-foreground">
                    {m.acao?.tipo === "status" && m.acao.valor === "resolvido" ? (
                      <>
                        Resolvido por {nomeDe(m.autorId)}: <TextoComLinks texto={m.corpo} />
                      </>
                    ) : (
                      m.corpo
                    )}
                    <span className="ml-1 whitespace-nowrap opacity-80">· {hora(m.criadoEm)}</span>
                  </p>
                ) : (
                  <div className={`flex min-w-0 flex-col ${eu ? "items-end" : "items-start"}`}>
                    {!eu && !continuacao && (
                      <p className="mb-1 max-w-full truncate px-1 text-xs font-semibold">
                        {nomeDe(m.autorId)}{" "}
                        <span className="font-normal text-muted-foreground">
                          · {ROTULO_PAPEL[papel]}
                        </span>
                      </p>
                    )}
                    <div
                      className={`${BALAO} ${eu ? "rounded-br-md bg-primary/15" : "rounded-bl-md border border-border bg-secondary/60"}`}
                    >
                      {m.corpo && (
                        <p className="whitespace-pre-wrap [overflow-wrap:anywhere]">
                          <TextoComLinks texto={m.corpo} />
                        </p>
                      )}
                      <BotaoAnexo chamadoId={chamado.id} m={m} />
                      <p className="mt-0.5 text-right text-[11px] leading-4 text-muted-foreground">
                        <time dateTime={m.criadoEm}>{hora(m.criadoEm)}</time>
                      </p>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
          {meusPendentes.map((p) => (
            <li key={p.clienteId} className="mt-1 flex min-w-0 justify-end">
              <div
                className={`${BALAO} rounded-br-md ${p.estado === "falha" ? "border border-destructive/60 bg-destructive/10" : "bg-primary/10 opacity-80"}`}
              >
                {p.corpo && (
                  <p className="whitespace-pre-wrap [overflow-wrap:anywhere]">{p.corpo}</p>
                )}
                {p.anexo && (
                  <p className="mt-1 flex min-w-0 items-center gap-1 text-xs">
                    <FileText className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{p.anexo.nome}</span>
                  </p>
                )}
                {p.estado === "enviando" ? (
                  <p className="mt-0.5 flex items-center justify-end gap-1 text-[11px] text-muted-foreground">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Enviando…
                  </p>
                ) : (
                  <div className="mt-1 text-[11px]">
                    <p role="alert" className="flex items-center gap-1 text-destructive">
                      <AlertCircle className="h-3 w-3 shrink-0" />
                      Falha no envio{p.erro ? `: ${p.erro}` : ""}
                    </p>
                    <div className="mt-1 flex flex-wrap justify-end gap-x-3 gap-y-1">
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 font-medium text-foreground underline-offset-2 hover:underline"
                        onClick={() => tentarNovamente(p.clienteId)}
                      >
                        <RotateCw className="h-3 w-3" />
                        Tentar novamente
                      </button>
                      <button
                        type="button"
                        className="text-muted-foreground hover:underline"
                        onClick={() => descartar(p.clienteId)}
                      >
                        Voltar ao rascunho
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </li>
          ))}
        </ol>
        {novas && (
          <div className="pointer-events-none sticky bottom-2 flex justify-center">
            <Botao
              type="button"
              className="pointer-events-auto !py-1 text-xs shadow-lg"
              onClick={() => {
                const el = rolagem.current;
                if (el) el.scrollTop = el.scrollHeight;
                verificarFim();
              }}
            >
              <ArrowDown className="h-3.5 w-3.5" />
              Novas mensagens
            </Botao>
          </div>
        )}
      </div>

      {todas.length === 0 && textoVazio && <p className="px-4 py-2 text-center text-sm text-muted-foreground">{textoVazio}</p>}
      {!somenteLeitura && aviso && <p className="px-4 pt-2 text-xs text-muted-foreground">{aviso}</p>}
      {somenteLeitura ? rodape ?? null : rodape ?? (
        <div className="border-t border-border bg-card px-3 py-2.5 sm:px-4">
          {anexo && (
            <p className="mb-2 inline-flex max-w-full items-center gap-2 rounded-md border border-border px-2 py-1 text-xs">
              <Paperclip className="h-3.5 w-3.5 shrink-0" />
              <span className="min-w-0 truncate">{anexo.nome}</span>
              <button
                type="button"
                className="shrink-0"
                aria-label="Remover anexo"
                onClick={() => setAnexo(null)}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </p>
          )}
          {erroArquivo && (
            <p role="alert" className="mb-2 text-xs text-destructive">
              {erroArquivo}
            </p>
          )}
          <div className="flex min-w-0 items-end gap-2">
            <input
              ref={arquivo}
              type="file"
              accept={TIPOS_ANEXO.join(",")}
              className="sr-only"
              tabIndex={-1}
              onChange={(e) => {
                void escolherArquivo(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
            <Botao
              type="button"
              variante="contorno"
              className="h-10 shrink-0 !px-2.5"
              aria-label="Anexar imagem ou PDF (até 5 MB)"
              title="Anexar imagem ou PDF (até 5 MB)"
              onClick={() => arquivo.current?.click()}
            >
              <Paperclip className="h-4 w-4" />
            </Botao>
            <label htmlFor={`msg-${chamado.id}${encaminhamentoId ?? ""}`} className="sr-only">
              Mensagem
            </label>
            <textarea
              id={`msg-${chamado.id}${encaminhamentoId ?? ""}`}
              ref={campo}
              rows={1}
              value={rascunho}
              maxLength={4000}
              placeholder="Escreva sua mensagem"
              onChange={(e) => setRascunho(e.target.value)}
              onKeyDown={(e) => {
                if (desktop && e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  submeter();
                }
              }}
              className="rolagem-discreta block min-h-10 min-w-0 flex-1 resize-none rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/40"
            />
            <Botao
              type="button"
              className="h-10 shrink-0 !px-3"
              onClick={submeter}
              disabled={!rascunho.trim() && !anexo}
              aria-label={rotuloEnviar === "Enviar" ? "Enviar mensagem" : rotuloEnviar}
            >
              <SendHorizontal className="h-4 w-4" />
              <span className="hidden @min-[480px]:inline">{rotuloEnviar}</span>
            </Botao>
          </div>
          <p className="mt-1 hidden text-[11px] text-muted-foreground @min-[560px]:block">
            Enter envia · Shift+Enter quebra linha · Imagem ou PDF até 5 MB
          </p>
        </div>
      )}
    </div>
  );
}
