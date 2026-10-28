// Preferências de modalidade compartilhadas entre página inicial, listagem e perfil.
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { criarPreferencia, PREF_PENDENTE, resolverAoEntrar, type ModalidadeId, type PreferenciaModalidades } from "@/lib/modalidades";
import {
  conviteDispensado, dispensarConvite, preferenciaDaConta, preferenciaDoAparelho, salvarNoAparelho,
} from "@/services/preferencias";
import { salvarPreferenciaConta } from "@/api/conta.functions";

interface Valor {
  montado: boolean;
  preferencia: PreferenciaModalidades;
  /** true = salva na conta; false = salva neste aparelho. */
  daConta: boolean;
  salvar: (modalidades: ModalidadeId[]) => void;
  explorarTodas: () => void;
  agoraNao: () => void;
  /** Convite de primeiro acesso ainda pode aparecer. */
  convitePendente: boolean;
  /** Conta sem escolha e aparelho com escolha: oferecer aproveitar. */
  ofertaAparelho: PreferenciaModalidades | null;
  aceitarAparelho: () => void;
  recusarAparelho: () => void;
  editorAberto: boolean;
  abrirEditor: () => void;
  fecharEditor: () => void;
}

const g = globalThis as unknown as { __prefCtx?: React.Context<Valor | null> };
const Ctx = (g.__prefCtx ??= createContext<Valor | null>(null));

const ROBOS = /bot|crawler|spider|google|lighthouse|headless|inspection/i;

function navegadorAutomatizado(): boolean {
  return typeof navigator !== "undefined" && (navigator.webdriver || ROBOS.test(navigator.userAgent));
}

export function PreferenciasProvider({ children }: { children: ReactNode }) {
  const { usuario } = useAuth();
  const usuarioId = usuario?.id;
  const [montado, setMontado] = useState(false);
  const [preferencia, setPreferencia] = useState<PreferenciaModalidades>(PREF_PENDENTE);
  const [dispensado, setDispensado] = useState(true);
  const [ofertaAparelho, setOferta] = useState<PreferenciaModalidades | null>(null);
  const [editorAberto, setEditor] = useState(false);

  // Recarrega a cada troca de conta: nunca herda preferências de outra conta.
  useEffect(() => {
    // Robôs (como a verificação do Google) não recebem o convite: o modal cobriria a página inicial.
    setDispensado(conviteDispensado() || navegadorAutomatizado());
    if (usuarioId) {
      const { efetiva, oferecerAparelho } = resolverAoEntrar(preferenciaDaConta(usuarioId), preferenciaDoAparelho());
      setPreferencia(efetiva);
      setOferta(oferecerAparelho ? preferenciaDoAparelho() : null);
    } else {
      setPreferencia(preferenciaDoAparelho());
      setOferta(null);
    }
    setMontado(true);
  }, [usuarioId]);

  const gravar = useCallback((p: PreferenciaModalidades) => {
    if (usuarioId) void salvarPreferenciaConta(p).catch(() => {}); else salvarNoAparelho(p);
    setPreferencia(p);
    setOferta(null);
    setEditor(false);
  }, [usuarioId]);

  const valor: Valor = {
    montado,
    preferencia,
    daConta: !!usuarioId,
    salvar: (m) => gravar(criarPreferencia(m)),
    explorarTodas: () => gravar(criarPreferencia([])),
    agoraNao: () => { dispensarConvite(); setDispensado(true); setEditor(false); },
    convitePendente: montado && !dispensado && preferencia.estado === "pendente" && !ofertaAparelho,
    ofertaAparelho,
    aceitarAparelho: () => { if (ofertaAparelho) gravar(ofertaAparelho); },
    recusarAparelho: () => setOferta(null),
    editorAberto,
    abrirEditor: () => setEditor(true),
    fecharEditor: () => setEditor(false),
  };
  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>;
}

export function usePreferencias(): Valor {
  const v = useContext(Ctx);
  if (!v) throw new Error("usePreferencias() deve ser usado dentro de <PreferenciasProvider>.");
  return v;
}
