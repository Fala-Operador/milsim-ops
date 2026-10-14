// Estado compartilhado do suporte: leitura por chamado (gravada no servidor, valendo
// em todos os aparelhos), contagem de pendências e sinais entre abas. As mensagens em
// si ficam na visão e em hooks por conversa — nunca num contexto global.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { carregarBase } from "@/services/db";
import { useVersaoBase } from "@/hooks/useVersaoBase";
import { recarregarVisao } from "@/api/sessao.functions";
import { marcarLidoServidor } from "@/api/suporte.functions";
import { lidoAteSuporte, naoLidas, pendenteDeResposta, podeAtender, responsavelId } from "@/lib/suporte";

const CANAL = "milsim-suporte";
type Lidos = Record<string, string>;

interface ValorSuporte {
  lidoAte: (chamadoId: string) => string | undefined;
  marcarLido: (chamadoId: string, ate: string) => void;
  /** Chamados do participante com resposta não lida. */
  naoLidasParticipante: number;
  /** Chamados que a pessoa atende e exigem atenção (novos, pendentes ou não lidos). */
  atencaoEquipe: number;
  /** Avisa outras abas que um chamado mudou (só o id, nunca conteúdo). */
  sinalizar: (chamadoId: string) => void;
  /** Registra uma tela de suporte aberta: ativa atualização periódica. */
  acompanhar: () => () => void;
}

const Ctx = createContext<ValorSuporte | null>(null);

export function SuporteProvider({ usuarioId, children }: { usuarioId: string | undefined; children: ReactNode }) {
  // Marcações otimistas: aparecem na hora e chegam ao servidor em seguida.
  const [otimistas, setOtimistas] = useState<Lidos>({});
  const canal = useRef<BroadcastChannel | null>(null);
  const [telas, setTelas] = useState(0);
  const versao = useVersaoBase();

  useEffect(() => { if (!usuarioId) setOtimistas({}); }, [usuarioId]);

  // Sinal de outra aba: recarrega a visão autorizada pelo servidor.
  useEffect(() => {
    if (!usuarioId || typeof BroadcastChannel === "undefined") return;
    const bc = new BroadcastChannel(CANAL);
    canal.current = bc;
    let t: ReturnType<typeof setTimeout> | undefined;
    bc.onmessage = () => { clearTimeout(t); t = setTimeout(() => void recarregarVisao().catch(() => {}), 300); };
    return () => { bc.close(); canal.current = null; clearTimeout(t); };
  }, [usuarioId]);

  // Atualização periódica enquanto uma tela de suporte está aberta e visível
  // (traz respostas e marcas de leitura feitas em outros aparelhos).
  useEffect(() => {
    if (!usuarioId || telas === 0) return;
    const id = setInterval(() => { if (document.visibilityState === "visible") void recarregarVisao().catch(() => {}); }, 15000);
    return () => clearInterval(id);
  }, [usuarioId, telas]);

  const marcarLido = useCallback((chamadoId: string, ate: string) => {
    if (!usuarioId) return;
    setOtimistas((atual) => (atual[chamadoId] && atual[chamadoId]! >= ate ? atual : { ...atual, [chamadoId]: ate }));
    void marcarLidoServidor(chamadoId, ate).catch(() => {});
  }, [usuarioId]);

  const lidos = useMemo<Lidos>(() => {
    void versao;
    const base = carregarBase();
    const eu = usuarioId ? base.usuarios.find((u) => u.id === usuarioId) : undefined;
    const servidor = eu?.silencioNotificacoes?.leiturasSuporte ?? {};
    const mesclado: Lidos = { ...servidor };
    for (const [k, v] of Object.entries(otimistas)) if (!mesclado[k] || mesclado[k]! < v) mesclado[k] = v;
    return mesclado;
  }, [versao, usuarioId, otimistas]);

  const contagens = useMemo(() => {
    if (!usuarioId) return { p: 0, e: 0 };
    const base = carregarBase();
    const eu = base.usuarios.find((u) => u.id === usuarioId) ?? null;
    let p = 0, e = 0;
    for (const c of base.chamados) {
      const n = naoLidas(c, usuarioId, lidos[c.id]);
      if (c.solicitanteId === usuarioId) { if (n > 0) p++; continue; }
      if (!podeAtender(base, eu, c)) continue;
      const semDono = c.status === "aberto" && !responsavelId(c);
      if (n > 0 || semDono || (pendenteDeResposta(c) && (!responsavelId(c) || responsavelId(c) === usuarioId))) e++;
    }
    return { p, e };
  }, [usuarioId, lidos]);

  const valor = useMemo<ValorSuporte>(() => ({
    lidoAte: (id) => lidos[id],
    marcarLido,
    naoLidasParticipante: contagens.p,
    atencaoEquipe: contagens.e,
    sinalizar: (id) => canal.current?.postMessage({ chamadoId: id }),
    acompanhar: () => { setTelas((n) => n + 1); return () => setTelas((n) => n - 1); },
  }), [lidos, marcarLido, contagens]);

  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>;
}

export function useSuporte(): ValorSuporte {
  const v = useContext(Ctx);
  if (!v) throw new Error("useSuporte fora do SuporteProvider");
  return v;
}
