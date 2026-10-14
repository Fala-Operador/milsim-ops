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
const ESPERA_LEITURA_MS = 800;
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
  /** A última atualização automática falhou (sem conexão ou servidor indisponível). */
  semConexao: boolean;
}

const Ctx = createContext<ValorSuporte | null>(null);

export function SuporteProvider({ usuarioId, children }: { usuarioId: string | undefined; children: ReactNode }) {
  // Marcações otimistas: aparecem na hora e chegam ao servidor em seguida.
  const [otimistas, setOtimistas] = useState<Lidos>({});
  const canal = useRef<BroadcastChannel | null>(null);
  const [telas, setTelas] = useState(0);
  const [semConexao, setSemConexao] = useState(false);
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
  // Fora do suporte, intervalo maior só para manter o contador do menu correto.
  useEffect(() => {
    if (!usuarioId) return;
    const atualizar = () => {
      if (document.visibilityState !== "visible") return;
      recarregarVisao().then(() => setSemConexao(false), () => setSemConexao(true));
    };
    const id = setInterval(atualizar, telas > 0 ? 15000 : 45000);
    // Ao voltar para a aba, traz leituras e respostas feitas em outros aparelhos.
    document.addEventListener("visibilitychange", atualizar);
    return () => { clearInterval(id); document.removeEventListener("visibilitychange", atualizar); };
  }, [usuarioId, telas]);

  // Envio ao servidor: só quando a leitura avança, agrupado por chamado. Chamado a cada
  // evento de rolagem, isto não pode virar uma escrita por evento (esgota o banco).
  const enviados = useRef<Record<string, string>>({});
  const agendados = useRef<Record<string, { ate: string; timer: ReturnType<typeof setTimeout> }>>({});
  useEffect(() => () => { for (const a of Object.values(agendados.current)) clearTimeout(a.timer); }, []);
  useEffect(() => { enviados.current = {}; }, [usuarioId]);

  const marcarLido = useCallback((chamadoId: string, ate: string) => {
    if (!usuarioId) return;
    const servidor = carregarBase().usuarios.find((u) => u.id === usuarioId)?.silencioNotificacoes?.leiturasSuporte?.[chamadoId];
    const jaSabido = [servidor, enviados.current[chamadoId], agendados.current[chamadoId]?.ate].filter(Boolean).sort().at(-1);
    if (jaSabido && jaSabido >= ate) return; // nada novo: não grava de novo
    setOtimistas((atual) => (atual[chamadoId] && atual[chamadoId]! >= ate ? atual : { ...atual, [chamadoId]: ate }));
    clearTimeout(agendados.current[chamadoId]?.timer);
    agendados.current[chamadoId] = {
      ate,
      timer: setTimeout(() => {
        delete agendados.current[chamadoId];
        enviados.current[chamadoId] = ate;
        void marcarLidoServidor(chamadoId, ate).catch(() => {
          if (enviados.current[chamadoId] === ate) delete enviados.current[chamadoId]; // tenta de novo na próxima leitura
        });
      }, ESPERA_LEITURA_MS),
    };
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
    semConexao,
  }), [lidos, marcarLido, contagens, semConexao]);

  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>;
}

export function useSuporte(): ValorSuporte {
  const v = useContext(Ctx);
  if (!v) throw new Error("useSuporte fora do SuporteProvider");
  return v;
}
