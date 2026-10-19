// Regras puras da página de inscritos: indicadores, filtros e ordenação de eventos.
import type { Evento, Inscricao } from "@/lib/domain/types";
import { ocupaVaga } from "@/lib/reservas";

export const ROTULO_ORIGEM: Record<Inscricao["origem"], string> = {
  plataforma: "Plataforma",
  cortesia: "Cortesia",
  organizador: "Inclusão manual",
  admin: "Inclusão pela administração",
};

export const ROTULO_STATUS_INSCRICAO: Record<Inscricao["status"], string> = {
  pendente: "Aguardando pagamento",
  confirmada: "Confirmada",
  cancelada: "Cancelada",
  estornada: "Estornada",
};

export function indicadoresInscritos(evento: Evento, inscricoes: Inscricao[]) {
  const ativas = inscricoes.filter((i) => i.eventoId === evento.id && ocupaVaga(i)).length;
  const capacidade = evento.capacidadeTotal;
  return {
    ativas,
    capacidade,
    disponiveis: Math.max(0, capacidade - ativas),
    ocupacao: capacidade > 0 ? Math.min(100, Math.round((ativas / capacidade) * 100)) : 0,
  };
}

export interface FiltrosInscritos {
  busca: string;
  status: string;
  exercito: string;
  tipo: string;
}

export const FILTROS_VAZIOS: FiltrosInscritos = { busca: "", status: "", exercito: "", tipo: "" };

export function filtrarInscritos(
  inscricoes: Inscricao[],
  filtros: FiltrosInscritos,
  nomeDe: (i: Inscricao) => string,
) {
  const termo = filtros.busca.trim().toLowerCase();
  return inscricoes.filter(
    (i) =>
      (!filtros.status || i.status === filtros.status) &&
      (!filtros.exercito || i.exercitoId === filtros.exercito) &&
      (!filtros.tipo || i.tipoId === filtros.tipo) &&
      (!termo || nomeDe(i).toLowerCase().includes(termo) || i.codigo.toLowerCase().includes(termo)),
  );
}

export function contarFiltrosAtivos(f: FiltrosInscritos) {
  return [f.status, f.exercito, f.tipo].filter(Boolean).length + (f.busca.trim() ? 1 : 0);
}

/** Próximos eventos primeiro (mais perto antes), depois os encerrados (mais recente antes). */
export function ordenarEventos(eventos: Evento[], agora = Date.now()) {
  const futuros = eventos.filter((e) => new Date(e.fimEm).getTime() >= agora);
  const passados = eventos.filter((e) => new Date(e.fimEm).getTime() < agora);
  futuros.sort((a, b) => a.inicioEm.localeCompare(b.inicioEm));
  passados.sort((a, b) => b.inicioEm.localeCompare(a.inicioEm));
  return [...futuros, ...passados];
}
