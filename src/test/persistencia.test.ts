// Conversão BaseDados ↔ tabelas do Supabase e cálculo do lote de mudanças.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect, vi } from "vitest";
import { criarBaseInicial } from "@/data/seed";
import { CAMPANHAS_METRICAS } from "@/lib/esquemaBanco";
import {
  baseDasTabelas, calcularMudancas, daLinha, linhasDaBase, mudancasDeInsercao, paraLinha, TABELAS, TABELAS_BANCO,
  type TabelasExportadas,
} from "@/lib/persistencia";

/** Simula o banco: aplica o lote de inserção e devolve o que export_base devolveria. */
function exportar(lote: ReturnType<typeof mudancasDeInsercao>): TabelasExportadas {
  return Object.fromEntries(Object.entries(lote).map(([t, m]) => [t, JSON.parse(JSON.stringify(m.gravar))]));
}

describe("linhas", () => {
  it("campos ausentes não viram colunas e null volta como ausente", () => {
    const linha = paraLinha(CAMPANHAS_METRICAS, { id: "x", eventoId: "e", nome: undefined, criadoEm: "2026-01-01T00:00:00.000Z" });
    expect(linha).toEqual({ id: "x", event_id: "e", created_at: "2026-01-01T00:00:00.000Z" });
    expect(daLinha(CAMPANHAS_METRICAS, { id: "x", name: null })).toEqual({ id: "x" });
  });

  it("timestamptz do Postgres volta no formato de toISOString", () => {
    const obj = daLinha<{ criadoEm: string }>(CAMPANHAS_METRICAS, { created_at: "2026-10-13T14:50:18.889+00:00" });
    expect(obj.criadoEm).toBe("2026-10-13T14:50:18.889Z");
  });

  it("listas e objetos aninhados viram tabelas filhas ligadas ao pai", () => {
    const base = criarBaseInicial();
    const evento = base.eventos.find((e) => e.lotes.some((l) => l.itens.length))!;
    const linhas = linhasDaBase(base);
    const lote = evento.lotes.findIndex((l) => l.itens.length);
    expect(linhas["events"]!.find((l) => l["id"] === evento.id)).not.toHaveProperty("tipos");
    expect(linhas["event_ticket_types"]!.filter((l) => l["event_id"] === evento.id)).toHaveLength(evento.tipos.length);
    expect(linhas["event_ticket_batch_items"]!.filter((l) => l["event_id"] === evento.id && l["batch_position"] === lote))
      .toHaveLength(evento.lotes[lote]!.itens.length);
    const u = base.usuarios[0]!;
    expect(linhas["user_addresses"]!.find((l) => l["user_id"] === u.id)).toMatchObject({ city: u.endereco.cidade });
  });
});

describe("base inteira", () => {
  it("ida e volta pelas tabelas preserva a base demonstrativa, sem campo sem coluna", () => {
    const aviso = vi.spyOn(console, "warn").mockImplementation(() => {});
    const base = criarBaseInicial();
    const devolta = baseDasTabelas(exportar(mudancasDeInsercao(base)));
    expect(aviso).not.toHaveBeenCalled();
    aviso.mockRestore();
    expect(JSON.parse(JSON.stringify(devolta))).toEqual(JSON.parse(JSON.stringify(base)));
  });

  it("ordem das listas é preservada mesmo com linhas fora de ordem", () => {
    const base = criarBaseInicial();
    const tabelas = exportar(mudancasDeInsercao(base));
    tabelas["event_factions"]!.reverse();
    const devolta = baseDasTabelas(tabelas);
    expect(devolta.eventos.map((e) => e.exercitos.map((x) => x.id))).toEqual(base.eventos.map((e) => e.exercitos.map((x) => x.id)));
  });

  it("sem alterações não gera lote", () => {
    const base = criarBaseInicial();
    expect(calcularMudancas(base, structuredClone(base))).toEqual({});
  });

  it("grava só o registro alterado e exclui o removido com as filhas", () => {
    const antes = criarBaseInicial();
    const depois = structuredClone(antes);
    depois.notificacoes[0]!.lida = !depois.notificacoes[0]!.lida;
    const i = depois.cupons.findIndex((c) => c.tiposElegiveis.length > 0);
    const [removido] = depois.cupons.splice(i, 1);
    const lote = calcularMudancas(antes, depois);
    expect(Object.keys(lote).sort()).toEqual(["coupon_eligible_ticket_types", "coupons", "notifications"]);
    expect(lote["notifications"]!.gravar).toHaveLength(1);
    expect(lote["notifications"]!.gravar[0]!["id"]).toBe(depois.notificacoes[0]!.id);
    expect(lote["coupons"]!.excluir).toEqual([{ id: removido!.id }]);
    expect(lote["coupon_eligible_ticket_types"]!.excluir).toHaveLength(removido!.tiposElegiveis.length);
  });

  it("alterar um item de lista grava só a linha filha", () => {
    const antes = criarBaseInicial();
    const depois = structuredClone(antes);
    depois.eventos[0]!.exercitos[0]!.nome = "Novo nome";
    const lote = calcularMudancas(antes, depois);
    expect(Object.keys(lote)).toEqual(["event_factions"]);
    expect(lote["event_factions"]!.gravar).toEqual([
      expect.objectContaining({ event_id: depois.eventos[0]!.id, position: 0, name: "Novo nome" }),
    ]);
  });

  it("visitas da comunidade usam chave composta (usuário, evento)", () => {
    const antes = criarBaseInicial();
    const depois = structuredClone(antes);
    depois.visitasComunidade["usr-ana:evt-serra-verde"] = "2026-01-01T00:00:00.000Z";
    const lote = calcularMudancas(antes, depois);
    expect(lote["community_visits"]!.gravar).toEqual([
      { user_id: "usr-ana", event_id: "evt-serra-verde", seen_at: "2026-01-01T00:00:00.000Z" },
    ]);
  });
});

describe("esquema", () => {
  it("toda coleção tem chave mapeada para coluna", () => {
    for (const t of Object.values(TABELAS)) for (const c of t.chave) expect(typeof t.campos[c]).toBe("string");
  });

  it("base_tables() da última migration lista exatamente as tabelas do mapeamento", () => {
    const pasta = join(__dirname, "../../supabase/migrations");
    const arquivos = readdirSync(pasta).filter((f) => f.endsWith(".sql")).sort().reverse();
    const sql = arquivos.map((f) => readFileSync(join(pasta, f), "utf8")).find((s) => /function public\.base_tables\(\)/.test(s));
    expect(sql).toBeDefined();
    const corpo = /function public\.base_tables\(\)[\s\S]*?array\[([\s\S]*?)\]::text\[\]/.exec(sql!)![1]!;
    const noBanco = [...corpo.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]).sort();
    expect(noBanco).toEqual([...TABELAS_BANCO.keys()].sort());
  });
});
