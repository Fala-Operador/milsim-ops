// Fronteira de autorização das leituras: o que cada perfil recebe do servidor.
import { describe, it, expect, beforeEach } from "vitest";
import { visaoParaUsuario } from "@/lib/visao";
import { restaurarBase } from "@/test/baseTeste";
import type { BaseDados, Usuario } from "@/lib/domain/types";

let base: BaseDados;
const usuario = (id: string) => base.usuarios.find((u) => u.id === id)!;

beforeEach(() => {
  base = restaurarBase();
  // Segunda organização com um rascunho, para testar o isolamento entre organizações.
  base.organizacoes.push({ ...base.organizacoes[0]!, id: "org-outra", nome: "Outra", responsavelId: "usr-ana" });
  base.eventos.push({ ...structuredClone(base.eventos[0]!), id: "evt-outra-rascunho", organizacaoId: "org-outra", status: "rascunho" });
  base.cupons.push({ ...base.cupons[0]!, id: "cup-outra", eventoId: "evt-outra-rascunho", codigo: "OUTRA" });
});

describe("visitante", () => {
  it("não recebe dados pessoais, cupons, rascunhos nem notificações", () => {
    const v = visaoParaUsuario(base, null);
    const json = JSON.stringify(v);
    expect(json).not.toContain("00000000191"); // CPF do admin
    expect(json).not.toContain("usuario@teste.com.br");
    expect(v.cupons).toEqual([]);
    expect(v.notificacoes).toEqual([]);
    expect(v.auditoria).toEqual([]);
    expect(v.eventos.some((e) => e.status === "rascunho")).toBe(false);
    expect(v.publicacoes).toEqual([]);
  });

  it("mantém contagens de vagas com inscrições anônimas (sem titular nem token)", () => {
    const v = visaoParaUsuario(base, null);
    const doEvento = (b: BaseDados) => b.inscricoes.filter((i) => i.eventoId === "evt-escudo-norte" && i.status === "confirmada").length;
    expect(doEvento(v)).toBe(doEvento(base));
    expect(v.inscricoes.every((i) => i.usuarioId === "" && !i.tokenEntrada && i.codigo === "")).toBe(true);
  });
});

describe("participante", () => {
  it("vê as próprias inscrições completas e as de terceiros anônimas", () => {
    const eu = usuario("usr-participante");
    const v = visaoParaUsuario(base, eu);
    const minhas = v.inscricoes.filter((i) => i.usuarioId === eu.id);
    expect(minhas.length).toBe(base.inscricoes.filter((i) => i.usuarioId === eu.id).length);
    expect(minhas.every((i) => i.codigo !== "")).toBe(true);
    expect(v.inscricoes.filter((i) => i.usuarioId !== eu.id).every((i) => i.usuarioId === "")).toBe(true);
  });

  it("não recebe cupons e só as cortesias do próprio e-mail", () => {
    const eu = usuario("usr-participante");
    const v = visaoParaUsuario(base, eu);
    expect(v.cupons).toEqual([]);
    expect(v.cortesias.every((c) => c.emailConvidado === eu.email)).toBe(true);
  });

  it("recebe a comunidade do evento com autores em perfil público", () => {
    const v = visaoParaUsuario(base, usuario("usr-participante"));
    expect(v.publicacoes.length).toBeGreaterThan(0);
    const autor = v.usuarios.find((u) => u.id === "usr-ana")!;
    expect(autor.cpf).toBe("");
    expect(autor.email).toBe("");
    expect(autor.nomeCompleto).not.toContain("Fictícia"); // só o nome de exibição
  });

  it("vê apenas as próprias notificações", () => {
    const eu = usuario("usr-participante");
    expect(visaoParaUsuario(base, eu).notificacoes.every((n) => n.usuarioId === eu.id)).toBe(true);
  });
});

describe("organizador", () => {
  it("gere só a própria organização", () => {
    const v = visaoParaUsuario(base, usuario("usr-organizador"));
    expect(v.cupons.some((c) => c.id === "cup-outra")).toBe(false);
    expect(v.cupons.some((c) => c.eventoId === "evt-serra-verde")).toBe(true);
    expect(v.eventos.some((e) => e.id === "evt-outra-rascunho")).toBe(false);
    expect(v.eventos.some((e) => e.id === "evt-raposa")).toBe(true); // rascunho próprio
  });

  it("recebe os dados completos dos inscritos nos próprios eventos", () => {
    const v = visaoParaUsuario(base, usuario("usr-organizador"));
    const participante = v.usuarios.find((u) => u.id === "usr-participante")!;
    expect(participante.cpf).not.toBe("");
    expect(v.inscricoes.find((i) => i.usuarioId === "usr-participante")?.tokenEntrada).toBeTruthy();
  });
});

describe("admin", () => {
  it("recebe tudo, inclusive auditoria e notificações da plataforma", () => {
    const v = visaoParaUsuario(base, usuario("usr-admin"));
    expect(v.usuarios).toHaveLength(base.usuarios.length);
    expect(v.cupons).toHaveLength(base.cupons.length);
    expect(v.auditoria).toHaveLength(base.auditoria.length);
    expect(v.notificacoes).toHaveLength(base.notificacoes.length);
  });

  it("conta desativada é tratada como visitante", () => {
    const admin: Usuario = { ...usuario("usr-admin"), ativo: false };
    expect(visaoParaUsuario(base, admin).auditoria).toEqual([]);
  });
});
