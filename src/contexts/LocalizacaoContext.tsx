// Localização da descoberta regional, compartilhada por cabeçalho, busca e seções.
// Filtra por estado (UF). Salva apenas a UF e o modo (atual/manual/nacional) — nunca coordenadas.
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { storage } from "@/lib/storage";
import type { Abrangencia } from "@/lib/domain/types";
import { LOCAL_PADRAO, aplicarLeituraDoAparelho, paraEstado, type LocalSalvo, type ModoLocal } from "@/lib/localizacao";
import { consultarPermissao, detectarCidade, ErroLocalizacao, type FalhaLocal } from "@/services/geolocalizacao";
import { tr } from "@/i18n/contexts/LocalizacaoContext";

export type StatusLocal = "ocioso" | "obtendo" | "detectado" | FalhaLocal;

interface Valor {
  local: Abrangencia;
  modo: ModoLocal;
  status: StatusLocal;
  /** Mostrar a chamada "Usar minha localização" (permissão ainda não decidida). */
  pedirPermissao: boolean;
  definirLocal: (a: Abrangencia) => void;
  usarLocalizacaoAtual: () => Promise<void>;
}

const CHAVE = "localizacao-v2";
const CHAVE_NEGADA = "localizacao-negada";
const g = globalThis as unknown as { __locCtx2?: React.Context<Valor | null> };
const Ctx = (g.__locCtx2 ??= createContext<Valor | null>(null));

export function LocalizacaoProvider({ children }: { children: ReactNode }) {
  const [salvo, setSalvo] = useState<LocalSalvo>(LOCAL_PADRAO);
  const [status, setStatus] = useState<StatusLocal>("ocioso");
  const [pedirPermissao, setPedirPermissao] = useState(false);
  const salvoRef = useRef(salvo);
  salvoRef.current = salvo;

  const gravar = (s: LocalSalvo) => {
    setSalvo(s);
    storage.gravar(CHAVE, s);
  };

  const detectar = useCallback(async (explicito: boolean) => {
    setStatus("obtendo");
    try {
      const c = await detectarCidade();
      gravar(aplicarLeituraDoAparelho(salvoRef.current, { escopo: "estado", uf: c.uf }, explicito));
      storage.gravar(CHAVE_NEGADA, false);
      setPedirPermissao(false);
      setStatus("detectado");
    } catch (e) {
      const motivo = e instanceof ErroLocalizacao ? e.motivo : "indisponivel";
      if (motivo === "negada") { storage.gravar(CHAVE_NEGADA, true); setPedirPermissao(false); }
      setStatus(motivo);
    }
  }, []);

  useEffect(() => {
    const s = storage.ler<LocalSalvo>(CHAVE);
    if (s?.modo && s.local?.escopo) {
      const atual = { ...s, local: paraEstado(s.local) };
      setSalvo(atual); salvoRef.current = atual;
    }
    let vivo = true;
    void consultarPermissao().then((p) => {
      if (!vivo) return;
      if (p === "concedida") {
        // Atualiza o estado só fora do modo manual (escolha manual não é sobrescrita).
        if (salvoRef.current.modo !== "manual") void detectar(false);
      } else if (p === "negada") {
        setStatus("negada");
      } else if (!storage.ler<boolean>(CHAVE_NEGADA) && salvoRef.current.modo !== "manual") {
        setPedirPermissao(true);
      }
    });
    return () => { vivo = false; };
  }, [detectar]);

  const definirLocal = (a: Abrangencia) => {
    gravar({ modo: a.escopo === "nacional" ? "nacional" : "manual", local: paraEstado(a) });
    setPedirPermissao(false);
  };

  return (
    <Ctx.Provider value={{ local: salvo.local, modo: salvo.modo, status, pedirPermissao, definirLocal, usarLocalizacaoAtual: () => detectar(true) }}>
      {children}
    </Ctx.Provider>
  );
}

export function useLocalizacao(): Valor {
  return useContext(Ctx) ?? {
    local: LOCAL_PADRAO.local, modo: "nacional", status: "ocioso", pedirPermissao: false,
    definirLocal: () => {}, usarLocalizacaoAtual: async () => {},
  };
}

export function mensagemStatus(s: StatusLocal): string | null {
  switch (s) {
    case "obtendo": return tr("obtendo_sua_localizacao");
    case "negada": return tr("permissao_de_localizacao_negada_escolha");
    case "indisponivel": return tr("localizacao_indisponivel_neste_aparelho");
    case "tempo": return tr("a_localizacao_demorou_demais_tente_de");
    case "sem_suporte": return tr("este_navegador_nao_informa_a_localizacao");
    case "cidade_nao_resolvida": return tr("nao_conseguimos_identificar_seu_estado_e");
    default: return null;
  }
}
