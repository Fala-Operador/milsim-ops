import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { carregarBase, mutarBase } from "@/services/db";
import type { Notificacao } from "@/lib/domain/types";

interface NotificationContextValue {
  notificacoes: Notificacao[];
  naoLidas: number;
  marcarLida: (id: string) => void;
  marcarTodasLidas: () => void;
  recarregar: () => void;
}

const NotificationContext = createContext<NotificationContextValue | null>(null);

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

export function useNotifications(): NotificationContextValue {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error("useNotifications() deve ser usado dentro de <NotificationProvider>.");
  return ctx;
}
