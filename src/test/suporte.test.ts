import { describe, expect, it } from "vitest";
import {
  acoesPermitidas,
  estadoCompositor,
  podeVer,
  podeAtender,
  statusAposMensagem,
  transicao,
  responsavelId,
  protocolo,
  registrarLeitura,
  lidoAteSuporte,
} from "@/lib/suporte";
import type { BaseDados, Chamado, Usuario } from "@/lib/domain/types";

const u = (id: string, perfil: Usuario["perfil"], organizacaoId?: string) =>
  ({ id, perfil, organizacaoId, ativo: true }) as Usuario;
const base = {
  eventos: [{ id: "ev1", organizacaoId: "org1" }],
  usuarios: [],
} as unknown as BaseDados;
const chamado = (p: Partial<Chamado> = {}): Chamado => ({
  id: "cha-abc123def",
  solicitanteId: "p1",
  assunto: "A",
  categoria: "Outro",
  descricao: "d",
  status: "aberto",
  mensagens: [],
  criadoEm: "2026-10-13T10:00:00Z",
  atualizadoEm: "2026-10-13T10:00:00Z",
  ...p,
});

describe("acesso ao suporte", () => {
  it("chamado da plataforma: só solicitante e admin", () => {
    const c = chamado();
    expect(podeVer(base, u("p1", "participante"), c)).toBe(true);
    expect(podeVer(base, u("adm", "admin"), c)).toBe(true);
    expect(podeVer(base, u("org", "organizador", "org1"), c)).toBe(false);
    expect(podeVer(base, u("p2", "participante"), c)).toBe(false);
  });
  it("chamado de evento chega só à administração: organizador não vê sem encaminhamento", () => {
    const c = chamado({ eventoId: "ev1" });
    expect(podeAtender(base, u("org", "organizador", "org1"), c)).toBe(false);
    expect(podeVer(base, u("org", "organizador", "org1"), c)).toBe(false);
    expect(podeAtender(base, u("adm", "admin"), c)).toBe(true);
  });
});

describe("encaminhamento ao organizador", () => {
  const usuarios = [
    u("p1", "participante"),
    u("adm", "admin"),
    u("org", "organizador", "org1"),
    u("org2", "organizador", "org2"),
  ];
  const b = {
    eventos: [{ id: "ev1", organizacaoId: "org1" }],
    usuarios,
    chamados: [],
  } as unknown as BaseDados;
  const anexo = { caminho: "suporte/x", nome: "foto.png", tipo: "image/png", tamanho: 10 };
  const c = chamado({
    eventoId: "ev1",
    status: "em_atendimento",
    mensagens: [
      { id: "m1", autorId: "p1", corpo: "dados pessoais", criadoEm: "2026-10-13T10:00:00Z", anexo },
      {
        id: "m2",
        autorId: "p1",
        corpo: "outro",
        criadoEm: "2026-10-13T10:01:00Z",
        anexo: { ...anexo, nome: "doc.pdf" },
      },
      {
        id: "h1",
        autorId: "adm",
        corpo: "Encaminhado",
        criadoEm: "2026-10-13T11:00:00Z",
        tipo: "sistema",
        canal: "interno",
        acao: { tipo: "encaminhamento", valor: "enc1" },
        encaminhamento: {
          organizacaoId: "org1",
          orientacao: "Confirme o horário",
          anexos: [{ mensagemId: "m1", nome: "foto.png", tipo: "image/png", tamanho: 10 }],
        },
      },
    ],
  });
  (b as { chamados: Chamado[] }).chamados = [c];

  it("organizador destinatário vê só o encaminhamento, sem conversa nem descrição", () => {
    const v = vistaDoChamado(b, u("org", "organizador", "org1"), c)!;
    expect(v.descricao).toBe("");
    expect(v.mensagens.map((m) => m.id)).toEqual(["h1"]);
    expect(vistaDoChamado(b, u("org2", "organizador", "org2"), c)).toBeNull();
  });
  it("organizador abre só anexos compartilhados", () => {
    expect(podeAbrirAnexo(b, u("org", "organizador", "org1"), c, "m1")).toBe(true);
    expect(podeAbrirAnexo(b, u("org", "organizador", "org1"), c, "m2")).toBe(false);
  });
  it("participante não recebe comunicação interna", () => {
    const comResposta = {
      ...c,
      mensagens: [
        ...c.mensagens,
        {
          id: "i1",
          autorId: "org",
          corpo: "interno",
          criadoEm: "2026-10-13T12:00:00Z",
          canal: "interno" as const,
          encaminhamentoId: "enc1",
        },
      ],
    };
    expect(
      vistaDoChamado(b, u("p1", "participante"), comResposta)!.mensagens.map((m) => m.id),
    ).toEqual(["m1", "m2"]);
  });
  it("status: aguardando organizador até o retorno; retorno sinalizado até a administração agir", () => {
    expect(statusExibido(b, c)).toBe("aguardando_organizador");
    const resp = {
      ...c,
      mensagens: [
        ...c.mensagens,
        {
          id: "i1",
          autorId: "org",
          corpo: "ok",
          criadoEm: "2026-10-13T12:00:00Z",
          canal: "interno" as const,
          encaminhamentoId: "enc1",
        },
      ],
    };
    expect(statusExibido(b, resp)).toBe("em_atendimento");
    expect(retornoRecebido(b, resp)).toBe(true);
    const tratado = {
      ...resp,
      mensagens: [
        ...resp.mensagens,
        { id: "x", autorId: "adm", corpo: "resposta", criadoEm: "2026-10-13T13:00:00Z" },
      ],
    };
    expect(retornoRecebido(b, tratado)).toBe(false);
  });
  it("links: cada perfil abre sua área; notificação antiga é reescrita", () => {
    const antigo = `/app/suporte?c=${c.id}`;
    expect(resolverLinkSuporte(b, u("adm", "admin"), antigo)).toBe(`/admin/suporte?c=${c.id}`);
    expect(resolverLinkSuporte(b, u("p1", "participante"), antigo)).toBe(`/app/suporte?c=${c.id}`);
    expect(
      resolverLinkSuporte(b, u("org", "organizador", "org1"), `/organizacao/suporte?c=${c.id}`),
    ).toBe("/organizacao/suporte?e=enc1");
    expect(
      resolverLinkSuporte(b, u("org2", "organizador", "org2"), "/organizacao/suporte?e=enc1"),
    ).toBe("/organizacao/suporte?e=enc1");
    expect(podeVer(b, u("org2", "organizador", "org2"), c)).toBe(false);
  });
});

describe("status do chamado", () => {
  it("resposta do participante em 'aguardando' volta para em atendimento", () => {
    expect(statusAposMensagem(chamado({ status: "aguardando_participante" }), true)).toBe(
      "em_atendimento",
    );
  });
  it("fechado é somente leitura", () => {
    expect(() => statusAposMensagem(chamado({ status: "fechado" }), true)).toThrow(
      /somente leitura/,
    );
    expect(() => transicao(chamado({ status: "fechado" }), "reabrir", false, true)).toThrow();
  });
  it("só resolvido pode ser reaberto pelo participante", () => {
    expect(transicao(chamado({ status: "resolvido" }), "reabrir", false, true)).toBe("aberto");
    expect(() =>
      transicao(chamado({ status: "em_atendimento" }), "reabrir", false, true),
    ).toThrow();
  });
  it("participante não resolve", () => {
    expect(() => transicao(chamado(), "resolver", false, true)).toThrow();
  });
  it("resolvido: o participante reabre antes de escrever; a equipe continua podendo responder", () => {
    expect(() => statusAposMensagem(chamado({ status: "resolvido" }), true)).toThrow(
      /Reabra o chamado/,
    );
    expect(statusAposMensagem(chamado({ status: "resolvido" }), false)).toBe("resolvido");
  });
  it("ações do participante vêm das transições existentes", () => {
    expect(acoesPermitidas(chamado({ status: "em_atendimento" }), false, true)).toEqual(["fechar"]);
    expect(acoesPermitidas(chamado({ status: "resolvido" }), false, true)).toEqual([
      "reabrir",
      "fechar",
    ]);
    expect(acoesPermitidas(chamado({ status: "fechado" }), false, true)).toEqual([]);
  });
  it("área inferior da conversa por status", () => {
    expect(estadoCompositor({ status: "aberto" }, true)).toBe("livre");
    expect(estadoCompositor({ status: "aguardando_participante" }, true)).toBe("livre");
    expect(estadoCompositor({ status: "resolvido" }, true)).toBe("resolvido");
    expect(estadoCompositor({ status: "resolvido" }, false)).toBe("livre");
    expect(estadoCompositor({ status: "fechado" }, true)).toBe("fechado");
  });
  it("responsável é o último evento de atribuição", () => {
    const c = chamado({
      mensagens: [
        {
          id: "1",
          autorId: "a",
          corpo: "",
          criadoEm: "x",
          tipo: "sistema",
          acao: { tipo: "responsavel", valor: "a" },
        },
        {
          id: "2",
          autorId: "a",
          corpo: "",
          criadoEm: "y",
          tipo: "sistema",
          acao: { tipo: "responsavel", valor: "b" },
        },
      ],
    });
    expect(responsavelId(c)).toBe("b");
    expect(protocolo(c)).toBe("SUP-20261013-123DEF");
  });
});

describe("leitura persistida no servidor", () => {
  it("marca avança, nunca retrocede, e fica no cadastro do usuário", () => {
    const usuario = u("p1", "participante");
    registrarLeitura(usuario, "cha-1", "2026-10-13T10:00:00Z");
    registrarLeitura(usuario, "cha-1", "2026-10-13T09:00:00Z"); // mais antiga: ignora
    registrarLeitura(usuario, "cha-1", "2026-10-13T11:00:00Z");
    expect(lidoAteSuporte(usuario, "cha-1")).toBe("2026-10-13T11:00:00Z");
    expect(lidoAteSuporte(usuario, "cha-2")).toBeUndefined();
  });
  it("preserva as preferências de silêncio ao gravar leituras", () => {
    const usuario = u("p1", "participante");
    usuario.silencioNotificacoes = { todas: true };
    registrarLeitura(usuario, "cha-1", "2026-10-13T10:00:00Z");
    expect(usuario.silencioNotificacoes?.todas).toBe(true);
    expect(lidoAteSuporte(usuario, "cha-1")).toBe("2026-10-13T10:00:00Z");
  });
  it("limita o histórico de leituras", () => {
    const usuario = u("p1", "participante");
    for (let i = 0; i < 250; i++)
      registrarLeitura(usuario, `cha-${i}`, `2026-10-13T10:${String(i % 60).padStart(2, "0")}:00Z`);
    expect(Object.keys(usuario.silencioNotificacoes?.leiturasSuporte ?? {}).length).toBe(200);
  });
});
