// Preferência de aparência por conta (persistência mockada na base local).
import { carregarBase, mutarBase } from "@/services/db";
import type { Tema } from "@/lib/localizacao";

export function temaDaConta(usuarioId: string): Tema | undefined {
  return carregarBase().usuarios.find((u) => u.id === usuarioId)?.tema;
}

export function definirTemaDaConta(usuarioId: string, tema: Tema): void {
  mutarBase((base) => {
    const u = base.usuarios.find((x) => x.id === usuarioId);
    if (u) u.tema = tema;
  });
}
