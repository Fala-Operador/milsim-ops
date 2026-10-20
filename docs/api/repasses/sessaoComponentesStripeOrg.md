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

## Resposta

`{ chavePublicavel, clientSecret }` para inicializar o Stripe Connect.js (não usa `chamar`).

## Erros

Mensagens que chegam ao navegador em `error.message` (regras de negócio):

- Você só pode configurar os recebimentos da sua organização.
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
