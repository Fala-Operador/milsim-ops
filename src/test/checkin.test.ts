import { describe, expect, it } from "vitest";
import { entradaAtiva, lerConteudoQr, resolverSincronizacao, validarIngresso, type IngressoCredenciamento, type RegistroCheckin } from "@/lib/checkin";

const ing = (o: Partial<IngressoCredenciamento> = {}): IngressoCredenciamento => ({ inscricaoId: "i1", eventoId: "e1", token: "TABCDEFGHJKLMNPQRST", codigo: "OP-AAAAA", nome: "Fulano", tipo: "Padrão", exercito: "Azul", status: "confirmada", ...o });
const reg = (o: Partial<RegistroCheckin> = {}): RegistroCheckin => ({ id: "r1", eventoId: "e1", inscricaoId: "i1", tipo: "entrada", origem: "qr", operadorId: "u", operadorNome: "Op", dispositivoId: "d", em: "2026-10-12T10:00:00Z", sync: "sincronizado", ...o });

describe("check-in", () => {
  it("ingresso válido sem entrada anterior é aceito", () => expect(validarIngresso({ eventoId: "e1", ingresso: ing(), registros: [] }).tipo).toBe("valido"));
  it("segunda leitura informa check-in já realizado com horário", () => {
    const r = validarIngresso({ eventoId: "e1", ingresso: ing(), registros: [reg()] });
    expect(r).toMatchObject({ tipo: "ja_realizado", em: "2026-10-12T10:00:00Z" });
  });
  it("ingresso cancelado ou estornado é recusado", () => {
    expect(validarIngresso({ eventoId: "e1", ingresso: ing({ status: "cancelada" }), registros: [] }).tipo).toBe("cancelado");
    expect(validarIngresso({ eventoId: "e1", ingresso: ing({ status: "estornada" }), registros: [] }).tipo).toBe("cancelado");
  });
  it("token de outro evento é identificado", () => expect(validarIngresso({ eventoId: "e1", ingresso: undefined, outroEvento: true, registros: [] }).tipo).toBe("outro_evento"));
  it("código desconhecido não é encontrado", () => expect(validarIngresso({ eventoId: "e1", ingresso: undefined, registros: [] }).tipo).toBe("nao_encontrado"));
  it("reversão libera nova entrada e preserva o original", () => {
    const regs = [reg(), reg({ id: "r2", tipo: "reversao", revertidoId: "r1" })];
    expect(entradaAtiva(regs, "i1")).toBeUndefined();
    expect(regs).toHaveLength(2);
  });
  it("QR só aceita o identificador opaco", () => {
    expect(lerConteudoQr("MSO-CHECKIN:TABCDEFGHJKLMNPQRST")).toBe("TABCDEFGHJKLMNPQRST");
    expect(lerConteudoQr("123.456.789-00")).toBeNull();
  });
  it("sincronização é idempotente e sinaliza conflito de entrada dupla", () => {
    expect(resolverSincronizacao([reg()], reg(), "confirmada").status).toBe("sincronizado");
    expect(resolverSincronizacao([reg()], reg({ id: "r9" }), "confirmada").status).toBe("conflito");
    expect(resolverSincronizacao([], reg({ id: "r9" }), "cancelada").status).toBe("conflito");
  });
});
