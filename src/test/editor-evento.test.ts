import { describe, expect, it } from "vitest";
import { eventoVazio } from "@/components/editorEvento/eventoVazio";
import { revisarEvento, situacaoIngresso, validarEtapa } from "@/lib/eventoEditor";
import { geometria } from "@/lib/recorteBanner";
import { validarParaPublicacao } from "@/services/organizador";

const base = () => eventoVazio("org-x");

describe("editor de eventos em etapas", () => {
  it("Continuar valida só a etapa atual", () => {
    const ev = base();
    expect(validarEtapa(ev, 0).map((p) => p.campo)).toContain("ev-nome");
    expect(validarEtapa(ev, 3)).toEqual([]); // exércitos padrão válidos
  });

  it("término antes do início bloqueia a etapa de data", () => {
    const ev = { ...base(), local: "Campo", cidade: "Itu" };
    ev.fimEm = new Date(new Date(ev.inicioEm).getTime() - 3600000).toISOString();
    expect(validarEtapa(ev, 1).map((p) => p.campo)).toEqual(["ev-fim"]);
  });

  it("não permite capacidade abaixo da ocupação nem exércitos duplicados", () => {
    const ev = base();
    ev.capacidadeTotal = 3;
    ev.exercitos = [{ id: "a", nome: "Alfa", capacidade: 2 }, { id: "b", nome: "alfa ", capacidade: 2 }];
    const campos = validarEtapa(ev, 3, { total: 5, porExercito: { a: 3 } }).map((p) => p.campo);
    expect(campos).toEqual(expect.arrayContaining(["ev-cap", "ex-nome-b", "ex-cap-a"]));
  });

  it("publicar exige imagem principal", () => {
    expect(validarParaPublicacao(base())).toContain("Adicione a imagem principal do evento.");
    expect(revisarEvento(base()).erros.some((e) => e.campo === "ev-img-arquivo")).toBe(true);
  });

  it("vendas futuras são aviso, não erro; sem lote é erro", () => {
    const ev = base();
    expect(revisarEvento(ev).erros.some((e) => e.campo === "ev-lt-add")).toBe(true);
    const inicio = new Date(Date.now() + 86400000).toISOString();
    ev.lotes = [{ id: "l1", nome: "1º", inicioVendas: inicio, fimVendas: ev.inicioEm, status: "ativo", itens: [{ tipoId: ev.tipos[0]!.id, precoCentavos: 100, quantidade: 5 }] }];
    expect(situacaoIngresso(ev, ev.tipos[0]!.id)).toBe("agendado");
    const r = revisarEvento(ev);
    expect(r.erros.some((e) => e.campo === "ev-lt-add")).toBe(false);
    expect(r.avisos.some((a) => /vendas começam/.test(a.mensagem))).toBe(true);
  });

  it("recorte cobre o quadro sem distorcer", () => {
    const g = geometria(1000, 1000, 1680, 720, { zoom: 1, x: 0, y: 0 });
    expect(g.dw).toBe(g.dh); // proporção preservada
    expect(g.dw).toBeGreaterThanOrEqual(1680);
    expect(g.dx).toBe(0);
  });
});
