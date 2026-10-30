// Edição do cadastro de outra pessoa pela administração: mesmas regras de "Meu perfil",
// CPF válido e único, e-mail intocado, auditoria só com os nomes dos campos.
import { describe, it, expect, beforeEach } from "vitest";
import { restaurarBase } from "@/test/baseTeste";
import { carregarBase } from "@/services/db";
import { editarDadosUsuario, type DadosUsuarioAdmin } from "@/services/admin";
import type { Usuario } from "@/lib/domain/types";

let alvo: Usuario;
let adminId: string;

const dados = (u: Usuario, extra: Partial<DadosUsuarioAdmin> = {}): DadosUsuarioAdmin => ({
  cpf: u.cpf,
  nomeCompleto: u.nomeCompleto,
  dataNascimento: u.dataNascimento,
  whatsapp: u.whatsapp,
  cep: u.endereco.cep,
  logradouro: u.endereco.logradouro,
  numero: u.endereco.numero,
  complemento: u.endereco.complemento,
  bairro: u.endereco.bairro,
  cidade: u.endereco.cidade,
  uf: u.endereco.uf,
  instagram: u.instagram,
  squad: u.squad,
  ...extra,
});

const atual = () => carregarBase().usuarios.find((u) => u.id === alvo.id)!;

beforeEach(() => {
  const base = restaurarBase();
  alvo = base.usuarios.find((x) => x.perfil === "participante")!;
  adminId = base.usuarios.find((x) => x.perfil === "admin")!.id;
});

describe("admin edita dados de usuário", () => {
  it("corrige nome e CPF, mantém o e-mail e audita só os nomes dos campos", async () => {
    const email = alvo.email;
    await editarDadosUsuario(alvo.id, adminId, dados(alvo, { nomeCompleto: " Nome  Corrigido ", cpf: "123.456.789-09" }));
    const u = atual();
    expect(u.nomeCompleto).toBe("Nome Corrigido");
    expect(u.cpf).toBe("12345678909");
    expect(u.email).toBe(email);
    const aud = carregarBase().auditoria.at(-1)!;
    expect(aud).toMatchObject({ autorId: adminId, acao: "editar_usuario", entidade: "usuario", entidadeId: alvo.id });
    expect(aud.justificativa).toBe("Campos alterados: nome, cpf");
    expect(aud.justificativa).not.toContain("12345678909");
  });

  it("recusa CPF inválido ou de outra conta", async () => {
    await expect(editarDadosUsuario(alvo.id, adminId, dados(alvo, { cpf: "111.111.111-11" }))).rejects.toThrow("CPF inválido.");
    const outro = carregarBase().usuarios.find((u) => u.id !== alvo.id)!;
    await expect(editarDadosUsuario(alvo.id, adminId, dados(alvo, { cpf: outro.cpf }))).rejects.toThrow("Já existe um cadastro com este CPF.");
  });

  it("aplica as validações de Meu perfil", async () => {
    await expect(editarDadosUsuario(alvo.id, adminId, dados(alvo, { whatsapp: "123" }))).rejects.toThrow();
    await expect(editarDadosUsuario("nao-existe", adminId, dados(alvo))).rejects.toThrow("Usuário não encontrado.");
  });

  it("não audita quando nada muda", async () => {
    const antes = carregarBase().auditoria.length;
    await editarDadosUsuario(alvo.id, adminId, dados(alvo));
    expect(carregarBase().auditoria.length).toBe(antes);
  });
});
