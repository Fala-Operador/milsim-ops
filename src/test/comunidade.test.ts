// Regras da comunidade: permissões de fórum, curtida única, fóruns restritos e arquivados.
import { describe, it, expect, beforeEach } from "vitest";
import { carregarBase } from "@/services/db";
import { restaurarBase } from "@/test/baseTeste";
import {
  alternarArquivoForum, alternarCurtida, contarCurtidas, criarPublicacao, detalhePublicacao,
  excluirForum, listarFeed, moverPublicacao, responder, suspenderUsuario,
} from "@/services/comunidade";

class LS {
  private m = new Map<string, string>();
  get length() { return this.m.size; }
  key(i: number) { return [...this.m.keys()][i] ?? null; }
  getItem(k: string) { return this.m.get(k) ?? null; }
  setItem(k: string, v: string) { this.m.set(k, v); }
  removeItem(k: string) { this.m.delete(k); }
}
Object.defineProperty(globalThis, "window", { value: { localStorage: new LS() }, configurable: true });

const u = (id: string) => carregarBase().usuarios.find((x) => x.id === id)!;
const F = (s: string) => `for-evt-serra-verde-${s}`;
beforeEach(() => restaurarBase());

describe("comunidade", () => {
  it("participante não publica em Avisos oficiais, mas responde", () => {
    expect(() => criarPublicacao(u("usr-participante"), { forumId: F("avisos"), texto: "oi", imagens: [] })).toThrow();
    expect(() => responder(u("usr-participante"), "pub-2", "ok")).not.toThrow();
  });
  it("participante publica na Conversa geral", () => {
    expect(criarPublicacao(u("usr-participante"), { forumId: F("geral"), texto: "olá", imagens: [] }).id).toBeTruthy();
  });
  it("texto acima de 2000 caracteres é recusado", () => {
    expect(() => criarPublicacao(u("usr-participante"), { forumId: F("geral"), texto: "a".repeat(2001), imagens: [] })).toThrow();
  });
  it("máximo de 4 imagens", () => {
    const imgs = Array.from({ length: 5 }, () => ({ url: "x" }));
    expect(() => criarPublicacao(u("usr-participante"), { forumId: F("geral"), texto: "", imagens: imgs })).toThrow();
  });
  it("curtida única por usuário (segunda remove)", () => {
    const antes = contarCurtidas(carregarBase(), "pub-3");
    alternarCurtida(u("usr-participante"), "pub-3");
    alternarCurtida(u("usr-participante"), "pub-3");
    expect(contarCurtidas(carregarBase(), "pub-3")).toBe(antes);
  });
  it("fórum restrito não aparece no feed nem por link para quem não tem acesso", () => {
    const feed = listarFeed(u("usr-bruno"), { eventoId: "evt-serra-verde" });
    expect([...feed.feed, ...feed.fixadas].some((p) => p.id === "pub-8")).toBe(false);
    expect(detalhePublicacao(u("usr-bruno"), "pub-8")).toBeNull();
    expect(detalhePublicacao(u("usr-ana"), "pub-8")).not.toBeNull();
  });
  it("fórum arquivado impede novas publicações", () => {
    alternarArquivoForum(u("usr-organizador"), F("geral"));
    expect(() => criarPublicacao(u("usr-participante"), { forumId: F("geral"), texto: "x", imagens: [] })).toThrow();
  });
  it("fórum com conteúdo não pode ser excluído", () => {
    expect(() => excluirForum(u("usr-organizador"), F("geral"))).toThrow();
  });
  it("não move entre fóruns com públicos diferentes", () => {
    expect(() => moverPublicacao(u("usr-organizador"), "pub-3", "for-serra-prep")).toThrow();
  });
  it("suspenso não curte nem publica", () => {
    suspenderUsuario(u("usr-organizador"), "evt-serra-verde", "usr-participante", "teste");
    expect(() => alternarCurtida(u("usr-participante"), "pub-3")).toThrow();
    expect(() => criarPublicacao(u("usr-participante"), { forumId: F("geral"), texto: "x", imagens: [] })).toThrow();
  });
});
