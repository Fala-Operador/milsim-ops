// API de sessão e leitura: login, cadastro, logout, recuperação de senha e visão.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import * as auth from "@/server/auth.server";
import { configRealtimeNavegador } from "@/server/supabase.server";
import { consultar, contextoSomenteLeitura, ler } from "@/server/unidade.server";
import { stripeConfigurado } from "@/server/stripe.server";
import { chaveSiteTurnstile } from "@/server/turnstile.server";
import { contaParaRepasse, taxaDoComprador } from "@/lib/repasses";
import { esquemaFicha } from "@/lib/fichaEmergencia";
import { chamar } from "@/api/cliente";
import type { DadosCadastro, DadosPerfil } from "@/services/auth";

// ---------- Server functions ----------
export const obterVisaoFn = createServerFn({ method: "GET" }).handler(() => ler(() => null));

export const obterEventoFn = createServerFn({ method: "GET" })
  .validator(z.object({ eventoId: z.string().min(1) }).parse)
  .handler(async ({ data }) => {
    const r = await consultar((base) => {
      const evento = base.eventos.find((e) => e.id === data.eventoId) ?? null;
      const organizacao = evento ? base.organizacoes.find((o) => o.id === evento.organizacaoId) ?? null : null;
      // Com o Stripe configurado, inscrições pagas passam pelo checkout.
      return { evento, organizacao, pagamentoOnline: stripeConfigurado() };
    });
    // Taxa de serviço da organização somada ao ingresso, mostrada na revisão antes do pagamento,
    // e conta de recebimento: lidas da base completa (a visão de participantes as esconde).
    const { base } = await contextoSomenteLeitura();
    // Ingresso pago só é vendido com a conta de recebimento da organização ativa.
    const org = base.organizacoes.find((o) => o.id === r.evento?.organizacaoId);
    return { ...r, taxaCompradorPercentual: taxaDoComprador(org), vendasAbertas: !!contaParaRepasse(org) };
  });

// Token do Cloudflare Turnstile, repassado ao CAPTCHA do Supabase Auth.
const captcha = z.string().max(4096).optional();

// Canal público do sinal de versão (src/services/tempoReal.ts): só URL e chave publicável.
export const obterConfigRealtimeFn = createServerFn({ method: "GET" }).handler(() => configRealtimeNavegador());

export const obterConfigTurnstileFn = createServerFn({ method: "GET" }).handler(() => ({
  chaveSite: chaveSiteTurnstile(),
}));

const entradaLogin = z.object({ email: z.string().max(200), senha: z.string().max(200), captcha });
export const entrarFn = createServerFn({ method: "POST" })
  .validator(entradaLogin.parse)
  .handler(({ data }) => auth.entrar(data.email, data.senha, data.captcha));

export const sairFn = createServerFn({ method: "POST" }).handler(() => auth.sair());

const entradaPerfil = z.object({
  cpf: z.string(), nomeCompleto: z.string().min(1).max(200), dataNascimento: z.string(), whatsapp: z.string(), cep: z.string(),
  logradouro: z.string().max(200), numero: z.string().max(20), complemento: z.string().max(200).optional(),
  bairro: z.string().max(200), cidade: z.string().max(200), uf: z.string().max(2), instagram: z.string().max(100).optional(),
  squad: z.string().max(100).optional(), fotoUrl: z.string().optional(), aceiteTermos: z.boolean(),
  cienciaPrivacidade: z.boolean(), autorizacaoPromocional: z.boolean(), fichaEmergencia: esquemaFicha.optional(),
});
const entradaCadastro = entradaPerfil.extend({
  email: z.string().max(200), senha: z.string().max(200), confirmacaoSenha: z.string().max(200), captcha,
});
export const cadastrarFn = createServerFn({ method: "POST" })
  .validator(entradaCadastro.parse)
  .handler(({ data: { captcha, ...dados } }) => auth.cadastrar(dados as DadosCadastro, captcha));

// Entrar com o Google: vai ao Google, volta com o código e, se a conta for nova, completa o perfil.
export const iniciarLoginGoogleFn = createServerFn({ method: "POST" }).handler(() => auth.iniciarLoginGoogle());

export const concluirLoginGoogleFn = createServerFn({ method: "POST" })
  .validator(z.object({ codigo: z.string().min(1).max(500) }).parse)
  .handler(({ data }) => auth.concluirLoginGoogle(data.codigo));

export const obterContaSemPerfilFn = createServerFn({ method: "POST" }).handler(() => auth.contaSemPerfil());

export const completarCadastroGoogleFn = createServerFn({ method: "POST" })
  .validator(entradaPerfil.parse)
  .handler(({ data }) => auth.completarCadastroGoogle(data as Omit<DadosPerfil, "email">));

export const cancelarCadastroGoogleFn = createServerFn({ method: "POST" }).handler(() => auth.cancelarCadastroGoogle());

export const recuperarSenhaFn = createServerFn({ method: "POST" })
  .validator(z.object({ email: z.string().max(200), captcha }).parse)
  .handler(({ data }) => auth.recuperarSenha(data.email, data.captcha));

export const trocarCodigoFn = createServerFn({ method: "POST" })
  .validator(z.object({ codigo: z.string().min(1).max(500) }).parse)
  .handler(({ data }) => auth.trocarCodigoRecuperacao(data.codigo));

export const validarTokenRecuperacaoFn = createServerFn({ method: "POST" })
  .validator(z.object({ tokenHash: z.string().min(1).max(500) }).parse)
  .handler(({ data }) => auth.validarTokenRecuperacao(data.tokenHash));

export const confirmarEmailFn = createServerFn({ method: "POST" })
  .validator(z.union([z.object({ tokenHash: z.string().min(1).max(500) }), z.object({ codigo: z.string().min(1).max(500) })]).parse)
  .handler(({ data }) => auth.confirmarEmail(data));

export const reenviarConfirmacaoFn = createServerFn({ method: "POST" })
  .validator(z.object({ email: z.string().max(200), captcha }).parse)
  .handler(({ data }) => auth.reenviarConfirmacao(data.email, data.captcha));

export const definirNovaSenhaFn = createServerFn({ method: "POST" })
  .validator(z.object({ senha: z.string().max(200) }).parse)
  .handler(({ data }) => auth.definirNovaSenha(data.senha));

// ---------- Uso no navegador ----------
export const recarregarVisao = () => chamar(obterVisaoFn());
export const obterConfigTurnstile = () => obterConfigTurnstileFn();
export const obterConfigRealtime = () => obterConfigRealtimeFn();
export const entrar = (email: string, senha: string, captcha?: string) =>
  chamar(entrarFn({ data: { email, senha, captcha } }));
export const sair = () => chamar(sairFn());
export const cadastrar = (dados: DadosCadastro, captcha?: string) => chamar(cadastrarFn({ data: { ...dados, captcha } }));
export const recuperarSenha = (email: string, captcha?: string) => recuperarSenhaFn({ data: { email, captcha } });
export const trocarCodigoRecuperacao = (codigo: string) => trocarCodigoFn({ data: { codigo } });
export const validarTokenRecuperacao = (tokenHash: string) => validarTokenRecuperacaoFn({ data: { tokenHash } });
export const definirNovaSenha = (senha: string) => chamar(definirNovaSenhaFn({ data: { senha } }));
export const confirmarEmail = (link: { tokenHash: string } | { codigo: string }) => chamar(confirmarEmailFn({ data: link }));
export const reenviarConfirmacao = (email: string, captcha?: string) => reenviarConfirmacaoFn({ data: { email, captcha } });
export const iniciarLoginGoogle = () => iniciarLoginGoogleFn();
export const concluirLoginGoogle = (codigo: string) => chamar(concluirLoginGoogleFn({ data: { codigo } }));
export const obterContaSemPerfil = () => obterContaSemPerfilFn();
export const completarCadastroGoogle = (dados: Omit<DadosPerfil, "email">) => chamar(completarCadastroGoogleFn({ data: dados }));
export const cancelarCadastroGoogle = () => chamar(cancelarCadastroGoogleFn());
