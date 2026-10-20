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
- Até as transferências ficarem ativas, as vendas ficam com a plataforma (repasse à parte).
- Conta guardada que só existe no outro modo do Stripe (conta de teste depois da troca para as chaves de produção) é esquecida e a organização faz um cadastro novo.

## Resposta

`{ url }` do cadastro no Stripe.

## Erros

Mensagens que chegam ao navegador em `error.message` (regras de negócio):

- Você só pode configurar os recebimentos da sua organização.
- Falhas do Stripe (`mensagemDeFalhaStripe` em `src/lib/stripe.ts`): "O Stripe não libera a criação de contas conectadas pela API Accounts v1 nesta conta. No painel do Stripe (modo de produção), ative "Accounts v1 support" nas configurações do Connect e tente de novo." (erro de Accounts v1), "O Stripe recusou a chave secreta da plataforma (STRIPE_SERVER_API_KEY). Confira se ela foi copiada inteira e se o site foi publicado de novo depois da troca." (401), "O Stripe recusou esta operação de contas conectadas." (403); as três terminam com a mensagem original entre parênteses, "(Stripe: ...)", "O Stripe Connect ainda não está ativado na conta da plataforma neste modo. Ative o Connect no painel do Stripe (modo de produção) e tente de novo.", "Stripe: <mensagem do Stripe>" (outros 400/404) ou "Não foi possível falar com o Stripe agora. Tente novamente em instantes." (rede ou erro do Stripe).
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
