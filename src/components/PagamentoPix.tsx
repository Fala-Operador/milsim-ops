// Peças do pagamento por PIX manual: instruções da reserva, envio do comprovante
// (bucket privado, via server function) e abertura do comprovante por link assinado.
import { useState } from "react";
import { Check, Copy, Eye, Upload } from "lucide-react";
import { Botao } from "@/components/ui";
import { enviarComprovante, linkComprovante } from "@/api/inscricoes.functions";
import { formatarBRL } from "@/lib/domain/money";
import type { Evento, Inscricao } from "@/lib/domain/types";

export const TIPOS_COMPROVANTE = "application/pdf,image/jpeg,image/png,image/webp";
const TAMANHO_MAX = 5 * 1024 * 1024;

const dataHora = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

function lerDataUrl(f: File): Promise<string> {
  return new Promise((ok, falha) => {
    const r = new FileReader();
    r.onload = () => ok(String(r.result));
    r.onerror = () => falha(new Error("Não foi possível ler o arquivo."));
    r.readAsDataURL(f);
  });
}

/** Chave PIX, titular, valor e prazo da reserva. */
export function InstrucoesPix({ evento, inscricao }: { evento: Evento; inscricao: Inscricao }) {
  const [copiado, setCopiado] = useState(false);
  const p = evento.pagamento;
  if (!p) return null;
  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(p.chavePix);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch { /* sem permissão de área de transferência: a chave continua visível */ }
  };
  return (
    <div className="rounded-md border border-border bg-secondary/40 p-3 text-sm">
      <p className="font-medium">Pague por PIX e envie o comprovante</p>
      <dl className="mt-2 grid gap-1 @min-[480px]:grid-cols-[auto_1fr] @min-[480px]:gap-x-3">
        <dt className="text-muted-foreground">Valor</dt>
        <dd className="font-medium">{formatarBRL(inscricao.valorCentavos - inscricao.descontoCentavos)}</dd>
        <dt className="text-muted-foreground">Chave PIX</dt>
        <dd className="flex min-w-0 flex-wrap items-center gap-2">
          <span className="break-all font-mono">{p.chavePix}</span>
          <button type="button" onClick={copiar} className="inline-flex items-center gap-1 rounded border border-border px-1.5 py-0.5 text-xs hover:bg-secondary">
            {copiado ? <Check className="h-3 w-3" aria-hidden="true" /> : <Copy className="h-3 w-3" aria-hidden="true" />}
            {copiado ? "Copiada" : "Copiar"}
          </button>
        </dd>
        <dt className="text-muted-foreground">Titular</dt>
        <dd>{p.titular}</dd>
        {inscricao.reservaAte && inscricao.status === "aguardando_pagamento" && (
          <>
            <dt className="text-muted-foreground">Enviar até</dt>
            <dd className="font-medium">{dataHora(inscricao.reservaAte)}</dd>
          </>
        )}
      </dl>
      {p.instrucoes && <p className="mt-2 whitespace-pre-line text-muted-foreground">{p.instrucoes}</p>}
    </div>
  );
}

/** Envia (ou substitui, enquanto em análise) o comprovante da própria inscrição. */
export function EnvioComprovante({ inscricao, onEnviado }: { inscricao: Inscricao; onEnviado?: () => void }) {
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState("");
  const aoEscolher = async (f: File | undefined) => {
    setErro("");
    if (!f) return;
    if (!TIPOS_COMPROVANTE.split(",").includes(f.type)) return setErro("Envie PDF, JPEG, PNG ou WebP.");
    if (f.size > TAMANHO_MAX) return setErro("Arquivo acima de 5 MB.");
    setOcupado(true);
    try {
      await enviarComprovante(inscricao.id, f.name, await lerDataUrl(f));
      onEnviado?.();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao enviar o comprovante.");
    } finally {
      setOcupado(false);
    }
  };
  return (
    <div>
      <label className={`inline-flex cursor-pointer items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 ${ocupado ? "pointer-events-none opacity-50" : ""}`}>
        <Upload className="h-4 w-4" aria-hidden="true" />
        {ocupado ? "Enviando…" : inscricao.comprovante ? "Substituir comprovante" : "Enviar comprovante"}
        <input type="file" accept={TIPOS_COMPROVANTE} className="sr-only" disabled={ocupado}
          onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; void aoEscolher(f); }} />
      </label>
      <p className="mt-1 text-xs text-muted-foreground">PDF, JPEG, PNG ou WebP, até 5 MB. Só você e a organização do evento acessam o arquivo.</p>
      {erro && <p role="alert" className="mt-1 text-sm text-destructive">{erro}</p>}
    </div>
  );
}

/** Abre o comprovante em nova aba por link assinado de 60 s. */
export function VerComprovante({ inscricao, rotulo = "Ver comprovante" }: { inscricao: Inscricao; rotulo?: string }) {
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState("");
  if (!inscricao.comprovante) return null;
  const abrir = async () => {
    setErro("");
    // A aba é aberta já no clique (bloqueadores de pop-up), e recebe o link quando chegar.
    const aba = window.open("about:blank", "_blank");
    setOcupado(true);
    try {
      const url = await linkComprovante(inscricao.id);
      if (aba) { aba.opener = null; aba.location.href = url; } else window.location.assign(url);
    } catch (e) {
      aba?.close();
      setErro(e instanceof Error ? e.message : "Não foi possível abrir o comprovante.");
    } finally {
      setOcupado(false);
    }
  };
  return (
    <span className="inline-flex flex-col">
      <Botao variante="contorno" type="button" disabled={ocupado} onClick={abrir}><Eye className="h-4 w-4" aria-hidden="true" />{rotulo}</Botao>
      {erro && <span role="alert" className="mt-1 text-sm text-destructive">{erro}</span>}
    </span>
  );
}
