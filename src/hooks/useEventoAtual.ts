import { useEffect, useState } from "react";
import { carregarBase } from "@/services/db";
import type { Evento } from "@/lib/domain/types";

/**
 * Devolve o evento mais recente guardado no dispositivo.
 * O carregador da rota roda no servidor, onde não existe o armazenamento local,
 * então só depois de montado passamos a ler a base do navegador — assim a página
 * pública mostra a última edição feita pela organização sem quebrar a hidratação.
 */
export function useEventoAtual(eventoDoCarregador: Evento): Evento {
  const [montado, setMontado] = useState(false);
  useEffect(() => setMontado(true), []);
  if (!montado) return eventoDoCarregador;
  return carregarBase().eventos.find((e) => e.id === eventoDoCarregador.id) ?? eventoDoCarregador;
}
