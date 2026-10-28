// Lista de usuários do admin: busca (nome sem acento, e-mail, CPF), filtros, ordenação e páginas.
import { describe, it, expect } from "vitest";
import type { Usuario } from "@/lib/domain/types";
import {
  alternarOrdenacao, filtrarUsuarios, FILTROS_USUARIOS_VAZIOS, ordenarUsuarios, paginar, type FiltrosUsuarios,
} from "@/lib/usuariosAdmin";

const usuario = (id: string, extra: Partial<Usuario>): Usuario => ({
  id, perfil: "participante", nomeCompleto: id, cpf: "00000000000", dataNascimento: "1990-01-01",
  email: `${id}@ex.com`, whatsapp: "83999999999",
  endereco: { cep: "58000000", logradouro: "Rua", numero: "1", bairro: "Centro", cidade: "João Pessoa", uf: "PB" },
  autorizacaoPromocional: false, aceiteTermosVersao: "1", aceiteTermosEm: "2026-01-01T00:00:00Z",
  ativo: true, criadoEm: "2026-01-01T00:00:00Z", ...extra,
} as Usuario);

const lista = [
  usuario("u1", { nomeCompleto: "João Silva", email: "joao@ex.com", cpf: "12345678901", criadoEm: "2026-03-01T00:00:00Z" }),
  usuario("u2", { nomeCompleto: "ana souza", perfil: "organizador", criadoEm: "2026-05-01T00:00:00Z" }),
  usuario("u3", { nomeCompleto: "Bruno Lima", ativo: false, criadoEm: "2026-01-15T00:00:00Z" }),
  usuario("u4", { nomeCompleto: "Ângela Reis", perfil: "admin", autorizacaoResponsavel: "pendente", criadoEm: "2026-04-01T00:00:00Z" }),
];
const filtros = (f: Partial<FiltrosUsuarios>) => ({ ...FILTROS_USUARIOS_VAZIOS, ...f });
const ids = (us: Usuario[]) => us.map((u) => u.id);

describe("filtrarUsuarios", () => {
  it("busca nome sem diferenciar acento nem maiúsculas", () => {
    expect(ids(filtrarUsuarios(lista, filtros({ busca: "JOAO" })))).toEqual(["u1"]);
    expect(ids(filtrarUsuarios(lista, filtros({ busca: "angela" })))).toEqual(["u4"]);
  });

  it("busca por e-mail e por CPF com ou sem pontuação", () => {
    expect(ids(filtrarUsuarios(lista, filtros({ busca: "joao@" })))).toEqual(["u1"]);
    expect(ids(filtrarUsuarios(lista, filtros({ busca: "123.456.789-01" })))).toEqual(["u1"]);
    expect(ids(filtrarUsuarios(lista, filtros({ busca: "456789" })))).toEqual(["u1"]);
  });

  it("texto sem dígitos não casa com CPF", () => {
    expect(filtrarUsuarios(lista, filtros({ busca: "xyz" }))).toEqual([]);
  });

  it("filtra por perfil e por status", () => {
    expect(ids(filtrarUsuarios(lista, filtros({ perfil: "organizador" })))).toEqual(["u2"]);
    expect(ids(filtrarUsuarios(lista, filtros({ status: "inativo" })))).toEqual(["u3"]);
    expect(ids(filtrarUsuarios(lista, filtros({ status: "ativo" })))).toEqual(["u1", "u2", "u4"]);
    expect(ids(filtrarUsuarios(lista, filtros({ status: "autorizacao_pendente" })))).toEqual(["u4"]);
  });
});

describe("ordenarUsuarios", () => {
  it("ordena nome em ordem alfabética do português, sem mexer na lista original", () => {
    const copia = [...lista];
    expect(ids(ordenarUsuarios(lista, { campo: "nome", direcao: "asc" }))).toEqual(["u2", "u4", "u3", "u1"]);
    expect(ids(ordenarUsuarios(lista, { campo: "nome", direcao: "desc" }))).toEqual(["u1", "u3", "u4", "u2"]);
    expect(lista).toEqual(copia);
  });

  it("cadastro decrescente traz os mais recentes primeiro", () => {
    expect(ids(ordenarUsuarios(lista, { campo: "cadastro", direcao: "desc" }))).toEqual(["u2", "u4", "u1", "u3"]);
  });

  it("status põe ativos antes, com empate resolvido pelo nome", () => {
    expect(ids(ordenarUsuarios(lista, { campo: "status", direcao: "asc" }))).toEqual(["u2", "u4", "u1", "u3"]);
  });

  it("clicar na mesma coluna inverte; outra coluna começa crescente, cadastro começa pelo mais recente", () => {
    expect(alternarOrdenacao({ campo: "nome", direcao: "asc" }, "nome")).toEqual({ campo: "nome", direcao: "desc" });
    expect(alternarOrdenacao({ campo: "nome", direcao: "desc" }, "email")).toEqual({ campo: "email", direcao: "asc" });
    expect(alternarOrdenacao({ campo: "nome", direcao: "asc" }, "cadastro")).toEqual({ campo: "cadastro", direcao: "desc" });
  });
});

describe("paginar", () => {
  const numeros = Array.from({ length: 45 }, (_, i) => i + 1);

  it("recorta a página e informa o intervalo", () => {
    const p = paginar(numeros, 3, 20);
    expect(p).toMatchObject({ pagina: 3, totalPaginas: 3, inicio: 40, fim: 45 });
    expect(p.itens).toEqual([41, 42, 43, 44, 45]);
  });

  it("página fora do intervalo cai na mais próxima; lista vazia tem uma página", () => {
    expect(paginar(numeros, 9, 20).pagina).toBe(3);
    expect(paginar(numeros, 0, 20).pagina).toBe(1);
    expect(paginar([], 1, 20)).toMatchObject({ pagina: 1, totalPaginas: 1, itens: [] });
  });
});
