// Comunidade geral, fases 2 e 3: regras de fórum e o que entra na lateral da comunidade.
import { beforeEach, describe, expect, it } from "vitest";
import { restaurarBase } from "./baseTeste";
import { POSICAO_COMUNIDADE, POSICAO_LISTAGEM, type BaseDados, type Impulsionamento, type SecaoInicial } from "@/lib/domain/types";
import { erroForum, erroFotoForum, moderaForum, podeRemoverMembro, situacaoAoEntrar } from "@/lib/comunidadeGeral";
import { lateralDaComunidade, NACIONAL } from "@/lib/divulgacao";
import { pendenciasAtivacao, rotuloPosicao } from "@/lib/impulsionamento";
import { posicoesDoImpulso } from "@/lib/impulsos";

describe("fóruns", () => {
  it("nome de 3 a 60 caracteres, descrição até 300, visibilidade válida e moderação de texto", () => {
    expect(erroForum("Time Alfa SP", "Treinos e jogos do time", "publico")).toBe("");
    expect(erroForum("ab", undefined, "publico")).toMatch(/pelo menos 3/);
    expect(erroForum("x".repeat(61), undefined, "privado")).toMatch(/até 60/);
    expect(erroForum("Time", "x".repeat(301), "publico")).toMatch(/até 300/);
    expect(erroForum("Time", undefined, "secreto")).toMatch(/público ou privado/);
    expect(erroForum("Venda de maconha", undefined, "publico")).toMatch(/drogas/);
  });

  it("foto do fórum: JPG, PNG ou WebP de até 5 MB", () => {
    expect(erroFotoForum("data:image/jpeg;base64,/9j/4AAQ")).toBe("");
    expect(erroFotoForum("data:image/gif;base64,R0lGOD")).toMatch(/Formato/);
    expect(erroFotoForum(`data:image/png;base64,${"A".repeat(7_000_000)}`)).toMatch(/5 MB/);
  });

  it("público entra na hora; privado vira pedido", () => {
    expect(situacaoAoEntrar("publico")).toBe("aprovado");
    expect(situacaoAoEntrar("privado")).toBe("pendente");
  });

  it("modera: dono e moderador aprovados; membro e pendente não", () => {
    expect(moderaForum("dono", "aprovado")).toBe(true);
    expect(moderaForum("moderador", "aprovado")).toBe(true);
    expect(moderaForum("membro", "aprovado")).toBe(false);
    expect(moderaForum("moderador", "pendente")).toBe(false);
    expect(moderaForum(undefined, undefined)).toBe(false);
  });

  it("remover: dono remove moderador e membro; moderador só membro; ninguém remove o dono", () => {
    expect(podeRemoverMembro("dono", "moderador")).toBe(true);
    expect(podeRemoverMembro("dono", "membro")).toBe(true);
    expect(podeRemoverMembro("moderador", "membro")).toBe(true);
    expect(podeRemoverMembro("moderador", "moderador")).toBe(false);
    expect(podeRemoverMembro("dono", "dono")).toBe(false);
    expect(podeRemoverMembro("membro", "membro")).toBe(false);
  });
});

describe("lateral da comunidade", () => {
  let base: BaseDados;
  const agora = new Date();
  const dia = 86_400_000;

  function campanha(p: Partial<Impulsionamento> = {}): Impulsionamento {
    const e = base.eventos.find((x) => x.status === "publicado" && new Date(x.fimEm) > agora)!;
    return {
      id: `imp-${Math.random()}`, eventoId: e.id, nome: "Teste", objetivo: "divulgacao", posicoes: [POSICAO_COMUNIDADE],
      abrangencia: NACIONAL, inicioEm: new Date(agora.getTime() - dia).toISOString(),
      fimEm: new Date(Math.min(agora.getTime() + 2 * dia, new Date(e.fimEm).getTime() - 1000)).toISOString(),
      fuso: "America/Sao_Paulo", prioridade: "normal", ordem: 0, status: "ativo", criadoPor: "adm",
      criadoEm: agora.toISOString(), atualizadoEm: agora.toISOString(), ...p,
    };
  }
  function banner(p: Partial<SecaoInicial> = {}): SecaoInicial {
    return {
      id: `sec-${Math.random()}`, titulo: "Banner", tipo: "banner", abrangencia: NACIONAL, ordem: 0, status: "publicada", agendamento: {},
      layout: "banner", modo: "manual", destaques: [], mostrarEsgotados: true, parceiros: [], tamanhoLogo: "m", mostrarDescricoes: false,
      superficieLogo: "clara", banner: { textoAlt: "Promo", imagemCelular: "https://x/promo.jpg" }, naComunidade: true,
      criadoEm: agora.toISOString(), atualizadoEm: agora.toISOString(), ...p,
    };
  }

  beforeEach(() => {
    base = restaurarBase();
    base.impulsionamentos = [];
    base.secoesInicio = [];
  });

  it("banner só se publicado, marcado para a comunidade e no período", () => {
    base.secoesInicio = [
      banner({ id: "ok" }),
      banner({ id: "nao-marcado", naComunidade: undefined }),
      banner({ id: "rascunho", status: "rascunho" }),
      banner({ id: "futuro", agendamento: { inicioEm: new Date(agora.getTime() + dia).toISOString() } }),
    ];
    expect(lateralDaComunidade(base, NACIONAL, agora).banners.map((s) => s.id)).toEqual(["ok"]);
  });

  it("operações impulsionadas só da posição comunidade", () => {
    base.impulsionamentos = [campanha({ id: "na-comunidade" }), campanha({ id: "so-listagem", posicoes: [POSICAO_LISTAGEM] })];
    expect(lateralDaComunidade(base, NACIONAL, agora).operacoes.map((o) => o.campanhaId)).toEqual(["na-comunidade"]);
  });

  it("patrocinadores ativos e destacados pela administração", () => {
    const [p1, p2, p3] = base.parceiros.length >= 3 ? base.parceiros : [
      { ...base.parceiros[0]!, id: "p1" }, { ...base.parceiros[0]!, id: "p2" }, { ...base.parceiros[0]!, id: "p3" },
    ];
    base.parceiros = [
      { ...p1!, id: "p1", ativo: true, naComunidade: true },
      { ...p2!, id: "p2", ativo: true, naComunidade: undefined },
      { ...p3!, id: "p3", ativo: false, naComunidade: true },
    ];
    expect(lateralDaComunidade(base, NACIONAL, agora).patrocinadores.map((p) => p.id)).toEqual(["p1"]);
  });

  it("a posição comunidade é um local válido no admin e entra nos impulsos comprados", () => {
    expect(rotuloPosicao(base, POSICAO_COMUNIDADE)).toBe("Lateral da comunidade");
    const c = campanha();
    expect(pendenciasAtivacao(base, c, agora).some((m) => /local de divulgação/.test(m))).toBe(false);
    expect(posicoesDoImpulso(base)).toContain(POSICAO_COMUNIDADE);
  });
});
