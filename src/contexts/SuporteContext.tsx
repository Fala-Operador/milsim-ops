// Estado compartilhado do suporte: leitura por chamado (por pessoa, neste aparelho),
// contagem de pendências e sinais entre abas. As mensagens em si ficam na visão e
// em hooks por conversa — nunca num contexto global.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { carregarBase } from "@/services/db";
import { useVersaoBase } from "@/hooks/useVersaoBase";
import { recarregarVisao } from "@/api/sessao.functions";
import { naoLidas, pendenteDeResposta, podeAtender, responsavelId } from "@/lib/suporte";

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
const chave = (uid: string) => `suporte-lido:${uid}`;

export function SuporteProvider({ usuarioId, children }: { usuarioId: string | undefined; children: ReactNode }) {
  const [lidos, setLidos] = useState<Lidos>({});
  const canal = useRef<BroadcastChannel | null>(null);
  const [telas, setTelas] = useState(0);
  const versao = useVersaoBase();

  useEffect(() => {
    if (!usuarioId) { setLidos({}); return; }
    try { setLidos(JSON.parse(localStorage.getItem(chave(usuarioId)) ?? "{}")); } catch { setLidos({}); }
  }, [usuarioId]);

  // Sinal de outra aba: recarrega a visão autorizada pelo servidor.
  useEffect(() => {
    if (!usuarioId || typeof BroadcastChannel === "undefined") return;
    const bc = new BroadcastChannel(CANAL);
    canal.current = bc;
    let t: ReturnType<typeof setTimeout> | undefined;
    bc.onmessage = () => { clearTimeout(t); t = setTimeout(() => void recarregarVisao().catch(() => {}), 300); };
    const onStorage = (e: StorageEvent) => {
      if (e.key === chave(usuarioId) && e.newValue) try { setLidos(JSON.parse(e.newValue)); } catch { /* ignora */ }
    };
    window.addEventListener("storage", onStorage);
    return () => { bc.close(); canal.current = null; clearTimeout(t); window.removeEventListener("storage", onStorage); };
  }, [usuarioId]);

  // Atualização periódica enquanto uma tela de suporte está aberta e visível
  // (traz respostas feitas em outros aparelhos).
  useEffect(() => {
    if (!usuarioId || telas === 0) return;
    const id = setInterval(() => { if (document.visibilityState === "visible") void recarregarVisao().catch(() => {}); }, 15000);
    return () => clearInterval(id);
  }, [usuarioId, telas]);

  const marcarLido = useCallback((chamadoId: string, ate: string) => {
    if (!usuarioId) return;
    setLidos((atual) => {
      if (atual[chamadoId] && atual[chamadoId]! >= ate) return atual;
      const novo = { ...atual, [chamadoId]: ate };
      try { localStorage.setItem(chave(usuarioId), JSON.stringify(novo)); } catch { /* armazenamento cheio */ }
      return novo;
    });
  }, [usuarioId]);

  const contagens = useMemo(() => {
    void versao;
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
  }, [versao, usuarioId, lidos]);

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
