import { mutarBase } from "@/services/db";
import type { BaseDados } from "@/lib/domain/types";

export type CategoriaNotificacao = "comunidade" | "geral";

/** Verifica se o usuário silenciou a categoria (ou todas as notificações). */
export function silenciado(base: BaseDados, usuarioId: string, categoria: CategoriaNotificacao): boolean {
  const s = base.usuarios.find((u) => u.id === usuarioId)?.silencioNotificacoes;
  if (!s) return false;
  if (s.todas) return true;
  return categoria === "comunidade" && !!s.comunidade;
}

/** Atualiza as preferências de silêncio do usuário. */
export function definirSilencio(usuarioId: string, parcial: { todas?: boolean; comunidade?: boolean }): void {
  mutarBase((base) => {
    const u = base.usuarios.find((x) => x.id === usuarioId);
    if (!u) return;
    u.silencioNotificacoes = { ...u.silencioNotificacoes, ...parcial };
  });
}
