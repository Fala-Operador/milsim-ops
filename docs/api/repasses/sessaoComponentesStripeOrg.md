# `sessaoComponentesStripeOrg`

[← Índice de APIs](../README.md) · Módulo: [Repasse (Stripe Connect)](../README.md#repasses)

| | |
|---|---|
| Server function | `sessaoComponentesStripeFn` em [`src/api/repasses.functions.ts`](../../../src/api/repasses.functions.ts) |
| Uso no navegador | `sessaoComponentesStripeOrg(…)` |
| Método | `POST` |
| Acesso | Quem gere a organização |

Cria a sessão dos componentes embutidos do Stripe para a conta da organização: cadastro (`account-onboarding`), avisos (`notification-banner`), dados da conta (`account-management`). Saldo e saques não usam componente do Stripe: vêm de [`saldoRecebimento`](saldoRecebimento.md).

## Entrada

| Campo | Tipo | Observação |
|---|---|---|
| `organizacaoId` | string |  |

## Regras

- Exige `STRIPE_BROWSER_PUBLIC_KEY` configurada e da mesma conta e modo da `STRIPE_SERVER_API_KEY`.
- Sem conta de recebimento, cria a conta Express da organização (como `cadastrarRecebimento`) antes da sessão.
- A plataforma preenche o perfil comercial da conta (site = endereço público do Milsim Ops, ramo MCC 7999 e descrição com o nome da organização), para o Stripe não pedir "Seu site". Contas já criadas e ainda em cadastro recebem esse preenchimento ao abrir o cadastro; se o Stripe recusar, a organização preenche o campo.
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
container.append(connect.create("account-onboarding")); // ou "account-management", "notification-banner"
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
