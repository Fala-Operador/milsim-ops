// Missões pré-evento: placar por média com metas coletivas, envio (público, prazos, código
// secreto, reenvio), avaliação, destaque com consentimento, encerramento com prêmios, visão,
// temporada e o critério de insígnia "missões concluídas".
import { describe, it, expect, beforeEach } from "vitest";
import { restaurarBase } from "@/test/baseTeste";
import * as s from "@/services/missoes";
import { placarExercitos, congelarResultado, normalizarCodigo, rankingIndividual, temporada, premioDoExercito } from "@/lib/missoes";
import { recalcularProgressao } from "@/services/progressao";
import { visaoParaUsuario } from "@/lib/visao";
import type { BaseDados, Evento, Inscricao, Usuario } from "@/lib/domain/types";

let base: BaseDados;
const EVT = "evt-teste-missoes";
const dia = 86400000;
const iso = (d: number) => new Date(Date.now() + d).toISOString();
const u = (id: string) => base.usuarios.find((x) => x.id === id)!;
let org: Usuario;
let A1: Usuario, A2: Usuario, B1: Usuario;

function pessoa(id: string): Usuario {
  const p = structuredClone(base.usuarios.find((x) => x.id === "usr-participante")!);
  const nova = { ...p, id, email: `${id}@exemplo.com`, cpf: id, nomeExibicao: id.toUpperCase() };
  base.usuarios.push(nova);
  return nova;
}
function inscrever(usuarioId: string, exercitoId: string): Inscricao {
  const i = { id: `ins-${usuarioId}`, eventoId: EVT, usuarioId, tipoId: "tp", exercitoId, codigo: "OP", status: "confirmada", origem: "plataforma", valorCentavos: 0, descontoCentavos: 0, criadoEm: iso(-dia) } as Inscricao;
  base.inscricoes.push(i);
  return i;
}
const missao = (extra: Partial<s.DadosMissao> = {}) => {
  const m = s.salvarMissao(base, org, {
    eventoId: EVT, titulo: "Foto do squad", descricao: "Mande a foto com o patch.", publico: "todos", tipoEntrega: "confirmacao",
    pontos: 10, prazo: iso(5 * dia), exigeAprovacao: false, ...extra,
  });
  s.publicarMissao(base, org, m.id);
  return m;
};

beforeEach(() => {
  base = restaurarBase();
  org = base.usuarios.find((x) => x.perfil === "organizador" && x.organizacaoId)!;
  base.eventos.push({
    ...structuredClone(base.eventos[0]!), id: EVT, organizacaoId: org.organizacaoId!, status: "publicado",
    inicioEm: iso(10 * dia), fimEm: iso(11 * dia),
    exercitos: [{ id: "ex-a", nome: "Alfa", capacidade: 50 }, { id: "ex-b", nome: "Bravo", capacidade: 50 }],
  } as Evento);
  A1 = pessoa("a1"); A2 = pessoa("a2"); B1 = pessoa("b1");
  inscrever("a1", "ex-a"); inscrever("a2", "ex-a"); inscrever("b1", "ex-b");
});

describe("placar", () => {
  it("é por média: o exército menor pode vencer o maior", () => {
    const m = missao({ pontos: 10 });
    const m2 = missao({ titulo: "Segunda missão", pontos: 15 });
    s.enviarEntrega(base, A1, { missaoId: m.id });
    s.enviarEntrega(base, A2, { missaoId: m.id });
    s.enviarEntrega(base, B1, { missaoId: m2.id });
    const ev = base.eventos.find((e) => e.id === EVT)!;
    const p = placarExercitos(base, ev);
    expect(p.map((l) => [l.nome, l.pontos, l.media])).toEqual([["Bravo", 15, 15], ["Alfa", 20, 10]]);
  });

  it("meta coletiva soma o bônus quando o percentual de inscritos conclui", () => {
    const m = missao({ pontos: 0, metaPercentual: 50, metaBonus: 7 });
    s.enviarEntrega(base, A1, { missaoId: m.id });
    const p = placarExercitos(base, base.eventos.find((e) => e.id === EVT)!);
    const alfa = p.find((l) => l.nome === "Alfa")!;
    expect(alfa).toMatchObject({ bonus: 7, total: 7, metas: ["Foto do squad"] });
    expect(p.find((l) => l.nome === "Bravo")!.bonus).toBe(0);
  });

  it("empate divide a colocação e os prêmios vão por colocação", () => {
    const r = congelarResultado(
      [{ exercitoId: "a", nome: "A", pontos: 10, inscritos: 1, media: 10, bonus: 0, total: 10, metas: [] },
       { exercitoId: "b", nome: "B", pontos: 10, inscritos: 1, media: 10, bonus: 0, total: 10, metas: [] },
       { exercitoId: "c", nome: "C", pontos: 5, inscritos: 1, media: 5, bonus: 0, total: 5, metas: [] }],
      [{ colocacao: 1, descricao: "Base norte" }, { colocacao: 3, descricao: "Briefing primeiro" }],
    );
    expect(r.map((x) => [x.exercitoId, x.colocacao, x.premio])).toEqual([["a", 1, "Base norte"], ["b", 1, "Base norte"], ["c", 3, "Briefing primeiro"]]);
  });

  it("os pontos ficam com o exército de quem enviou, mesmo se a pessoa trocar depois", () => {
    const m = missao();
    s.enviarEntrega(base, A1, { missaoId: m.id });
    base.inscricoes.find((i) => i.usuarioId === "a1")!.exercitoId = "ex-b";
    const p = placarExercitos(base, base.eventos.find((e) => e.id === EVT)!);
    expect(p.find((l) => l.nome === "Alfa")!.pontos).toBe(10);
    expect(p.find((l) => l.nome === "Bravo")!.pontos).toBe(0);
  });
});

describe("envio", () => {
  it("respeita o público, o rascunho, a abertura e o prazo", () => {
    const soAlfa = missao({ publico: "ex-a" });
    expect(() => s.enviarEntrega(base, B1, { missaoId: soAlfa.id })).toThrow(/não é destinada/);
    const rascunho = s.salvarMissao(base, org, { eventoId: EVT, titulo: "Rascunho", descricao: "x", publico: "todos", tipoEntrega: "confirmacao", pontos: 1, prazo: iso(dia), exigeAprovacao: false });
    expect(() => s.enviarEntrega(base, A1, { missaoId: rascunho.id })).toThrow(/não é destinada/);
    const futura = missao({ titulo: "Futura", abreEm: iso(dia), prazo: iso(2 * dia) });
    expect(() => s.enviarEntrega(base, A1, { missaoId: futura.id })).toThrow(/ainda não abriu/);
    const m = missao({ titulo: "Vencida" });
    base.missoes.find((x) => x.id === m.id)!.prazo = iso(-1000);
    expect(() => s.enviarEntrega(base, A1, { missaoId: m.id })).toThrow(/prazo/);
  });

  it("código secreto: normaliza, aprova na hora e recusa tentativa errada", () => {
    const m = missao({ tipoEntrega: "codigo", codigoResposta: "  Tempestade  Árabe ", pontos: 20, exigeAprovacao: true });
    expect(base.missoes.find((x) => x.id === m.id)!.codigoResposta).toBe(normalizarCodigo("tempestade arabe"));
    expect(() => s.enviarEntrega(base, A1, { missaoId: m.id, codigo: "errado" })).toThrow(/incorreto/);
    const e = s.enviarEntrega(base, A1, { missaoId: m.id, codigo: "TEMPESTADE arabe" });
    expect(e).toMatchObject({ status: "concluida", pontos: 20, exercitoId: "ex-a" });
    expect(() => s.enviarEntrega(base, A1, { missaoId: m.id, codigo: "tempestade arabe" })).toThrow(/já concluiu/);
  });

  it("foto é obrigatória em missão de imagem; com aprovação fica em análise", () => {
    const m = missao({ tipoEntrega: "imagem", exigeAprovacao: true });
    expect(() => s.enviarEntrega(base, A1, { missaoId: m.id })).toThrow(/foto/i);
    const e = s.enviarEntrega(base, A1, { missaoId: m.id, foto: "data:image/jpeg;base64,/9j/4AAQ", permiteDestaque: true });
    expect(e).toMatchObject({ status: "enviada", anexoUrl: "data:image/jpeg;base64,/9j/4AAQ", permiteDestaque: true });
    expect(() => s.enviarEntrega(base, A1, { missaoId: m.id, foto: "data:image/jpeg;base64,/9j/4AAQ" })).toThrow(/em análise/);
  });
});

describe("avaliação, destaque e encerramento", () => {
  it("só a gestão avalia; ajustes pedem comentário e liberam reenvio; aprovar dá os pontos", () => {
    const m = missao({ tipoEntrega: "texto", exigeAprovacao: true, pontos: 12 });
    const e = s.enviarEntrega(base, A1, { missaoId: m.id, texto: "https://instagram.com/p/x" });
    expect(() => s.avaliarEntrega(base, B1, e.id, "aprovar")).toThrow(/organização/);
    expect(() => s.avaliarEntrega(base, org, e.id, "ajustes")).toThrow(/motivo/);
    s.avaliarEntrega(base, org, e.id, "ajustes", "Link sem acesso público.");
    s.enviarEntrega(base, A1, { missaoId: m.id, texto: "https://instagram.com/p/y" });
    s.avaliarEntrega(base, org, e.id, "aprovar");
    expect(base.entregas.find((x) => x.id === e.id)).toMatchObject({ status: "concluida", pontos: 12, avaliadoPor: org.id });
    expect(base.notificacoes.some((n) => n.usuarioId === "a1" && n.titulo === "Missão aprovada")).toBe(true);
  });

  it("destaque exige autorização do participante e publica nos avisos (uma vez)", () => {
    const m = missao({ tipoEntrega: "imagem" });
    const sem = s.enviarEntrega(base, A1, { missaoId: m.id, foto: "data:image/png;base64,iVBORw0KGgo=" });
    expect(() => s.destacarEntrega(base, org, sem.id)).toThrow(/não autorizou/);
    const com = s.enviarEntrega(base, A2, { missaoId: m.id, foto: "data:image/png;base64,iVBORw0KGgo=", permiteDestaque: true });
    const antes = base.publicacoes.length;
    s.destacarEntrega(base, org, com.id);
    s.destacarEntrega(base, org, com.id);
    expect(base.publicacoes.length).toBe(antes + 1);
    expect(base.publicacoes.at(-1)!.forumId).toBe(`for-${EVT}-avisos`);
  });

  it("encerrar exige avaliar pendências, congela o placar, aplica prêmios e trava tudo", () => {
    const m = missao({ tipoEntrega: "texto", exigeAprovacao: true });
    const e = s.enviarEntrega(base, A1, { missaoId: m.id, texto: "feito" });
    s.salvarPremios(base, org, EVT, [{ colocacao: 1, descricao: "Começa com a base norte" }]);
    expect(() => s.encerrarCampanha(base, org, EVT)).toThrow(/em análise/);
    s.avaliarEntrega(base, org, e.id, "aprovar");
    const c = s.encerrarCampanha(base, org, EVT);
    expect(c.encerradaEm).toBeTruthy();
    expect(c.resultado[0]).toMatchObject({ exercitoId: "ex-a", colocacao: 1, premio: "Começa com a base norte" });
    expect(premioDoExercito(c, "ex-a")?.premio).toBe("Começa com a base norte");
    expect(() => s.enviarEntrega(base, A2, { missaoId: m.id, texto: "tarde" })).toThrow(/encerrada/);
    expect(() => s.salvarMissao(base, org, { eventoId: EVT, titulo: "Nova", descricao: "x", publico: "todos", tipoEntrega: "confirmacao", pontos: 1, prazo: iso(dia), exigeAprovacao: false })).toThrow(/encerrada/);
    expect(base.publicacoes.some((p) => p.texto.includes("Resultado das missões"))).toBe(true);
  });
});

describe("visão", () => {
  it("participante não recebe o código, rascunhos nem missões de outro exército", () => {
    missao({ tipoEntrega: "codigo", codigoResposta: "segredo" });
    missao({ titulo: "Só Bravo", publico: "ex-b" });
    s.salvarMissao(base, org, { eventoId: EVT, titulo: "Rascunho", descricao: "x", publico: "todos", tipoEntrega: "confirmacao", pontos: 1, prazo: iso(dia), exigeAprovacao: false });
    const v = visaoParaUsuario(base, u("a1"));
    const doEvento = v.missoes.filter((m) => m.eventoId === EVT);
    expect(doEvento.map((m) => m.titulo)).toEqual(["Foto do squad"]);
    expect(JSON.stringify(v.missoes)).not.toContain("segredo");
    const g = visaoParaUsuario(base, org).missoes.filter((m) => m.eventoId === EVT);
    expect(g).toHaveLength(3);
    expect(g.some((m) => m.codigoResposta === "segredo")).toBe(true);
  });
});

describe("temporada e insígnia", () => {
  it("temporada soma os pontos dos eventos da organização no ano", () => {
    const m = missao({ pontos: 30 });
    s.enviarEntrega(base, A1, { missaoId: m.id });
    const ano = new Date(base.eventos.find((e) => e.id === EVT)!.inicioEm).getFullYear();
    const t = temporada(base, org.organizacaoId!, ano);
    expect(t.find((l) => l.usuarioId === "a1")).toMatchObject({ pontos: 30, missoes: 1 });
    expect(rankingIndividual(base.entregas)[0]!.usuarioId).toBe("a1");
  });

  it("critério \"missoes\" concede a insígnia ao atingir a meta", () => {
    base.insignias.push({ id: "ins-missoes-2", nome: "Batedor", descricao: "Duas missões", icone: "🎯", criterio: { tipo: "missoes", meta: 2 }, ativa: true, versao: 1, criadoEm: iso(-dia), atualizadoEm: iso(-dia) } as BaseDados["insignias"][number]);
    s.enviarEntrega(base, A1, { missaoId: missao().id });
    recalcularProgressao(base);
    expect(base.concessoesInsignia.some((c) => c.usuarioId === "a1" && c.insigniaId === "ins-missoes-2")).toBe(false);
    s.enviarEntrega(base, A1, { missaoId: missao({ titulo: "Outra" }).id });
    recalcularProgressao(base);
    expect(base.concessoesInsignia.some((c) => c.usuarioId === "a1" && c.insigniaId === "ins-missoes-2")).toBe(true);
  });
});
