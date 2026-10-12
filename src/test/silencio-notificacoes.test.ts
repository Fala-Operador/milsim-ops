import { beforeEach, describe, expect, it } from "vitest";
import { carregarBase, restaurarBase } from "@/services/db";
import { definirSilencio, silenciado } from "@/services/notificacoes";
import { criarPublicacao, responder } from "@/services/comunidade";

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
const FORUM = "for-evt-serra-verde-geral";

describe("silêncio de notificações", () => {
  beforeEach(() => restaurarBase());

  it("silenciar a comunidade impede aviso de resposta ao autor", () => {
    const autor = u("usr-ana");
    const pub = criarPublicacao(autor, { forumId: FORUM, texto: "Teste de silêncio", imagens: [] });
    const antes = carregarBase().notificacoes.filter((n) => n.usuarioId === autor.id).length;

    definirSilencio(autor.id, { comunidade: true });
    responder(u("usr-bruno"), pub.id, "Resposta com comunidade silenciada");

    const depois = carregarBase().notificacoes.filter((n) => n.usuarioId === autor.id).length;
    expect(depois).toBe(antes);
  });

  it("silenciar todas bloqueia também notificações gerais", () => {
    definirSilencio("usr-ana", { todas: true });
    const base = carregarBase();
    expect(silenciado(base, "usr-ana", "geral")).toBe(true);
    expect(silenciado(base, "usr-ana", "comunidade")).toBe(true);
  });

  it("sem silêncio, a notificação de resposta é criada normalmente", () => {
    const autor = u("usr-ana");
    const pub = criarPublicacao(autor, { forumId: FORUM, texto: "Teste sem silêncio", imagens: [] });
    responder(u("usr-bruno"), pub.id, "Resposta normal");
    const aviso = carregarBase().notificacoes.find((n) => n.usuarioId === autor.id && n.titulo === "Novas respostas");
    expect(aviso).toBeTruthy();
  });

  it("desativar o silêncio volta a permitir notificações", () => {
    definirSilencio("usr-ana", { comunidade: true });
    definirSilencio("usr-ana", { comunidade: false });
    expect(silenciado(carregarBase(), "usr-ana", "comunidade")).toBe(false);
  });
});
