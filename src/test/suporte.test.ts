import { describe, expect, it } from "vitest";
import { podeVer, podeAtender, statusAposMensagem, transicao, responsavelId, protocolo } from "@/lib/suporte";
import type { BaseDados, Chamado, Usuario } from "@/lib/domain/types";

const u = (id: string, perfil: Usuario["perfil"], organizacaoId?: string) => ({ id, perfil, organizacaoId, ativo: true }) as Usuario;
const base = {
  eventos: [{ id: "ev1", organizacaoId: "org1" }],
  usuarios: [],
} as unknown as BaseDados;
const chamado = (p: Partial<Chamado> = {}): Chamado => ({
  id: "cha-abc123def", solicitanteId: "p1", assunto: "A", categoria: "Outro", descricao: "d", status: "aberto",
  mensagens: [], criadoEm: "2026-10-13T10:00:00Z", atualizadoEm: "2026-10-13T10:00:00Z", ...p,
});

describe("acesso ao suporte", () => {
  it("chamado da plataforma: só solicitante e admin", () => {
    const c = chamado();
    expect(podeVer(base, u("p1", "participante"), c)).toBe(true);
    expect(podeVer(base, u("adm", "admin"), c)).toBe(true);
    expect(podeVer(base, u("org", "organizador", "org1"), c)).toBe(false);
    expect(podeVer(base, u("p2", "participante"), c)).toBe(false);
  });
  it("chamado de evento: organizador do evento atende, de outra organização não", () => {
    const c = chamado({ eventoId: "ev1" });
    expect(podeAtender(base, u("org", "organizador", "org1"), c)).toBe(true);
    expect(podeAtender(base, u("org2", "organizador", "org2"), c)).toBe(false);
  });
});

describe("status do chamado", () => {
  it("resposta do participante em 'aguardando' volta para em atendimento", () => {
    expect(statusAposMensagem(chamado({ status: "aguardando_participante" }), true)).toBe("em_atendimento");
  });
  it("fechado é somente leitura", () => {
    expect(() => statusAposMensagem(chamado({ status: "fechado" }), true)).toThrow(/somente leitura/);
    expect(() => transicao(chamado({ status: "fechado" }), "reabrir", false, true)).toThrow();
  });
  it("só resolvido pode ser reaberto pelo participante", () => {
    expect(transicao(chamado({ status: "resolvido" }), "reabrir", false, true)).toBe("aberto");
    expect(() => transicao(chamado({ status: "em_atendimento" }), "reabrir", false, true)).toThrow();
  });
  it("participante não resolve", () => {
    expect(() => transicao(chamado(), "resolver", false, true)).toThrow();
  });
  it("responsável é o último evento de atribuição", () => {
    const c = chamado({ mensagens: [
      { id: "1", autorId: "a", corpo: "", criadoEm: "x", tipo: "sistema", acao: { tipo: "responsavel", valor: "a" } },
      { id: "2", autorId: "a", corpo: "", criadoEm: "y", tipo: "sistema", acao: { tipo: "responsavel", valor: "b" } },
    ] });
    expect(responsavelId(c)).toBe("b");
    expect(protocolo(c)).toBe("SUP-20261013-123DEF");
  });
});
