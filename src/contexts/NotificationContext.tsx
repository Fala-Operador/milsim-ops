import { createContext, useCallback, useContext, type Context, type ReactNode } from "react";
import { carregarBase } from "@/services/db";
import { useVersaoBase } from "@/hooks/useVersaoBase";
import { recarregarVisao } from "@/api/sessao.functions";
import { marcarNotificacaoLida, marcarNotificacoesLidas } from "@/api/conta.functions";
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
  // As notificações chegam na visão de cada resposta da API.
  useVersaoBase();
  const notificacoes = usuarioId
    ? carregarBase()
        .notificacoes.filter((n) => n.usuarioId === usuarioId)
        .sort((a, b) => b.criadoEm.localeCompare(a.criadoEm))
    : [];

  const recarregar = useCallback(() => void recarregarVisao().catch(() => {}), []);
  const marcarLida = useCallback((id: string) => void marcarNotificacaoLida(id).catch(() => {}), []);
  const marcarTodasLidas = useCallback(() => void marcarNotificacoesLidas().catch(() => {}), []);

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
