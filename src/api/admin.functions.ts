// API administrativa: solicitações, usuários e privacidade.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import * as admin from "@/services/admin";
import { exigirAdmin, mutar } from "@/server/unidade.server";
import { chamar } from "@/api/cliente";

const id = z.string().min(1).max(100);

export const analisarSolicitacaoFn = createServerFn({ method: "POST" })
  .validator(
    z.object({ solicitacaoId: id, acao: z.enum(["iniciar", "aprovar", "ajustes", "rejeitar"]), justificativa: z.string().max(1000).optional() }).parse,
  )
  .handler(({ data }) =>
    mutar(({ usuario }) => admin.analisarSolicitacao(data.solicitacaoId, exigirAdmin(usuario).id, data.acao, data.justificativa)),
  );

export const desativarUsuarioFn = createServerFn({ method: "POST" })
  .validator(z.object({ usuarioId: id, justificativa: z.string().max(1000) }).parse)
  .handler(({ data }) =>
    mutar(({ usuario }) => admin.desativarUsuario(data.usuarioId, exigirAdmin(usuario).id, data.justificativa)),
  );

export const aprovarAutorizacaoFn = createServerFn({ method: "POST" })
  .validator(z.object({ usuarioId: id }).parse)
  .handler(({ data }) => mutar(({ usuario }) => admin.aprovarAutorizacaoResponsavel(data.usuarioId, exigirAdmin(usuario).id)));

/** Correção do cadastro de outra pessoa (o e-mail, login da conta, não muda por aqui). */
const texto = (max: number) => z.string().max(max);
export const editarDadosUsuarioFn = createServerFn({ method: "POST" })
  .validator(z.object({
    usuarioId: id,
    dados: z.object({
      cpf: texto(14), nomeCompleto: texto(150), dataNascimento: texto(10), whatsapp: texto(20),
      cep: texto(9), logradouro: texto(150), numero: texto(20), complemento: texto(100).optional(),
      bairro: texto(100), cidade: texto(100), uf: texto(2),
      instagram: texto(60).optional(), squad: texto(80).optional(),
    }).strict(),
  }).parse)
  .handler(({ data }) => mutar(({ usuario }) => admin.editarDadosUsuario(data.usuarioId, exigirAdmin(usuario).id, data.dados)));

export const responderPrivacidadeFn = createServerFn({ method: "POST" })
  .validator(z.object({ solicitacaoId: id, resposta: z.string().max(2000) }).parse)
  .handler(({ data }) =>
    mutar(({ usuario }) => admin.responderPrivacidade(data.solicitacaoId, exigirAdmin(usuario).id, data.resposta)),
  );

// ---------- Uso no navegador ----------
export const analisarSolicitacao = (
  solicitacaoId: string, acao: "iniciar" | "aprovar" | "ajustes" | "rejeitar", justificativa?: string,
) => chamar(analisarSolicitacaoFn({ data: { solicitacaoId, acao, justificativa } }));
export const desativarUsuario = (usuarioId: string, justificativa: string) =>
  chamar(desativarUsuarioFn({ data: { usuarioId, justificativa } }));
export const aprovarAutorizacaoResponsavel = (usuarioId: string) => chamar(aprovarAutorizacaoFn({ data: { usuarioId } }));
export const editarDadosUsuario = (usuarioId: string, dados: admin.DadosUsuarioAdmin) =>
  chamar(editarDadosUsuarioFn({ data: { usuarioId, dados } }));
export const responderPrivacidade = (solicitacaoId: string, resposta: string) =>
  chamar(responderPrivacidadeFn({ data: { solicitacaoId, resposta } }));
