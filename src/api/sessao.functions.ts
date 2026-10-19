// API de sessão e leitura: login, cadastro, logout, recuperação de senha e visão.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import * as auth from "@/server/auth.server";
import { consultar, ler } from "@/server/unidade.server";
import { stripeConfigurado } from "@/server/stripe.server";
import { chamar } from "@/api/cliente";
import type { DadosCadastro } from "@/services/auth";

// ---------- Server functions ----------
export const obterVisaoFn = createServerFn({ method: "GET" }).handler(() => ler(() => null));

export const obterEventoFn = createServerFn({ method: "GET" })
  .validator(z.object({ eventoId: z.string().min(1) }).parse)
  .handler(({ data }) =>
    consultar((base) => {
      const evento = base.eventos.find((e) => e.id === data.eventoId) ?? null;
      const organizacao = evento ? base.organizacoes.find((o) => o.id === evento.organizacaoId) ?? null : null;
      // Com o Stripe configurado, inscrições pagas passam pelo checkout.
      return { evento, organizacao, pagamentoOnline: stripeConfigurado() };
    }),
  );

const entradaLogin = z.object({ email: z.string().max(200), senha: z.string().max(200) });
export const entrarFn = createServerFn({ method: "POST" })
  .validator(entradaLogin.parse)
  .handler(({ data }) => auth.entrar(data.email, data.senha));

export const sairFn = createServerFn({ method: "POST" }).handler(() => auth.sair());

const entradaCadastro = z.object({
  cpf: z.string(), nomeCompleto: z.string().min(1).max(200), dataNascimento: z.string(), email: z.string().max(200),
  senha: z.string().max(200), confirmacaoSenha: z.string().max(200), whatsapp: z.string(), cep: z.string(),
  logradouro: z.string().max(200), numero: z.string().max(20), complemento: z.string().max(200).optional(),
  bairro: z.string().max(200), cidade: z.string().max(200), uf: z.string().max(2), instagram: z.string().max(100).optional(),
  squad: z.string().max(100).optional(), fotoUrl: z.string().optional(), aceiteTermos: z.boolean(),
  cienciaPrivacidade: z.boolean(), autorizacaoPromocional: z.boolean(),
});
export const cadastrarFn = createServerFn({ method: "POST" })
  .validator(entradaCadastro.parse)
  .handler(({ data }) => auth.cadastrar(data as DadosCadastro));

export const recuperarSenhaFn = createServerFn({ method: "POST" })
  .validator(z.object({ email: z.string().max(200) }).parse)
  .handler(({ data }) => auth.recuperarSenha(data.email));

export const trocarCodigoFn = createServerFn({ method: "POST" })
  .validator(z.object({ codigo: z.string().min(1).max(500) }).parse)
  .handler(({ data }) => auth.trocarCodigoRecuperacao(data.codigo));

export const validarTokenRecuperacaoFn = createServerFn({ method: "POST" })
  .validator(z.object({ tokenHash: z.string().min(1).max(500) }).parse)
  .handler(({ data }) => auth.validarTokenRecuperacao(data.tokenHash));

export const definirNovaSenhaFn = createServerFn({ method: "POST" })
  .validator(z.object({ senha: z.string().max(200) }).parse)
  .handler(({ data }) => auth.definirNovaSenha(data.senha));

// ---------- Uso no navegador ----------
export const recarregarVisao = () => chamar(obterVisaoFn());
export const entrar = (email: string, senha: string) => chamar(entrarFn({ data: { email, senha } }));
export const sair = () => chamar(sairFn());
export const cadastrar = (dados: DadosCadastro) => chamar(cadastrarFn({ data: dados }));
export const recuperarSenha = (email: string) => recuperarSenhaFn({ data: { email } });
export const trocarCodigoRecuperacao = (codigo: string) => trocarCodigoFn({ data: { codigo } });
export const validarTokenRecuperacao = (tokenHash: string) => validarTokenRecuperacaoFn({ data: { tokenHash } });
export const definirNovaSenha = (senha: string) => chamar(definirNovaSenhaFn({ data: { senha } }));
