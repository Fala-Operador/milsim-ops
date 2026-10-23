// Inclusão manual pela gestão do evento: cortesia já resgatada, sem lote, com capacidade e origem.
import { describe, it, expect, beforeEach } from "vitest";
import { restaurarBase } from "@/test/baseTeste";
import { incluirParticipantes, resumoFinanceiro } from "@/services/inscricoes";
import type { BaseDados, Evento, Usuario } from "@/lib/domain/types";

let base: BaseDados;
const EVT = "evt-inclusao";
const dia = 86400000;
const iso = (d: number) => new Date(Date.now() + d * dia).toISOString();
const usuario = (id: string) => base.usuarios.find((u) => u.id === id)!;
const admin = () => usuario("usr-admin");
const organizador = () => usuario("usr-organizador");
const participante = () => usuario("usr-participante");

function evento(extra: Partial<Evento> = {}): Evento {
  return {
    id: EVT, organizacaoId: organizador().organizacaoId!, nome: "Operação Manual", descricaoResumida: "", enredo: "",
    inicioEm: iso(30), fimEm: iso(31), fuso: "America/Sao_Paulo", local: "", endereco: "", cidade: "Itu", uf: "SP",
    capacidadeTotal: 10, exercitos: [{ id: "ex-a", nome: "A", capacidade: 10 }],
    tipos: [{ id: "tp-a", nome: "Padrão", precoBaseCentavos: 20000, quantidadeMaxima: 10 }],
    // Sem lote: a venda normal estaria fechada.
    lotes: [], cronograma: [], status: "publicado", criadoEm: iso(-1), ...extra,
  } as Evento;
}
const incluir = async (autor: Usuario, identificador = participante().email, observacao?: string) =>
  (await incluirParticipantes({ eventoId: EVT, identificador, tipoId: "tp-a", exercitoId: "ex-a", observacao }, autor))[0]!;
const incluirVarios = (autor: Usuario, usuarioIds: string[]) =>
  incluirParticipantes({ eventoId: EVT, usuarioIds, tipoId: "tp-a", exercitoId: "ex-a" }, autor);

beforeEach(() => {
  base = restaurarBase();
  base.eventos.push(evento());
});

describe("inclusão manual de participante", () => {
  it("organizador inclui por e-mail sem lote aberto: confirmada, cortesia resgatada e sem valor", async () => {
    const ins = await incluir(organizador(), participante().email.toUpperCase(), "PIX direto");
    expect(ins).toMatchObject({ status: "confirmada", origem: "organizador", valorCentavos: 0, usuarioId: "usr-participante" });
    expect(ins.tokenEntrada).toBeTruthy();
    const cortesia = base.cortesias.find((c) => c.id === ins.cortesiaId)!;
    expect(cortesia.status).toBe("resgatada");
    const r = resumoFinanceiro(EVT);
    expect(r.bruto).toBe(0);
    expect(r.cortesiasResgatadas).toBe(1);
    expect(base.auditoria.at(-1)).toMatchObject({ acao: "inclusao_manual", autorId: "usr-organizador", entidadeId: ins.id });
    expect(base.auditoria.at(-1)!.justificativa).toContain("PIX direto");
  });

  it("admin inclui por CPF (com máscara): origem admin e a organização é notificada", async () => {
    const cpf = participante().cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
    const ins = await incluir(admin(), cpf);
    expect(ins.origem).toBe("admin");
    expect(base.notificacoes.some((n) => n.usuarioId === "usr-organizador" && n.titulo === "Participante incluído pela administração")).toBe(true);
  });

  it("vale com as inscrições encerradas, mas não em evento cancelado", async () => {
    base.eventos.find((e) => e.id === EVT)!.status = "inscricoes_encerradas";
    await expect(incluir(organizador())).resolves.toMatchObject({ status: "confirmada" });
    base.eventos.find((e) => e.id === EVT)!.status = "cancelado";
    await expect(incluir(organizador(), organizador().email)).rejects.toThrow(/não está disponível/);
  });

  it("conta inexistente ou identificador inválido", async () => {
    await expect(incluir(organizador(), "ninguem@exemplo.com")).rejects.toThrow(/Nenhuma conta ativa/);
    await expect(incluir(organizador(), "123")).rejects.toThrow(/Nenhuma conta ativa/);
  });

  it("não duplica e fala com quem inclui; a cortesia da tentativa falha não sobra", async () => {
    await incluir(organizador());
    const antes = base.cortesias.length;
    await expect(incluir(admin())).rejects.toThrow("Esta pessoa já possui uma inscrição ativa neste evento.");
    expect(base.cortesias.length).toBe(antes);
  });

  it("admin inclui várias pessoas escolhidas na lista, com um aviso só para a organização", async () => {
    const lista = await incluirVarios(admin(), ["usr-participante", "usr-organizador", "usr-participante"]);
    expect(lista.map((i) => [i.usuarioId, i.origem, i.status])).toEqual([
      ["usr-participante", "admin", "confirmada"],
      ["usr-organizador", "admin", "confirmada"],
    ]);
    const avisos = base.notificacoes.filter((n) => n.usuarioId === "usr-organizador" && n.titulo.includes("pela administração"));
    expect(avisos).toHaveLength(1);
    expect(avisos[0]!.corpo).toContain("2 participantes");
    expect(base.auditoria.filter((a) => a.acao === "inclusao_manual")).toHaveLength(2);
  });

  it("organizador não escolhe pela lista de usuários", async () => {
    await expect(incluirVarios(organizador(), ["usr-participante"])).rejects.toThrow(/Só a administração/);
  });

  it("com várias pessoas, o erro diz quem impediu a inclusão", async () => {
    await incluir(organizador());
    await expect(incluirVarios(admin(), ["usr-organizador", "usr-participante"])).rejects.toThrow(
      `${participante().nomeCompleto}: Esta pessoa já possui uma inscrição ativa neste evento.`,
    );
  });

  it("respeita a capacidade do evento", async () => {
    base.eventos.find((e) => e.id === EVT)!.capacidadeTotal = 0;
    await expect(incluir(organizador())).rejects.toThrow(/esgotado/i);
  });
});
