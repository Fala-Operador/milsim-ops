# `sessaoComponentesStripeOrg`

[← Índice de APIs](../README.md) · Módulo: [Repasse (Stripe Connect)](../README.md#repasses)

| | |
|---|---|
| Server function | `sessaoComponentesStripeFn` em [`src/api/repasses.functions.ts`](../../../src/api/repasses.functions.ts) |
| Uso no navegador | `sessaoComponentesStripeOrg(…)` |
| Método | `POST` |
| Acesso | Quem gere a organização |

Cria a sessão dos componentes embutidos do Stripe (painéis de saques e de pagamentos dentro de Financeiro) para a conta da organização.

## Entrada

| Campo | Tipo | Observação |
|---|---|---|
| `organizacaoId` | string |  |

## Regras

- Exige `STRIPE_PUBLISHABLE_KEY` configurada e a conta de recebimento ativa.
- O `clientSecret` é de uso curto e só serve para a conta da organização.
- Se o site ganhar uma CSP, libere `https://connect-js.stripe.com` e `https://js.stripe.com` em `script-src` e `frame-src`.
- Conta guardada que a chave atual não alcança (conta de teste depois da troca para as chaves de produção, ou conta de outra plataforma/sandbox, que o Stripe recusa com 403 "does not have access to account") é esquecida e a organização faz um cadastro novo. Mensagens de erro do Stripe nunca mostram a chave de API, nem mascarada.

## Resposta

`{ chavePublicavel, clientSecret }` para inicializar o Stripe Connect.js (não usa `chamar`).

## Erros

Mensagens que chegam ao navegador em `error.message` (regras de negócio):

- Você só pode configurar os recebimentos da sua organização.
- Falhas do Stripe (`mensagemDeFalhaStripe` em `src/lib/stripe.ts`): "O Stripe não libera a criação de contas conectadas pela API Accounts v1 nesta conta. No painel do Stripe (modo de produção), ative "Accounts v1 support" nas configurações do Connect e tente de novo." (erro de Accounts v1), "O Stripe recusou a chave secreta da plataforma (STRIPE_SERVER_API_KEY). Confira se ela foi copiada inteira e se o site foi publicado de novo depois da troca." (401), "O Stripe recusou esta operação de contas conectadas." (403); as três terminam com a mensagem original entre parênteses, "(Stripe: ...)", "A conta Stripe da plataforma ainda não está ativada em produção, e o Stripe só deixa criar contas conectadas depois disso. Quem administra o Stripe da plataforma precisa concluir a ativação em https://dashboard.stripe.com/account/onboarding e tentar de novo." (plataforma não ativada; termina com a mensagem original do Stripe entre parênteses e a conta do Stripe usada pela chave do site, com o id, o nome e se pagamentos e repasses estão ativos; se a plataforma já recebe pagamentos, a mensagem pede para concluir o perfil da plataforma do Connect em https://dashboard.stripe.com/connect/registration), "O Stripe Connect ainda não está ativado na conta da plataforma neste modo. Ative o Connect no painel do Stripe (modo de produção) e tente de novo.", "Stripe: <mensagem do Stripe>" (outros 400/404) ou "Não foi possível falar com o Stripe agora. Tente novamente em instantes." (rede ou erro do Stripe).
- Os painéis do Stripe ainda não foram ativados na plataforma.
- Conclua o cadastro de recebimentos para ver os painéis do Stripe.
- Entre na sua conta para continuar.

## Exemplo

```ts
// Uso real: src/components/PaineisStripe.tsx (Connect.js carregado de https://connect-js.stripe.com/v1.0/connect.js)
import { sessaoComponentesStripeOrg } from "@/api/repasses.functions";

const { chavePublicavel, clientSecret } = await sessaoComponentesStripeOrg(orgId);
const connect = window.StripeConnect!.init!({
  publishableKey: chavePublicavel,
  fetchClientSecret: async () => clientSecret, // sessões seguintes: chame a API de novo
  locale: "pt-BR",
});
container.append(connect.create("payouts"));
```

`data` enviado à server function (`sessaoComponentesStripeFn({ data })`):

```json
{
  "organizacaoId": "org-mv76sa2r-8frtq"
}
```

Resultado devolvido pela chamada:

```json
{
  "chavePublicavel": "pk_test_…",
  "clientSecret": "accs_secret__…"
}
```
