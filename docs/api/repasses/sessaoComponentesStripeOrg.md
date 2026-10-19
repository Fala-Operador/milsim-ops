# `sessaoComponentesStripeOrg`

[← Índice de APIs](../README.md) · Módulo: [Repasse (Stripe Connect)](../README.md#repasses)

| | |
|---|---|
| Server function | `sessaoComponentesStripeFn` em [`src/api/repasses.functions.ts`](../../../src/api/repasses.functions.ts) |
| Uso no navegador | `sessaoComponentesStripeOrg(…)` |
| Método | `POST` |
| Acesso | Quem gere a organização |

Cria a sessão dos componentes embutidos do Stripe para a conta da organização: cadastro (`account-onboarding`), avisos (`notification-banner`), dados da conta (`account-management`) e, com a conta ativa, saques (`payouts`) e pagamentos (`payments`).

## Entrada

| Campo | Tipo | Observação |
|---|---|---|
| `organizacaoId` | string |  |

## Regras

- Exige `STRIPE_PUBLISHABLE_KEY` configurada e da mesma conta e modo da `STRIPE_SECRET_KEY`.
- Sem conta de recebimento, cria a conta Express da organização (como `cadastrarRecebimento`) antes da sessão.
- Saques e pagamentos só entram na sessão com a conta ativa.
- O `clientSecret` é de uso curto e só serve para a conta da organização.
- Se o site ganhar uma CSP, libere `https://connect-js.stripe.com` e `https://js.stripe.com` em `script-src` e `frame-src`.

## Resposta

`{ chavePublicavel, clientSecret }` para inicializar o Stripe Connect.js (não usa `chamar`).

## Erros

Mensagens que chegam ao navegador em `error.message` (regras de negócio):

- Você só pode configurar os recebimentos da sua organização.
- Os painéis do Stripe ainda não foram ativados na plataforma.
- Os painéis do Stripe estão mal configurados: … (chave publicável e secreta de modos ou contas diferentes).
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
container.append(connect.create("account-onboarding")); // ou "payouts", "account-management"...
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
