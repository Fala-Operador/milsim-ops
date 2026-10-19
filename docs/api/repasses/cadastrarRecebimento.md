# `cadastrarRecebimento`

[← Índice de APIs](../README.md) · Módulo: [Repasse (Stripe Connect)](../README.md#repasses)

| | |
|---|---|
| Server function | `iniciarCadastroRecebimentoFn` em [`src/api/repasses.functions.ts`](../../../src/api/repasses.functions.ts) |
| Uso no navegador | `cadastrarRecebimento(…)` |
| Método | `POST` |
| Acesso | Quem gere a organização (organizador dela ou admin) |

Cria (ou reaproveita) a conta Stripe Connect Express da organização e devolve o link do cadastro hospedado pelo Stripe.

## Entrada

| Campo | Tipo | Observação |
|---|---|---|
| `organizacaoId` | string |  |

## Regras

- O retorno do cadastro volta para `/organizacao/financeiro?recebimento=retorno` (ou `renovar`, se o link expirou).
- A plataforma preenche o perfil comercial da conta (site = endereço público do Milsim Ops, ramo MCC 7999 e descrição com o nome da organização), para o Stripe não pedir "Seu site". Contas já criadas e ainda em cadastro recebem esse preenchimento ao abrir o cadastro; se o Stripe recusar, a organização preenche o campo.
- Até as transferências ficarem ativas, as vendas ficam com a plataforma (repasse à parte).

## Resposta

`{ url }` do cadastro no Stripe.

## Erros

Mensagens que chegam ao navegador em `error.message` (regras de negócio):

- Você só pode configurar os recebimentos da sua organização.
- Entre na sua conta para continuar.

## Exemplo

```ts
import { cadastrarRecebimento } from "@/api/repasses.functions";

const { url } = await cadastrarRecebimento("org-mv76sa2r-8frtq");
window.location.assign(url);
```

`data` enviado à server function (`iniciarCadastroRecebimentoFn({ data })`):

```json
{
  "organizacaoId": "org-mv76sa2r-8frtq"
}
```

Resultado devolvido pela chamada:

```json
{
  "url": "https://connect.stripe.com/setup/e/acct_…"
}
```
