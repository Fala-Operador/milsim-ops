// Preferências de modalidade: aparelho (visitante, localStorage) e conta (lida da visão;
// gravada pela API de conta).
import { storage } from "@/lib/storage";
import { carregarBase } from "@/services/db";
import { normalizarPreferencia, type PreferenciaModalidades } from "@/lib/modalidades";

const CHAVE_APARELHO = "preferencias-modalidade";
const CHAVE_CONVITE = "convite-modalidade-dispensado";

export function preferenciaDoAparelho(): PreferenciaModalidades {
  return normalizarPreferencia(storage.ler(CHAVE_APARELHO));
}
export function salvarNoAparelho(p: PreferenciaModalidades): void {
  storage.gravar(CHAVE_APARELHO, p);
}

export function preferenciaDaConta(usuarioId: string): PreferenciaModalidades {
  return normalizarPreferencia(carregarBase().usuarios.find((u) => u.id === usuarioId)?.preferenciasModalidade);
}

/** "Agora não": guarda só que o convite foi dispensado, sem criar preferência. */
export function conviteDispensado(): boolean {
  return storage.ler<boolean>(CHAVE_CONVITE) === true;
}
export function dispensarConvite(): void {
  storage.gravar(CHAVE_CONVITE, true);
}
