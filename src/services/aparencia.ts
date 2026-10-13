// Preferência de aparência por conta (lida da visão; gravada pela API de conta).
import { carregarBase } from "@/services/db";
import type { Tema } from "@/lib/localizacao";

export function temaDaConta(usuarioId: string): Tema | undefined {
  return carregarBase().usuarios.find((u) => u.id === usuarioId)?.tema;
}
