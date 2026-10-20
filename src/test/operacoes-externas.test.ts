// Operações fora da plataforma: validação, privacidade no perfil, total de estados e a regra
// central — elas nunca contam para insígnias, recompensas ou participação.
import { describe, it, expect, beforeEach } from "vitest";
import { restaurarBase } from "@/test/baseTeste";
import { excluirOperacaoExterna, salvarOperacaoExterna, validarOperacaoExterna, type DadosOperacaoExterna } from "@/services/perfilOperador";
import { recalcularProgressao } from "@/services/progressao";
import { participacoesDoUsuario } from "@/lib/participacao";
import { montarPerfil } from "@/lib/perfilSocial";
import { visaoParaUsuario } from "@/lib/visao";
import type { BaseDados, Usuario } from "@/lib/domain/types";

let base: BaseDados;
const PART = "usr-participante";
const u = (id: string) => base.usuarios.find((x) => x.id === id)!;
const FOTO = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQ==";
const dados = (extra: Partial<DadosOperacaoExterna> = {}): DadosOperacaoExterna => ({
  nome: "Operação Caatinga", data: "2025-08-10", cidade: "Petrolina", uf: "PE", organizacao: "Grupo Sertão",
  modalidade: "milsim", foto: FOTO, fotoAlt: "Equipe no campo", visivel: true, ...extra,
});
const outro = (): Usuario => base.usuarios.find((x) => x.id !== PART && x.ativo)!;

beforeEach(() => {
  base = restaurarBase();
});

describe("validação", () => {
  const hoje = new Date("2026-10-19T12:00:00Z");
  it("aceita uma operação completa e normaliza a UF", () => {
    const v = validarOperacaoExterna(dados({ uf: "pe" }), undefined, hoje);
    expect(v).toMatchObject({ nome: "Operação Caatinga", uf: "PE", fotoUrl: FOTO, modalidade: "milsim" });
  });
  it("foto é obrigatória e precisa ser imagem válida", () => {
    expect(() => validarOperacaoExterna(dados({ foto: "" }), undefined, hoje)).toThrow(/foto/i);
    expect(() => validarOperacaoExterna(dados({ foto: "data:application/pdf;base64,JVBER" }), undefined, hoje)).toThrow(/Formato/);
  });
  it("recusa data futura, UF inexistente, modalidade fora do catálogo e nome curto", () => {
    expect(() => validarOperacaoExterna(dados({ data: "2026-12-01" }), undefined, hoje)).toThrow(/já aconteceram/);
    expect(() => validarOperacaoExterna(dados({ uf: "XX" }), undefined, hoje)).toThrow(/estado/);
    expect(() => validarOperacaoExterna(dados({ modalidade: "paintball" }), undefined, hoje)).toThrow(/Modalidade/);
    expect(() => validarOperacaoExterna(dados({ nome: "A" }), undefined, hoje)).toThrow(/nome/i);
  });
  it("ao editar, pode manter a foto já salva (URL), sem reenviar", () => {
    const salva = "https://x.supabase.co/storage/v1/object/public/midia/2026-10/a.jpg";
    expect(validarOperacaoExterna(dados({ foto: salva }), salva, hoje).fotoUrl).toBe(salva);
    expect(() => validarOperacaoExterna(dados({ foto: salva }), undefined, hoje)).toThrow(/Formato/);
  });
});

describe("gravação", () => {
  it("cria, edita e exclui só na própria conta", () => {
    const op = salvarOperacaoExterna(base, u(PART), dados());
    expect(base.operacoesExternas).toHaveLength(1);
    salvarOperacaoExterna(base, u(PART), { ...dados({ nome: "Op. Caatinga II" }), id: op.id, foto: op.fotoUrl });
    expect(base.operacoesExternas[0]!.nome).toBe("Op. Caatinga II");
    expect(() => salvarOperacaoExterna(base, outro(), { ...dados(), id: op.id })).toThrow(/não encontrada/);
    expect(() => excluirOperacaoExterna(base, outro(), op.id)).toThrow(/não encontrada/);
    excluirOperacaoExterna(base, u(PART), op.id);
    expect(base.operacoesExternas).toHaveLength(0);
  });
});

describe("não contam para insígnias nem participação", () => {
  it("participações, concessões e vouchers ficam iguais com operações externas", () => {
    recalcularProgressao(base);
    const antes = {
      participacoes: participacoesDoUsuario(base, PART).length,
      concessoes: base.concessoesInsignia.filter((c) => c.usuarioId === PART).length,
      vouchers: base.vouchers.filter((v) => v.usuarioId === PART).length,
    };
    // Muitas operações em muitos estados: se contassem, liberariam insígnias de estados/operações.
    for (const [i, uf] of ["PE", "BA", "CE", "PB", "RN", "AL", "SE", "PI", "MA", "AM", "PA", "RS"].entries()) {
      salvarOperacaoExterna(base, u(PART), dados({ nome: `Operação externa ${i}`, uf, modalidade: i % 2 ? "sar" : "speedsoft" }));
    }
    recalcularProgressao(base);
    expect(participacoesDoUsuario(base, PART)).toHaveLength(antes.participacoes);
    expect(base.concessoesInsignia.filter((c) => c.usuarioId === PART)).toHaveLength(antes.concessoes);
    expect(base.vouchers.filter((v) => v.usuarioId === PART)).toHaveLength(antes.vouchers);
  });
});

describe("perfil e visão", () => {
  it("o dono vê todas; terceiros só as visíveis; visitante nenhuma", () => {
    salvarOperacaoExterna(base, u(PART), dados({ nome: "Pública" }));
    salvarOperacaoExterna(base, u(PART), dados({ nome: "Escondida", uf: "BA", visivel: false }));
    const p = base.perfisOperador.find((x) => x.usuarioId === PART);
    if (p) p.privacidade.mapa = "autenticados";
    else base.perfisOperador.push({ usuarioId: PART, privacidade: { historico: "autenticados", mapa: "autenticados", insignias: "autenticados", equipamentos: "eu", fotos: "eu" }, operacoesOcultas: [], introVista: true, atualizadoEm: new Date().toISOString() });

    expect(montarPerfil(base, PART, u(PART))!.externas!.map((o) => o.nome).sort()).toEqual(["Escondida", "Pública"]);
    expect(montarPerfil(base, PART, outro())!.externas!.map((o) => o.nome)).toEqual(["Pública"]);
    expect(montarPerfil(base, PART, null)!.externas).toBeUndefined();
  });

  it("com o mapa privado, terceiros não recebem as operações externas", () => {
    salvarOperacaoExterna(base, u(PART), dados());
    const p = base.perfisOperador.find((x) => x.usuarioId === PART);
    if (p) p.privacidade.mapa = "eu";
    expect(montarPerfil(base, PART, outro())!.externas).toBeUndefined();
  });

  it("estadosTotal soma estados da plataforma e externos; estados (base das insígnias) não muda", () => {
    const antes = montarPerfil(base, PART, u(PART))!.resumo;
    salvarOperacaoExterna(base, u(PART), dados({ uf: "AC" }));
    const depois = montarPerfil(base, PART, u(PART))!.resumo;
    expect(depois.estados).toBe(antes.estados);
    expect(depois.estadosTotal).toBe((antes.estadosTotal ?? antes.estados ?? 0) + 1);
  });

  it("a visão entrega a coleção só para o dono", () => {
    salvarOperacaoExterna(base, u(PART), dados());
    expect(visaoParaUsuario(base, u(PART)).operacoesExternas).toHaveLength(1);
    expect(visaoParaUsuario(base, outro()).operacoesExternas).toHaveLength(0);
    expect(visaoParaUsuario(base, null).operacoesExternas).toHaveLength(0);
  });
});

describe("formatarDataBR", () => {
  it("data sem horário não volta um dia no fuso do Brasil", async () => {
    const { formatarDataBR } = await import("@/lib/domain/money");
    expect(formatarDataBR("2024-05-18")).toBe("18/05/2024");
    expect(formatarDataBR("2027-01-01")).toBe("01/01/2027");
  });
});
