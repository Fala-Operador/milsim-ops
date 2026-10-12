import { beforeEach, describe, expect, it } from "vitest";
import { carregarBase, mutarBase, restaurarBase } from "@/services/db";
import { definirSilencio, silenciado } from "@/services/notificacoes";
import { publicar, responder } from "@/services/comunidade";

function usuario(id: string) {
  return carregarBase().usuarios.find((u) => u.id === id)!;
}

describe("silêncio de notificações", () => {
  beforeEach(() => restaurarBase());

  it("silenciar a comunidade impede aviso de resposta ao autor", () => {
    const base = carregarBase();
    const autor = base.usuarios.find((u) => u.id === "usr-ana")!;
    const outro = base.usuarios.find((u) => u.id === "usr-bruno")!;
    const pub = publicar(autor, "for-serra-geral", "Teste de silêncio", []);
    const antes = carregarBase().notificacoes.filter((n) => n.usuarioId === autor.id).length;

    definirSilencio(autor.id, { comunidade: true });
    responder(outro, pub.id, "Resposta com comunidade silenciada");

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
    const autor = usuario("usr-ana");
    const outro = usuario("usr-bruno");
    const pub = publicar(autor, "for-serra-geral", "Teste sem silêncio", []);
    responder(outro, pub.id, "Resposta normal");
    const aviso = carregarBase().notificacoes.find((n) => n.usuarioId === autor.id && n.titulo === "Novas respostas");
    expect(aviso).toBeTruthy();
  });

  it("desativar o silêncio volta a permitir notificações", () => {
    definirSilencio("usr-ana", { comunidade: true });
    definirSilencio("usr-ana", { comunidade: false });
    expect(silenciado(carregarBase(), "usr-ana", "comunidade")).toBe(false);
  });
});
