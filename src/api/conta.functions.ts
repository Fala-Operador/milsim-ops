// API da conta: missões, privacidade, suporte, notificações, aparência e preferências.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import * as conta from "@/services/conta";
import { definirSilencio as silencio } from "@/services/notificacoes";
import { exigirUsuario, mutar } from "@/server/unidade.server";
import { chamar } from "@/api/cliente";
import type { PreferenciaModalidades } from "@/lib/modalidades";
import type { SolicitacaoPrivacidade } from "@/lib/domain/types";
import type { DadosChamado } from "@/services/conta";
import type { Tema } from "@/lib/localizacao";

const id = z.string().min(1).max(100);

export const enviarEntregaMissaoFn = createServerFn({ method: "POST" })
  .validator(z.object({ missaoId: id, texto: z.string().max(4000).optional() }).parse)
  .handler(({ data }) => mutar(({ usuario }) => conta.enviarEntregaMissao(exigirUsuario(usuario), data.missaoId, data.texto)));

export const solicitarPrivacidadeFn = createServerFn({ method: "POST" })
  .validator(z.object({ tipo: z.enum(["acesso", "correcao", "exportacao", "exclusao"]), detalhes: z.string().max(4000) }).parse)
  .handler(({ data }) => mutar(({ usuario }) => conta.solicitarPrivacidade(exigirUsuario(usuario), data.tipo, data.detalhes)));

export const abrirChamadoFn = createServerFn({ method: "POST" })
  .validator(
    z.object({ assunto: z.string().max(200), categoria: z.string().max(60), descricao: z.string().max(4000), eventoId: z.string().max(100).optional() }).parse,
  )
  .handler(({ data }) => mutar(({ usuario }) => conta.abrirChamado(exigirUsuario(usuario), data)));

export const responderChamadoFn = createServerFn({ method: "POST" })
  .validator(z.object({ chamadoId: id, corpo: z.string().max(4000) }).parse)
  .handler(({ data }) => mutar(({ usuario }) => conta.responderChamado(exigirUsuario(usuario), data.chamadoId, data.corpo)));

export const marcarNotificacaoLidaFn = createServerFn({ method: "POST" })
  .validator(z.object({ id }).parse)
  .handler(({ data }) => mutar(({ usuario }) => conta.marcarNotificacaoLida(exigirUsuario(usuario), data.id)));

export const marcarNotificacoesLidasFn = createServerFn({ method: "POST" })
  .validator(z.object({ plataforma: z.boolean() }).parse)
  .handler(({ data }) => mutar(({ usuario }) => conta.marcarNotificacoesLidas(exigirUsuario(usuario), data.plataforma)));

export const definirSilencioFn = createServerFn({ method: "POST" })
  .validator(z.object({ todas: z.boolean().optional(), comunidade: z.boolean().optional() }).parse)
  .handler(({ data }) => mutar(({ usuario }) => silencio(exigirUsuario(usuario).id, data)));

export const definirTemaFn = createServerFn({ method: "POST" })
  .validator(z.object({ tema: z.enum(["dark", "light"]) }).parse)
  .handler(({ data }) => mutar(({ usuario }) => conta.definirTema(exigirUsuario(usuario), data.tema)));

export const salvarPreferenciaFn = createServerFn({ method: "POST" })
  .validator(z.object({ estado: z.enum(["pendente", "todas", "selecionadas"]), modalidades: z.array(z.string().max(40)).max(20) }).passthrough().parse)
  .handler(({ data }) =>
    mutar(({ usuario }) => conta.salvarPreferenciaModalidades(exigirUsuario(usuario), data as unknown as PreferenciaModalidades)),
  );

// ---------- Uso no navegador ----------
export const enviarEntregaMissao = (missaoId: string, texto?: string) => chamar(enviarEntregaMissaoFn({ data: { missaoId, texto } }));
export const solicitarPrivacidade = (tipo: SolicitacaoPrivacidade["tipo"], detalhes: string) =>
  chamar(solicitarPrivacidadeFn({ data: { tipo, detalhes } }));
export const abrirChamado = (dados: DadosChamado) => chamar(abrirChamadoFn({ data: dados }));
export const responderChamado = (chamadoId: string, corpo: string) => chamar(responderChamadoFn({ data: { chamadoId, corpo } }));
export const marcarNotificacaoLida = (notificacaoId: string) => chamar(marcarNotificacaoLidaFn({ data: { id: notificacaoId } }));
export const marcarNotificacoesLidas = (plataforma = false) => chamar(marcarNotificacoesLidasFn({ data: { plataforma } }));
export const definirSilencio = (parcial: { todas?: boolean; comunidade?: boolean }) => chamar(definirSilencioFn({ data: parcial }));
export const definirTema = (tema: Tema) => chamar(definirTemaFn({ data: { tema } }));
export const salvarPreferenciaConta = (p: PreferenciaModalidades) =>
  chamar(salvarPreferenciaFn({ data: p as unknown as { estado: "pendente" | "todas" | "selecionadas"; modalidades: string[] } }));
