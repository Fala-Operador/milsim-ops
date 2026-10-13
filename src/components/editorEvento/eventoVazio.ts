import { gerarId } from "@/services/db";
import type { Evento } from "@/lib/domain/types";

/** Evento novo com valores sugeridos (sempre em rascunho). */
export function eventoVazio(organizacaoId: string): Evento {
  const inicio = new Date(Date.now() + 30 * 86400000);
  inicio.setHours(7, 0, 0, 0);
  const fim = new Date(inicio.getTime() + 11 * 3600000);
  return {
    id: gerarId("evt"),
    organizacaoId,
    nome: "",
    descricaoResumida: "",
    enredo: "",
    inicioEm: inicio.toISOString(),
    fimEm: fim.toISOString(),
    fuso: "America/Sao_Paulo",
    local: "",
    endereco: "",
    cidade: "",
    uf: "SP",
    capacidadeTotal: 50,
    exercitos: [
      { id: gerarId("ex"), nome: "Exército A", capacidade: 25 },
      { id: gerarId("ex"), nome: "Exército B", capacidade: 25 },
    ],
    tipos: [{ id: gerarId("tp"), nome: "Ingresso Padrão", precoBaseCentavos: 10000, quantidadeMaxima: 50 }],
    lotes: [],
    cronograma: [],
    status: "rascunho",
    criadoEm: new Date().toISOString(),
  };
}
