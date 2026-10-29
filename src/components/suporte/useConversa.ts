// Estado de UMA conversa: rascunho (por pessoa e chamado), envios pendentes/falhos e
// paginação. Fica fora de contextos globais.
import { useCallback, useEffect, useRef, useState } from "react";
import { enviarMensagemSuporte, type AnexoEnvio } from "@/api/suporte.functions";
import { useSuporte } from "@/contexts/SuporteContext";
import { tr } from "@/i18n/components/suporte/useConversa";

export interface Pendente {
  clienteId: string;
  chamadoId: string;
  encaminhamentoId?: string | undefined;
  corpo: string;
  anexo?: AnexoEnvio | undefined;
  estado: "enviando" | "falha";
  erro?: string | undefined;
  criadoEm: string;
}

const novoId = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`);
const chaveRascunho = (uid: string, cid: string) => `suporte-rascunho:${uid}:${cid}`;

// Pendentes sobrevivem à troca de chamado (cada um sabe a qual conversa pertence).
let pendentesGlobais: Pendente[] = [];
const ouvintes = new Set<() => void>();
const avisar = () => ouvintes.forEach((f) => f());
function atualizarPendentes(fn: (l: Pendente[]) => Pendente[]) { pendentesGlobais = fn(pendentesGlobais); avisar(); }

export function useConversa(chamadoId: string, usuarioId: string, encaminhamentoId?: string) {
  // Rascunhos e pendências separados por destino (participante ou encaminhamento).
  const chave = encaminhamentoId ? `${chamadoId}#${encaminhamentoId}` : chamadoId;
  const { sinalizar } = useSuporte();
  const [rascunho, setRascunhoEstado] = useState("");
  const [anexo, setAnexo] = useState<AnexoEnvio | null>(null);
  const [, forcar] = useState(0);
  const atual = useRef(chamadoId);
  atual.current = chamadoId;

  useEffect(() => {
    const f = () => forcar((n) => n + 1);
    ouvintes.add(f);
    return () => { ouvintes.delete(f); };
  }, []);

  // Rascunho separado por pessoa e chamado.
  useEffect(() => {
    try { setRascunhoEstado(localStorage.getItem(chaveRascunho(usuarioId, chave)) ?? ""); } catch { setRascunhoEstado(""); }
    setAnexo(null);
  }, [usuarioId, chave]);

  const setRascunho = useCallback((v: string) => {
    setRascunhoEstado(v);
    try {
      if (v) localStorage.setItem(chaveRascunho(usuarioId, chave), v);
      else localStorage.removeItem(chaveRascunho(usuarioId, chave));
    } catch { /* ignora */ }
  }, [usuarioId, chave]);

  const despachar = useCallback(async (p: Pendente) => {
    atualizarPendentes((l) => l.map((x) => (x.clienteId === p.clienteId ? { ...x, estado: "enviando", erro: undefined }  : x)));
    try {
      await enviarMensagemSuporte(p.chamadoId, p.clienteId, p.corpo, p.anexo, p.encaminhamentoId);
      atualizarPendentes((l) => l.filter((x) => x.clienteId !== p.clienteId));
      sinalizar(p.chamadoId);
    } catch (e) {
      atualizarPendentes((l) => l.map((x) => (x.clienteId === p.clienteId ? { ...x, estado: "falha", erro: e instanceof Error ? e.message : tr("falha_no_envio") } : x)));
    }
  }, [sinalizar]);

  const enviar = useCallback(() => {
    const corpo = rascunho.trim();
    if (!corpo && !anexo) return false;
    const p: Pendente = { clienteId: novoId(), chamadoId, encaminhamentoId, corpo, anexo: anexo ?? undefined, estado: "enviando", criadoEm: new Date().toISOString() };
    atualizarPendentes((l) => [...l, p]);
    setRascunho("");
    setAnexo(null);
    void despachar(p);
    return true;
  }, [rascunho, anexo, chamadoId, encaminhamentoId, despachar, setRascunho]);

  /** Mesmo clienteId: o servidor não duplica se a primeira tentativa tiver chegado. */
  const tentarNovamente = useCallback((clienteId: string) => {
    const p = pendentesGlobais.find((x) => x.clienteId === clienteId);
    if (p) void despachar(p);
  }, [despachar]);

  const descartar = useCallback((clienteId: string) => {
    const p = pendentesGlobais.find((x) => x.clienteId === clienteId);
    atualizarPendentes((l) => l.filter((x) => x.clienteId !== clienteId));
    if (p && p.chamadoId === atual.current && p.encaminhamentoId === encaminhamentoId && !rascunho) setRascunho(p.corpo); // devolve o texto ao campo
  }, [rascunho, setRascunho, encaminhamentoId]);

  const pendentes = pendentesGlobais.filter((p) => p.chamadoId === chamadoId && p.encaminhamentoId === encaminhamentoId);
  return { rascunho, setRascunho, anexo, setAnexo, enviar, pendentes, tentarNovamente, descartar };
}
