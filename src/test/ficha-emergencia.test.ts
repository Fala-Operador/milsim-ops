// Ficha de emergência: dado de saúde. Titular sempre vê; gestão só com autorização, inscrição
// confirmada e na janela do evento (7 dias antes até o fim). Ninguém mais recebe pela visão.
import { describe, it, expect, beforeEach } from "vitest";
import { restaurarBase } from "@/test/baseTeste";
import { visaoParaUsuario } from "@/lib/visao";
import { erroFicha, eventoNaJanelaDaFicha, montarFicha, podeVerFicha } from "@/lib/fichaEmergencia";
import { salvarFichaEmergencia } from "@/services/conta";
import { validarCadastro, type DadosCadastro } from "@/services/auth";
import { ingressosDoEvento } from "@/services/checkin";
import type { BaseDados, Evento, Inscricao } from "@/lib/domain/types";

const AGORA = new Date("2026-11-10T12:00:00Z");
const DIA = 86_400_000;
const em = (dias: number) => new Date(AGORA.getTime() + dias * DIA).toISOString();
const EVT = "evt-ficha";

let base: BaseDados;
const u = (id: string) => base.usuarios.find((x) => x.id === id)!;

function evento(inicioDias: number, fimDias: number): Evento {
  return { ...structuredClone(base.eventos[0]!), id: EVT, organizacaoId: u("usr-organizador").organizacaoId!, inicioEm: em(inicioDias), fimEm: em(fimDias), status: "publicado" };
}
function inscrever(status: Inscricao["status"] = "confirmada") {
  base.inscricoes.push({ ...structuredClone(base.inscricoes[0]!), id: "ins-ficha", eventoId: EVT, usuarioId: "usr-participante", status });
}
function comFicha(compartilhar: boolean) {
  u("usr-participante").fichaEmergencia = montarFicha(
    { tipoSanguineo: "O-", alergias: "dipirona", contatoNome: "Maria", contatoTelefone: "(11) 98888-7777", compartilhar },
    undefined,
    AGORA,
  );
}
const fichaNaVisao = (quem: string | null) =>
  visaoParaUsuario(base, quem ? u(quem) : null, AGORA).usuarios.find((x) => x.id === "usr-participante")?.fichaEmergencia;

beforeEach(() => {
  base = restaurarBase();
  // Cenário isolado: o participante só tem a inscrição que cada teste criar.
  base.inscricoes = base.inscricoes.filter((i) => i.usuarioId !== "usr-participante");
});

describe("regras da ficha", () => {
  it("tudo opcional; contato precisa de nome e telefone juntos", () => {
    expect(erroFicha({ compartilhar: false })).toBe("");
    expect(erroFicha({ tipoSanguineo: "Z+", compartilhar: false })).toMatch(/Tipo sanguíneo inválido/);
    expect(erroFicha({ contatoNome: "Maria", compartilhar: false })).toMatch(/telefone/);
    expect(erroFicha({ contatoTelefone: "11988887777", compartilhar: false })).toMatch(/nome/);
    expect(erroFicha({ contatoNome: "Maria", contatoTelefone: "123", compartilhar: false })).toMatch(/inválido/);
  });

  it("autorização ganha data, mantém a data enquanto continua e perde ao retirar; vazio remove", () => {
    const f1 = montarFicha({ tipoSanguineo: "A+", compartilhar: true }, undefined, new Date("2026-10-01T00:00:00Z"))!;
    expect(f1.consentimentoEm).toBe("2026-10-01T00:00:00.000Z");
    const f2 = montarFicha({ tipoSanguineo: "B+", compartilhar: true }, f1, new Date("2026-10-05T00:00:00Z"))!;
    expect(f2.consentimentoEm).toBe("2026-10-01T00:00:00.000Z");
    expect(montarFicha({ tipoSanguineo: "B+", compartilhar: false }, f2)!.consentimentoEm).toBeUndefined();
    expect(montarFicha({ tipoSanguineo: "", alergias: " ", compartilhar: false }, f2)).toBeUndefined();
    expect(montarFicha({ contatoNome: "Ana", contatoTelefone: "(21) 3333-4444", compartilhar: false }, undefined)!.contatoTelefone).toBe("2133334444");
  });

  it("janela: de 7 dias antes do início até o fim do evento", () => {
    expect(eventoNaJanelaDaFicha({ inicioEm: em(7), fimEm: em(8) }, AGORA)).toBe(true);
    expect(eventoNaJanelaDaFicha({ inicioEm: em(8), fimEm: em(9) }, AGORA)).toBe(false);
    expect(eventoNaJanelaDaFicha({ inicioEm: em(-2), fimEm: em(0) }, AGORA)).toBe(true);
    expect(eventoNaJanelaDaFicha({ inicioEm: em(-3), fimEm: em(-1) }, AGORA)).toBe(false);
  });
});

describe("quem recebe a ficha pela visão", () => {
  it("titular sempre recebe, mesmo sem autorização", () => {
    comFicha(false);
    expect(fichaNaVisao("usr-participante")?.tipoSanguineo).toBe("O-");
  });

  it("organização e admin: só com autorização, inscrição confirmada e na janela", () => {
    base.eventos.push(evento(3, 4));
    inscrever();
    comFicha(true);
    expect(fichaNaVisao("usr-organizador")?.alergias).toBe("dipirona");
    expect(fichaNaVisao("usr-admin")?.alergias).toBe("dipirona");
    expect(podeVerFicha(base, u("usr-organizador"), u("usr-participante"), AGORA)).toBe(true);
  });

  it("sem autorização, a gestão recebe o inscrito mas não a ficha", () => {
    base.eventos.push(evento(3, 4));
    inscrever();
    comFicha(false);
    const v = visaoParaUsuario(base, u("usr-organizador"), AGORA).usuarios.find((x) => x.id === "usr-participante");
    expect(v).toBeDefined();
    expect(v!.fichaEmergencia).toBeUndefined();
  });

  it("fora da janela (cedo demais ou depois do evento) e inscrição não confirmada: ninguém da gestão vê", () => {
    comFicha(true);
    base.eventos.push(evento(20, 21));
    inscrever();
    expect(fichaNaVisao("usr-organizador")).toBeUndefined();
    expect(fichaNaVisao("usr-admin")).toBeUndefined();
    base.eventos = base.eventos.filter((e) => e.id !== EVT);
    base.eventos.push(evento(-5, -1));
    expect(fichaNaVisao("usr-organizador")).toBeUndefined();
    base.eventos = base.eventos.filter((e) => e.id !== EVT);
    base.eventos.push(evento(3, 4));
    base.inscricoes.find((i) => i.id === "ins-ficha")!.status = "estornada";
    expect(fichaNaVisao("usr-organizador")).toBeUndefined();
  });

  it("organização de outro evento e visitante nunca recebem", () => {
    base.eventos.push({ ...evento(3, 4), organizacaoId: "org-qualquer-outra" });
    inscrever();
    comFicha(true);
    expect(fichaNaVisao("usr-organizador")).toBeUndefined();
    expect(JSON.stringify(visaoParaUsuario(base, null, AGORA))).not.toContain("dipirona");
  });

  it("check-in leva a ficha só quando a visão liberou", () => {
    base.eventos.push(evento(3, 4));
    inscrever();
    comFicha(true);
    const daGestao = visaoParaUsuario(base, u("usr-organizador"), AGORA);
    expect(ingressosDoEvento(daGestao, EVT).find((i) => i.inscricaoId === "ins-ficha")?.emergencia?.tipoSanguineo).toBe("O-");
    comFicha(false);
    const semAutorizacao = visaoParaUsuario(base, u("usr-organizador"), AGORA);
    expect(ingressosDoEvento(semAutorizacao, EVT).find((i) => i.inscricaoId === "ins-ficha")?.emergencia).toBeUndefined();
  });
});

describe("gravação", () => {
  it("perfil salva e remove; dado inválido é recusado", () => {
    const eu = u("usr-participante");
    salvarFichaEmergencia(eu, { tipoSanguineo: "AB+", compartilhar: true });
    expect(eu.fichaEmergencia).toMatchObject({ tipoSanguineo: "AB+", compartilhar: true });
    expect(eu.fichaEmergencia!.consentimentoEm).toBeTruthy();
    expect(() => salvarFichaEmergencia(eu, { contatoNome: "Sem telefone", compartilhar: false })).toThrow(/telefone/);
    salvarFichaEmergencia(eu, { compartilhar: false });
    expect(eu.fichaEmergencia).toBeUndefined();
  });

  it("cadastro valida a ficha opcional", () => {
    const dados = {
      cpf: "52998224725", nomeCompleto: "Teste Ficha", dataNascimento: "1990-01-01", email: "ficha@teste.com",
      senha: "SenhaForte#2026", confirmacaoSenha: "SenhaForte#2026", whatsapp: "11999998888", cep: "01310100",
      logradouro: "Av", numero: "1", bairro: "B", cidade: "São Paulo", uf: "SP", aceiteTermos: true,
      cienciaPrivacidade: true, autorizacaoPromocional: false,
    } as DadosCadastro;
    expect(() => validarCadastro(dados)).not.toThrow();
    expect(() => validarCadastro({ ...dados, fichaEmergencia: { tipoSanguineo: "X", compartilhar: false } })).toThrow(/Tipo sanguíneo/);
  });
});
