// Confirmações e avisos do app (no lugar de `window.confirm`/`alert`): um único diálogo
// montado na raiz, aberto por promessa para a tela continuar o fluxo como antes.
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { DialogoConfirmacao } from "@/components/ui";

export interface OpcoesConfirmacao {
  titulo: string;
  descricao?: ReactNode;
  /** Rótulo do botão principal (padrão "Confirmar"). */
  confirmar?: string;
  /** Rótulo do botão de desistir (padrão "Cancelar"). */
  cancelar?: string;
  destrutivo?: boolean;
}

export interface OpcoesAviso {
  titulo: string;
  descricao?: ReactNode;
  /** Rótulo do botão (padrão "Entendi"). */
  ok?: string;
}

interface Confirmacao {
  /** Resolve `true` só quando a pessoa confirma (fechar ou cancelar = `false`). */
  confirmar: (o: OpcoesConfirmacao) => Promise<boolean>;
  /** Aviso com um único botão; resolve quando é fechado. */
  avisar: (o: OpcoesAviso) => Promise<void>;
}

interface Aberto {
  titulo: string;
  descricao?: ReactNode;
  confirmar: string;
  cancelar?: string | undefined;
  destrutivo: boolean;
}

const Contexto = createContext<Confirmacao | null>(null);

export function ConfirmacaoProvider({ children }: { children: ReactNode }) {
  // O conteúdo fica montado ao fechar, para a animação de saída não piscar vazia.
  const [aberto, setAberto] = useState<Aberto | null>(null);
  const [visivel, setVisivel] = useState(false);
  const resolver = useRef<((sim: boolean) => void) | null>(null);

  const abrir = useCallback((a: Aberto) => {
    resolver.current?.(false); // um novo pedido encerra o anterior como "não"
    setAberto(a);
    setVisivel(true);
    return new Promise<boolean>((r) => { resolver.current = r; });
  }, []);

  const valor = useMemo<Confirmacao>(() => ({
    confirmar: (o) => abrir({ titulo: o.titulo, descricao: o.descricao, confirmar: o.confirmar ?? "Confirmar", cancelar: o.cancelar ?? "Cancelar", destrutivo: !!o.destrutivo }),
    avisar: async (o) => { await abrir({ titulo: o.titulo, descricao: o.descricao, confirmar: o.ok ?? "Entendi", destrutivo: false }); },
  }), [abrir]);

  const responder = (sim: boolean) => {
    resolver.current?.(sim);
    resolver.current = null;
    setVisivel(false);
  };

  return (
    <Contexto.Provider value={valor}>
      {children}
      <DialogoConfirmacao
        aberto={visivel}
        titulo={aberto?.titulo ?? ""}
        descricao={aberto?.descricao}
        confirmar={aberto?.confirmar ?? ""}
        cancelar={aberto?.cancelar}
        destrutivo={!!aberto?.destrutivo}
        onResponder={responder}
      />
    </Contexto.Provider>
  );
}

export function useConfirmacao(): Confirmacao {
  const c = useContext(Contexto);
  if (!c) throw new Error("useConfirmacao fora do ConfirmacaoProvider");
  return c;
}
