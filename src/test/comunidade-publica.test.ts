// Vitrine pública das comunidades: todos veem a porta, só inscritos confirmados e gestão entram.
import { describe, expect, it } from "vitest";
import { baseVazia } from "@/lib/persistencia";
import { acessoAComunidade, comunidadesVitrine } from "@/lib/comunidadePublica";
import type { BaseDados, Evento, Inscricao, Usuario } from "@/lib/domain/types";

const AGORA = new Date("2026-10-21T12:00:00Z");
const ev = (id: string, status: Evento["status"], inicio = "2026-11-10T10:00:00Z", fim = "2026-11-11T10:00:00Z") =>
  ({ id, organizacaoId: "org-1", nome: id, status, inicioEm: inicio, fimEm: fim, cidade: "Itu", uf: "SP" }) as Evento;
const user = (id: string, extra: Partial<Usuario> = {}) => ({ id, perfil: "participante", ativo: true, ...extra }) as Usuario;
const ins = (usuarioId: string, eventoId: string, status: Inscricao["status"], extra: Partial<Inscricao> = {}) =>
  ({ id: `${usuarioId}-${eventoId}`, usuarioId, eventoId, status, ...extra }) as Inscricao;

function montar(p: Partial<BaseDados>): BaseDados {
  return { ...baseVazia(), ...p };
}

describe("acesso à comunidade", () => {
  const base = montar({
    eventos: [ev("aberto", "publicado"), ev("fechado", "inscricoes_encerradas"), ev("cancelado", "cancelado")],
    usuarios: [user("membro"), user("novo"), user("reserva"), user("org", { perfil: "organizador", organizacaoId: "org-1" })],
    inscricoes: [
      ins("membro", "aberto", "confirmada"),
      ins("reserva", "aberto", "pendente", { pagamento: { status: "aguardando", expiraEm: "2026-10-21T13:00:00Z" } as Inscricao["pagamento"] }),
    ],
  });
  const u = (id: string) => base.usuarios.find((x) => x.id === id)!;

  it("membro confirmado e gestão entram", () => {
    expect(acessoAComunidade(base, u("membro"), "aberto", AGORA)).toBe("entrar");
    expect(acessoAComunidade(base, u("org"), "fechado", AGORA)).toBe("entrar");
  });

  it("visitante faz login; logado sem inscrição vai para a inscrição", () => {
    expect(acessoAComunidade(base, null, "aberto", AGORA)).toBe("login");
    expect(acessoAComunidade(base, u("novo"), "aberto", AGORA)).toBe("inscrever");
  });

  it("reserva sem pagamento não entra: vai concluir o pagamento", () => {
    expect(acessoAComunidade(base, u("reserva"), "aberto", AGORA)).toBe("pagamento_pendente");
  });

  it("inscrições encerradas e eventos cancelados não levam à inscrição", () => {
    expect(acessoAComunidade(base, u("novo"), "fechado", AGORA)).toBe("encerrada");
    expect(acessoAComunidade(base, u("novo"), "cancelado", AGORA)).toBe("indisponivel");
    expect(acessoAComunidade(base, null, "inexistente", AGORA)).toBe("indisponivel");
  });

  it("conta desativada é tratada como visitante", () => {
    const b = montar({ ...base, usuarios: [user("membro", { ativo: false })] });
    expect(acessoAComunidade(b, b.usuarios[0]!, "aberto", AGORA)).toBe("login");
  });
});

describe("vitrine", () => {
  it("mostra comunidades de eventos públicos futuros e as da pessoa primeiro, sem cancelados ou passados", () => {
    const base = montar({
      eventos: [
        ev("dez", "publicado", "2026-12-01T10:00:00Z", "2026-12-02T10:00:00Z"),
        ev("nov", "inscricoes_encerradas"),
        ev("meu-passado", "concluido", "2026-09-01T10:00:00Z", "2026-09-02T10:00:00Z"),
        ev("passado", "concluido", "2026-09-01T10:00:00Z", "2026-09-02T10:00:00Z"),
        ev("cancelado", "cancelado"),
        ev("rascunho", "rascunho"),
      ],
      usuarios: [user("eu")],
      inscricoes: [ins("eu", "meu-passado", "confirmada"), ins("outro", "dez", "confirmada"), ins("x", "dez", "cancelada")],
    });
    const lista = comunidadesVitrine(base, base.usuarios[0]!, AGORA);
    expect(lista.map((i) => [i.evento.id, i.acesso])).toEqual([
      ["meu-passado", "entrar"],
      ["nov", "encerrada"],
      ["dez", "inscrever"],
    ]);
    expect(lista.find((i) => i.evento.id === "dez")!.confirmados).toBe(1);
    expect(comunidadesVitrine(base, null, AGORA).map((i) => i.evento.id)).toEqual(["nov", "dez"]);
  });
});
