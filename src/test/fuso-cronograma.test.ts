// Cronograma no fuso do evento: o resultado não pode depender do fuso de quem valida
// (o servidor roda em UTC; o bug marcava 14:00 de Brasília como 11:00).
import { describe, expect, it } from "vitest";
import { eventoVazio } from "@/components/editorEvento/eventoVazio";
import { atividadeNoPeriodo, instanteNoFuso } from "@/lib/fusoHorario";
import { etapaDaMensagem, problemasDoServidor, validarEtapa } from "@/lib/eventoEditor";
import { validarParaPublicacao } from "@/services/organizador";
import type { AtividadeCronograma, Evento } from "@/lib/domain/types";

const at = (id: string, data: string, horario: string, titulo = id): AtividadeCronograma =>
  ({ id, data, horario, titulo, descricao: "", ordem: 0 });

/** Evento de 05/12/2026 14:00 a 06/12/2026 20:00 no horário de Brasília (UTC−3). */
function evento(cronograma: AtividadeCronograma[]): Evento {
  return {
    ...eventoVazio("org-x"),
    inicioEm: "2026-12-05T17:00:00.000Z",
    fimEm: "2026-12-06T23:00:00.000Z",
    fuso: "America/Sao_Paulo",
    cronograma,
  };
}

describe("instante no fuso do evento", () => {
  it("converte hora de parede em instante, sem depender do fuso do processo", () => {
    expect(instanteNoFuso("2026-12-05", "14:00", "America/Sao_Paulo").toISOString()).toBe("2026-12-05T17:00:00.000Z");
    expect(instanteNoFuso("2026-12-05", "14:00", "America/Manaus").toISOString()).toBe("2026-12-05T18:00:00.000Z");
    // Horário de verão europeu (UTC+1 em julho)
    expect(instanteNoFuso("2026-07-10", "09:30", "Europe/Lisbon").toISOString()).toBe("2026-07-10T08:30:00.000Z");
  });

  it("dados inválidos viram data inválida; fuso desconhecido usa o de Brasília", () => {
    expect(Number.isNaN(instanteNoFuso("", "10:00", "America/Sao_Paulo").getTime())).toBe(true);
    expect(instanteNoFuso("2026-12-05", "14:00", "Lua/Base").toISOString()).toBe("2026-12-05T17:00:00.000Z");
  });

  it("limites do período são inclusivos", () => {
    const ev = evento([]);
    expect(atividadeNoPeriodo(ev, at("a", "2026-12-05", "14:00"))).toBe(true);
    expect(atividadeNoPeriodo(ev, at("a", "2026-12-05", "13:59"))).toBe(false);
    expect(atividadeNoPeriodo(ev, at("a", "2026-12-06", "20:00"))).toBe(true);
    expect(atividadeNoPeriodo(ev, at("a", "2026-12-06", "20:01"))).toBe(false);
  });

  it("caso relatado: 14:00 e 14:30 do primeiro dia não são mais recusados", () => {
    const ev = evento([at("c", "2026-12-05", "14:00", "Credenciamento de equipe"), at("r", "2026-12-05", "14:30", "Inicio da rodada de grupos")]);
    expect(validarParaPublicacao(ev).filter((m) => m.includes("fora do período"))).toEqual([]);
    expect(validarEtapa(ev, 5).filter((p) => p.mensagem.includes("fora do período"))).toEqual([]);
  });
});

describe("erro do servidor por etapa", () => {
  it("associa cada mensagem à etapa certa", () => {
    expect(etapaDaMensagem('Atividade "X" fora do período do evento.')).toBe(5);
    expect(etapaDaMensagem("Cadastre ao menos um tipo de ingresso.")).toBe(4);
    expect(etapaDaMensagem("Cadastre ao menos um exército.")).toBe(3);
    expect(etapaDaMensagem("Adicione a imagem principal do evento.")).toBe(2);
    expect(etapaDaMensagem("Local obrigatório.")).toBe(1);
    expect(etapaDaMensagem("Nome obrigatório.")).toBe(0);
    expect(etapaDaMensagem("Falha de rede.")).toBe(6);
  });

  it("separa as linhas e aponta o campo da atividade citada", () => {
    const ev = evento([at("c1", "2026-12-04", "10:00", "Credenciamento")]);
    expect(problemasDoServidor('Nome obrigatório.\nAtividade "Credenciamento" fora do período do evento.', ev)).toEqual([
      { etapa: 0, campo: "", mensagem: "Nome obrigatório." },
      { etapa: 5, campo: "at-data-c1", mensagem: 'Atividade "Credenciamento" fora do período do evento.' },
    ]);
  });
});
