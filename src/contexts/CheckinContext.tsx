// Estado compartilhado da portaria: conexão (real + simulada), base offline,
// registros e fila. As regras ficam nos serviços; aqui só orquestramos.
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useVersaoBase } from "@/hooks/useVersaoBase";
import {
  carregarFonte, confirmarEntrada, contarPendentes, prepararOffline, reverterEntrada, sincronizar, validarEntrada,
  type FonteDados,
} from "@/services/checkin";
import { guardarArquivosApp, registrarSW, type EstadoSW } from "@/lib/sw";
import { idbDisponivel } from "@/services/checkinStore";
import { enviarFilaCheckin } from "@/api/checkin.functions";
import type { OrigemEntrada, RegistroCheckin, ResultadoValidacao } from "@/lib/checkin";
import { tr } from "@/i18n/contexts/CheckinContext";

interface Valor {
  eventoId: string;
  online: boolean;
  redeReal: boolean;
  simularOffline: boolean;
  setSimularOffline: (v: boolean) => void;
  simularFalha: boolean;
  setSimularFalha: (v: boolean) => void;
  estadoSW: EstadoSW;
  idb: boolean;
  fonte: FonteDados | null;
  pendentes: number;
  ocupado: boolean;
  aviso: string;
  validar: (b: { token?: string; codigo?: string; inscricaoId?: string }) => ResultadoValidacao | null;
  confirmar: (inscricaoId: string, origem: OrigemEntrada, motivo?: string) => Promise<ResultadoValidacao>;
  desfazer: (r: RegistroCheckin, motivo: string) => Promise<void>;
  preparar: () => Promise<void>;
  sincronizarAgora: () => Promise<void>;
}

const Ctx = createContext<Valor | null>(null);

export function CheckinProvider({ eventoId, children }: { eventoId: string; children: ReactNode }) {
  const { usuario } = useAuth();
  const versao = useVersaoBase();
  const [redeReal, setRedeReal] = useState(true);
  const [simularOffline, setSimularOffline] = useState(false);
  const [simularFalha, setSimularFalha] = useState(false);
  const [estadoSW, setEstadoSW] = useState<EstadoSW>("registrando");
  const [fonte, setFonte] = useState<FonteDados | null>(null);
  const [pendentes, setPendentes] = useState(0);
  const [ocupado, setOcupado] = useState(false);
  const [aviso, setAviso] = useState("");
  const online = redeReal && !simularOffline;

  useEffect(() => {
    setRedeReal(navigator.onLine);
    const on = () => setRedeReal(true), off = () => setRedeReal(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    registrarSW().then(setEstadoSW);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, []);

  const recarregar = useCallback(async () => {
    if (!eventoId || !idbDisponivel()) return;
    const [f, p] = await Promise.all([carregarFonte(eventoId, online), contarPendentes()]);
    setFonte(f);
    setPendentes(p);
  }, [eventoId, online]);

  const sincronizarAgora = useCallback(async () => {
    if (!online) { setAviso(tr("sem_conexao_os_registros_continuam_guard")); return; }
    const r = await sincronizar(simularFalha, enviarFilaCheckin);
    setAviso(r.falhas ? tr("falha_simulada_falhas_registro_s_continu", { falhas: r.falhas })
      : r.conflitos ? tr("enviados_sincronizado_s_e_conflitos_conf", { enviados: r.enviados, conflitos: r.conflitos })
      : r.enviados ? tr("enviados_registro_s_sincronizado_s", { enviados: r.enviados }) : "");
    await recarregar();
  }, [online, simularFalha, recarregar]);

  // Troca de evento: limpa estado anterior. Retorno da conexão: sincroniza a fila.
  useEffect(() => { setFonte(null); setAviso(""); }, [eventoId]);
  useEffect(() => { recarregar(); }, [recarregar, versao]);
  useEffect(() => { if (online && !simularFalha) sincronizar(false, enviarFilaCheckin).then(recarregar); }, [online]); // eslint-disable-line react-hooks/exhaustive-deps

  const validar: Valor["validar"] = (b) => (fonte ? validarEntrada(fonte, eventoId, b) : null);

  const confirmar: Valor["confirmar"] = async (inscricaoId, origem, motivo) => {
    setOcupado(true);
    try {
      const { resultado, registro } = await confirmarEntrada({ usuario, eventoId, inscricaoId, origem, motivo, online });
      if (registro && online) await sincronizar(simularFalha, enviarFilaCheckin);
      await recarregar();
      return resultado;
    } finally { setOcupado(false); }
  };

  const desfazer: Valor["desfazer"] = async (r, motivo) => {
    await reverterEntrada({ usuario, registro: r, motivo });
    if (online) await sincronizar(simularFalha, enviarFilaCheckin);
    await recarregar();
  };

  const preparar = async () => {
    setOcupado(true);
    try {
      if (!online) throw new Error(tr("conecte_se_a_internet_para_preparar"));
      await prepararOffline(usuario, eventoId);
      const sw = await guardarArquivosApp(["/organizacao/checkin"]);
      setAviso(sw.ok ? tr("aparelho_preparado_ingressos_baixados_e", { arquivos: sw.arquivos })
        : tr("ingressos_baixados_mas_este_navegador_pr"));
      await recarregar();
    } catch (e) {
      setAviso(e instanceof Error ? e.message : tr("falha_ao_preparar"));
    } finally { setOcupado(false); }
  };

  return (
    <Ctx.Provider value={{
      eventoId, online, redeReal, simularOffline, setSimularOffline, simularFalha, setSimularFalha, estadoSW,
      idb: idbDisponivel(), fonte, pendentes, ocupado, aviso, validar, confirmar, desfazer, preparar, sincronizarAgora,
    }}>
      {children}
    </Ctx.Provider>
  );
}

export function useCheckin(): Valor {
  const v = useContext(Ctx);
  if (!v) throw new Error("useCheckin() deve ser usado dentro de <CheckinProvider>.");
  return v;
}
