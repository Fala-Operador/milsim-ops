// Contato do evento no WhatsApp: normalização, validação no editor e no servidor, e quem
// recebe o link do grupo na visão (só inscritos confirmados e quem gere o evento).
import { describe, it, expect, beforeEach } from "vitest";
import { restaurarBase } from "@/test/baseTeste";
import {
  errosContatoEvento,
  formatarContatoWhatsapp,
  linkContatoEvento,
  normalizarContatoWhatsapp,
  normalizarGrupoWhatsapp,
} from "@/lib/contatoEvento";
import { validarEtapa } from "@/lib/eventoEditor";
import { salvarEvento } from "@/services/organizador";
import { visaoParaUsuario } from "@/lib/visao";
import type { BaseDados, Inscricao, Usuario } from "@/lib/domain/types";

const GRUPO = "https://chat.whatsapp.com/AbCdEf123456GhIj";
let base: BaseDados;
const usuario = (id: string) => base.usuarios.find((u) => u.id === id)!;

describe("normalização", () => {
  it("aceita convites de grupo e descarta o resto", () => {
    expect(normalizarGrupoWhatsapp(GRUPO)).toBe(GRUPO);
    expect(normalizarGrupoWhatsapp("chat.whatsapp.com/AbCdEf123456GhIj?mode=ac_t")).toBe(GRUPO);
    expect(normalizarGrupoWhatsapp("https://chat.whatsapp.com/invite/AbCdEf123456GhIj")).toBe(GRUPO);
    expect(normalizarGrupoWhatsapp("https://evil.com/chat.whatsapp.com/AbCdEf123456GhIj")).toBeNull();
    expect(normalizarGrupoWhatsapp("https://chat.whatsapp.com.evil.com/AbCdEf123456")).toBeNull();
    expect(normalizarGrupoWhatsapp("javascript:alert(1)")).toBeNull();
    expect(normalizarGrupoWhatsapp("https://wa.me/5511999999999")).toBeNull();
  });

  it("normaliza o número com DDI e formata para exibir", () => {
    expect(normalizarContatoWhatsapp("(11) 99999-0000")).toBe("5511999990000");
    expect(normalizarContatoWhatsapp("+55 11 3333-4444")).toBe("551133334444");
    expect(normalizarContatoWhatsapp("+351 912 345 678")).toBe("351912345678");
    expect(normalizarContatoWhatsapp("123")).toBeNull();
    expect(normalizarContatoWhatsapp("55 11 9999")).toBeNull();
    expect(formatarContatoWhatsapp("5511999990000")).toBe("(11) 99999-0000");
    expect(linkContatoEvento({ nome: "Op X", whatsappContato: "5511999990000" })).toMatch(/^https:\/\/wa\.me\/5511999990000\?text=/);
    expect(linkContatoEvento({ nome: "Op X", whatsappContato: undefined })).toBeNull();
  });

  it("campos vazios são opcionais; inválidos apontam o campo do editor", () => {
    expect(errosContatoEvento({ whatsappContato: undefined, whatsappGrupoUrl: undefined })).toEqual([]);
    expect(errosContatoEvento({ whatsappContato: "12", whatsappGrupoUrl: "https://x.com" }).map((e) => e.campo)).toEqual(["ev-whats", "ev-grupo"]);
  });
});

describe("editor e servidor", () => {
  beforeEach(() => { base = restaurarBase(); });

  it("a etapa geral do editor acusa link de grupo inválido", () => {
    const ev = { ...structuredClone(base.eventos[0]!), whatsappGrupoUrl: "https://meusite.com/grupo" };
    expect(validarEtapa(ev, 0).some((p) => p.campo === "ev-grupo")).toBe(true);
  });

  it("o servidor recusa link fora do WhatsApp e grava os campos normalizados", async () => {
    const org = usuario("usr-organizador");
    const ev = structuredClone(base.eventos.find((e) => e.organizacaoId === org.organizacaoId)!);
    await expect(salvarEvento({ ...ev, whatsappGrupoUrl: "https://phishing.example/x" }, org.id, org.perfil)).rejects.toThrow(/chat\.whatsapp\.com/);
    const salvo = await salvarEvento({ ...ev, whatsappContato: "(11) 98888-7777", whatsappGrupoUrl: `${GRUPO}?utm=1` }, org.id, org.perfil);
    expect(salvo.whatsappContato).toBe("5511988887777");
    expect(salvo.whatsappGrupoUrl).toBe(GRUPO);
  });
});

describe("visão: quem recebe o link do grupo", () => {
  let eventoId: string;
  const inscrever = (u: Usuario, status: Inscricao["status"]) =>
    base.inscricoes.push({
      id: `ins-teste-${u.id}-${status}`, eventoId, usuarioId: u.id, tipoId: "t", exercitoId: "x", codigo: "OP-T",
      status, origem: "plataforma", valorCentavos: 0, descontoCentavos: 0, criadoEm: new Date().toISOString(),
    });
  const grupoNaVisao = (u: Usuario | null) => visaoParaUsuario(base, u).eventos.find((e) => e.id === eventoId)?.whatsappGrupoUrl;

  beforeEach(() => {
    base = restaurarBase();
    const ev = base.eventos.find((e) => e.status === "publicado")!;
    eventoId = ev.id;
    ev.whatsappGrupoUrl = GRUPO;
    ev.whatsappContato = "5511988887777";
    // Ninguém começa inscrito neste evento.
    base.inscricoes = base.inscricoes.filter((i) => i.eventoId !== eventoId);
  });

  it("visitante e participante sem inscrição não recebem o link, mas veem o número", () => {
    expect(grupoNaVisao(null)).toBeUndefined();
    expect(grupoNaVisao(usuario("usr-participante"))).toBeUndefined();
    expect(visaoParaUsuario(base, null).eventos.find((e) => e.id === eventoId)?.whatsappContato).toBe("5511988887777");
    expect(JSON.stringify(visaoParaUsuario(base, null))).not.toContain("AbCdEf123456GhIj");
  });

  it("reserva pendente ou inscrição cancelada não liberam o link", () => {
    const p = usuario("usr-participante");
    inscrever(p, "pendente");
    expect(grupoNaVisao(p)).toBeUndefined();
    inscrever(p, "cancelada");
    expect(grupoNaVisao(p)).toBeUndefined();
  });

  it("inscrito confirmado, organização do evento e admin recebem o link", () => {
    const p = usuario("usr-participante");
    inscrever(p, "confirmada");
    expect(grupoNaVisao(p)).toBe(GRUPO);
    const dono = base.usuarios.find((u) => u.perfil === "organizador" && u.organizacaoId === base.eventos.find((e) => e.id === eventoId)!.organizacaoId)!;
    expect(grupoNaVisao(dono)).toBe(GRUPO);
    expect(grupoNaVisao(base.usuarios.find((u) => u.perfil === "admin")!)).toBe(GRUPO);
  });
});
