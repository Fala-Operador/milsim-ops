// Cifra dos dados pessoais no banco: ida e volta, contexto da linha, rotação e linhas antigas em texto puro.
import { describe, it, expect } from "vitest";
import { criarBaseInicial } from "@/data/seed";
import { COLUNAS_CIFRADAS, INDICES_CEGOS } from "@/lib/esquemaBanco";
import { baseDasTabelas, calcularMudancas, linhasDaBase, mudancasDeInsercao, TABELAS_BANCO, type TabelasExportadas } from "@/lib/persistencia";
import {
  cifrarLote, cifrarValor, criarChaveiro, decifrarTabelas, decifrarValor, ehCifrado, incluirPendentes, totalPendentes,
} from "@/server/cifraDados";

const novaChave = () => btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32))));

/** Simula o banco: aplica o lote de inserção e devolve o que export_base devolveria. */
function exportar(lote: ReturnType<typeof mudancasDeInsercao>): TabelasExportadas {
  return Object.fromEntries(Object.entries(lote).map(([t, m]) => [t, JSON.parse(JSON.stringify(m.gravar))]));
}

describe("cifra dos dados pessoais", () => {
  it("toda tabela e coluna cifrada existe no esquema e não é chave primária", () => {
    const base = criarBaseInicial();
    const linhas = linhasDaBase(base);
    for (const [tabela, colunas] of Object.entries(COLUNAS_CIFRADAS)) {
      const def = TABELAS_BANCO.get(tabela);
      expect(def, tabela).toBeDefined();
      for (const c of colunas) expect(def!.colunasChave).not.toContain(c);
    }
    expect(linhas["users"]![0]).toHaveProperty("cpf");
    for (const [tabela, indices] of Object.entries(INDICES_CEGOS)) {
      for (const c of Object.keys(indices)) expect(COLUNAS_CIFRADAS[tabela]).toContain(c);
    }
  });

  it("o banco recebe só texto cifrado e a base volta idêntica", async () => {
    const chaveiro = await criarChaveiro(novaChave());
    const base = criarBaseInicial();
    const gravado = exportar(await cifrarLote(mudancasDeInsercao(base), chaveiro));
    const usuario = base.usuarios[0]!;
    const linha = gravado["users"]!.find((l) => l["id"] === usuario.id)!;
    for (const c of COLUNAS_CIFRADAS["users"]!) {
      if (linha[c] !== undefined) expect(ehCifrado(linha[c]), c).toBe(true);
    }
    expect(JSON.stringify(gravado)).not.toContain(usuario.cpf);
    expect(JSON.stringify(gravado)).not.toContain(usuario.email);
    expect(linha["cpf_hash"]).toMatch(/^[0-9a-f]{64}$/);

    const { tabelas, pendentes } = await decifrarTabelas(gravado, chaveiro);
    expect(totalPendentes(pendentes)).toBe(0);
    expect(baseDasTabelas(tabelas)).toEqual(baseDasTabelas(exportar(mudancasDeInsercao(base))));
  });

  it("o mesmo valor cifra diferente a cada vez, mas o índice cego é estável", async () => {
    const chaveiro = await criarChaveiro(novaChave());
    const lote = { users: { gravar: [{ id: "u1", cpf: "12345678909", email: "a@b.c" }], excluir: [] } };
    const a = (await cifrarLote(lote, chaveiro))["users"]!.gravar[0]!;
    const b = (await cifrarLote(lote, chaveiro))["users"]!.gravar[0]!;
    expect(a["cpf"]).not.toBe(b["cpf"]);
    expect(a["cpf_hash"]).toBe(b["cpf_hash"]);
    expect(a["email_hash"]).not.toBe(a["cpf_hash"]);
  });

  it("valor movido para outra linha ou coluna, adulterado ou com chave desconhecida não decifra", async () => {
    const chaveiro = await criarChaveiro(novaChave());
    const v = await cifrarValor(chaveiro.atual!, "12345678909", "users", "cpf", "u1");
    expect((await decifrarValor(chaveiro, v, "users", "cpf", "u1")).texto).toBe("12345678909");
    await expect(decifrarValor(chaveiro, v, "users", "cpf", "u2")).rejects.toThrow(/não pôde ser decifrado/);
    await expect(decifrarValor(chaveiro, v, "users", "whatsapp", "u1")).rejects.toThrow(/não pôde ser decifrado/);
    const semOutra = await criarChaveiro(novaChave());
    const adulterado = v.slice(0, -2) + (v.endsWith("A") ? "BB" : "AA");
    await expect(decifrarValor(chaveiro, adulterado, "users", "cpf", "u1")).rejects.toThrow();
    await expect(decifrarValor(semOutra, v, "users", "cpf", "u1")).rejects.toThrow(/não está em/);
  });

  it("linhas antigas em texto puro são lidas e marcadas para regravar cifradas", async () => {
    const chaveiro = await criarChaveiro(novaChave());
    const base = criarBaseInicial();
    const puro = exportar(mudancasDeInsercao(base));
    const { tabelas, pendentes } = await decifrarTabelas(puro, chaveiro);
    expect(pendentes["users"]).toHaveLength(base.usuarios.length);
    const lida = baseDasTabelas(tabelas);

    // Uma gravação qualquer leva junto as pendentes, que saem cifradas.
    const depois = structuredClone(lida);
    depois.usuarios[0]!.tema = "light";
    const lote = await cifrarLote(incluirPendentes(calcularMudancas(lida, depois), pendentes, linhasDaBase(depois)), chaveiro);
    expect(lote["users"]!.gravar).toHaveLength(base.usuarios.length);
    expect(lote["users"]!.gravar.find((l) => l["id"] === depois.usuarios[0]!.id)!["theme"]).toBe("light");
    expect(lote["users"]!.gravar.every((l) => ehCifrado(l["cpf"]))).toBe(true);
  });

  it("rotação: chave antiga ainda decifra e a linha fica pendente até ser regravada com a nova", async () => {
    const antiga = novaChave();
    const base = criarBaseInicial();
    const gravado = exportar(await cifrarLote(mudancasDeInsercao(base), await criarChaveiro(antiga)));
    const rotacionado = await criarChaveiro(novaChave(), antiga);
    const { tabelas, pendentes } = await decifrarTabelas(gravado, rotacionado);
    expect(pendentes["users"]).toHaveLength(base.usuarios.length);
    expect(baseDasTabelas(tabelas).usuarios).toEqual(baseDasTabelas(exportar(mudancasDeInsercao(base))).usuarios);
  });

  it("sem chave configurada não grava dado pessoal", async () => {
    const semChave = await criarChaveiro(undefined);
    await expect(cifrarLote({ users: { gravar: [{ id: "u1", cpf: "1" }], excluir: [] } }, semChave)).rejects.toThrow(/não configurada/);
    expect(await cifrarLote({ events: { gravar: [{ id: "e1" }], excluir: [] } }, semChave)).toEqual({ events: { gravar: [{ id: "e1" }], excluir: [] } });
    await expect(criarChaveiro("curta")).rejects.toThrow(/32 bytes/);
  });
});
