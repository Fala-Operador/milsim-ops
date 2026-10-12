import { createContext, useCallback, useContext, useState, type Context, type ReactNode } from "react";
import { carregarBase, mutarBase } from "@/services/db";
import type { Notificacao } from "@/lib/domain/types";

interface NotificationContextValue {
  notificacoes: Notificacao[];
  naoLidas: number;
  marcarLida: (id: string) => void;
  marcarTodasLidas: () => void;
  recarregar: () => void;
}

// Mantém a mesma instância do contexto entre recarregamentos rápidos do editor.
const g = globalThis as unknown as { __notifCtx?: Context<NotificationContextValue | null> };
const NotificationContext = (g.__notifCtx ??= createContext<NotificationContextValue | null>(null));

export function NotificationProvider({ usuarioId, children }: { usuarioId?: string | undefined; children: ReactNode }) {
  const [notificacoes, setNotificacoes] = useState<Notificacao[]>(() => lerDoUsuario(usuarioId));

  function lerDoUsuario(uid?: string) {
    if (!uid) return [];
    return carregarBase()
      .notificacoes.filter((n) => n.usuarioId === uid)
      .sort((a, b) => b.criadoEm.localeCompare(a.criadoEm));
  }

  const recarregar = useCallback(() => setNotificacoes(lerDoUsuario(usuarioId)), [usuarioId]);

  const marcarLida = useCallback((id: string) => {
    mutarBase((base) => {
      const n = base.notificacoes.find((x) => x.id === id);
      if (n) n.lida = true;
    });
    setNotificacoes((prev) => prev.map((n) => (n.id === id ? { ...n, lida: true } : n)));
  }, []);

  const marcarTodasLidas = useCallback(() => {
    mutarBase((base) => {
      base.notificacoes.forEach((n) => {
        if (n.usuarioId === usuarioId) n.lida = true;
      });
    });
    setNotificacoes((prev) => prev.map((n) => ({ ...n, lida: true })));
  }, [usuarioId]);

  return (
    <NotificationContext.Provider
      value={{ notificacoes, naoLidas: notificacoes.filter((n) => !n.lida).length, marcarLida, marcarTodasLidas, recarregar }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

// Sem provedor (ou durante troca rápida de módulo no editor), devolve um estado vazio
// em vez de lançar: o cabeçalho aparece em todas as telas e não pode ficar em branco.
const VAZIO: NotificationContextValue = {
  notificacoes: [],
  naoLidas: 0,
  marcarLida: () => {},
  marcarTodasLidas: () => {},
  recarregar: () => {},
};

export function useNotifications(): NotificationContextValue {
  return useContext(NotificationContext) ?? VAZIO;
}
