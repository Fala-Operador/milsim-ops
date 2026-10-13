// Catálogo, validação, preferências e ordenação por modalidade (regras puras).
import type { Evento } from "@/lib/domain/types";

export const MODALIDADES = [
  { id: "real_action", nome: "Real Action" },
  { id: "sar", nome: "SAR" },
  { id: "milsim", nome: "Milsim" },
  { id: "speedsoft", nome: "Speedsoft" },
  { id: "forfun", nome: "Forfun" },
] as const;

export type ModalidadeId = (typeof MODALIDADES)[number]["id"];
export const SEM_MODALIDADE = "Modalidade não informada";

export function ehModalidade(v: unknown): v is ModalidadeId {
  return typeof v === "string" && MODALIDADES.some((m) => m.id === v);
}

export function nomeModalidade(id: string | undefined | null): string {
  return MODALIDADES.find((m) => m.id === id)?.nome ?? SEM_MODALIDADE;
}

/** Preferência declarada: pendente (não respondeu), todas (explorar tudo) ou selecionadas. */
export type EstadoPreferencia = "pendente" | "todas" | "selecionadas";
export interface PreferenciaModalidades {
  estado: EstadoPreferencia;
  modalidades: ModalidadeId[];
  atualizadoEm?: string | undefined;
}
export const PREF_PENDENTE: PreferenciaModalidades = { estado: "pendente", modalidades: [] };

/** Normaliza qualquer valor lido do armazenamento numa preferência válida. */
export function normalizarPreferencia(v: unknown): PreferenciaModalidades {
  if (!v || typeof v !== "object") return PREF_PENDENTE;
  const o = v as Partial<PreferenciaModalidades>;
  const mods = Array.isArray(o.modalidades) ? Array.from(new Set(o.modalidades.filter(ehModalidade))) : [];
  if (o.estado === "todas") return { estado: "todas", modalidades: [], atualizadoEm: o.atualizadoEm };
  if (o.estado === "selecionadas" && mods.length) return { estado: "selecionadas", modalidades: mods, atualizadoEm: o.atualizadoEm };
  return PREF_PENDENTE;
}

/** Monta a preferência a partir da escolha: lista vazia equivale a "explorar todas". */
export function criarPreferencia(modalidades: ModalidadeId[], agora = new Date()): PreferenciaModalidades {
  const mods = Array.from(new Set(modalidades.filter(ehModalidade)));
  return mods.length
    ? { estado: "selecionadas", modalidades: mods, atualizadoEm: agora.toISOString() }
    : { estado: "todas", modalidades: [], atualizadoEm: agora.toISOString() };
}

/** Qual preferência vale após o login: a da conta sempre vence; sem resposta na conta, oferecer a do aparelho. */
export function resolverAoEntrar(conta: PreferenciaModalidades, aparelho: PreferenciaModalidades): { efetiva: PreferenciaModalidades; oferecerAparelho: boolean } {
  if (conta.estado !== "pendente") return { efetiva: conta, oferecerAparelho: false };
  return { efetiva: conta, oferecerAparelho: aparelho.estado !== "pendente" };
}

/** Exigência para publicar: modalidade válida. Rascunhos podem ficar sem. */
export function erroModalidadeParaPublicar(evento: Pick<Evento, "modalidade">): string | null {
  return ehModalidade(evento.modalidade) ? null : "Selecione a modalidade principal antes de publicar.";
}

/** Nenhuma seleção = todas; várias = qualquer uma delas. */
export function filtrarPorModalidades<T extends Pick<Evento, "modalidade">>(eventos: T[], selecionadas: ModalidadeId[]): T[] {
  if (!selecionadas.length) return eventos;
  return eventos.filter((e) => !!e.modalidade && selecionadas.includes(e.modalidade));
}

export type Ordenacao = "para_voce" | "data" | "recentes";
export const ROTULO_ORDENACAO: Record<Ordenacao, string> = {
  para_voce: "Para você",
  data: "Data mais próxima",
  recentes: "Publicados recentemente",
};

type Ordenavel = Pick<Evento, "modalidade" | "inicioEm" | "criadoEm">;
const porData = (a: Ordenavel, b: Ordenavel) => new Date(a.inicioEm).getTime() - new Date(b.inicioEm).getTime();

/** Separa favoritas e demais, cada grupo pela data mais próxima. Nunca remove eventos. */
export function separarPorPreferencia<T extends Ordenavel>(eventos: T[], pref: PreferenciaModalidades): { favoritas: T[]; outras: T[] } {
  const ordenados = [...eventos].sort(porData);
  if (pref.estado !== "selecionadas") return { favoritas: [], outras: ordenados };
  const fav = (e: T) => !!e.modalidade && pref.modalidades.includes(e.modalidade);
  return { favoritas: ordenados.filter(fav), outras: ordenados.filter((e) => !fav(e)) };
}

/** Ordenação explícita; preferências só influenciam "Para você". */
export function ordenarEventos<T extends Ordenavel>(eventos: T[], ordem: Ordenacao, pref: PreferenciaModalidades): T[] {
  if (ordem === "recentes") return [...eventos].sort((a, b) => new Date(b.criadoEm).getTime() - new Date(a.criadoEm).getTime());
  if (ordem === "data") return [...eventos].sort(porData);
  const { favoritas, outras } = separarPorPreferencia(eventos, pref);
  return [...favoritas, ...outras];
}
