# `atualizarRecebimento`

[← Índice de APIs](../README.md) · Módulo: [Repasse (Stripe Connect)](../README.md#repasses)

| | |
|---|---|
| Server function | `sincronizarRecebimentoFn` em [`src/api/repasses.functions.ts`](../../../src/api/repasses.functions.ts) |
| Uso no navegador | `atualizarRecebimento(…)` |
| Método | `POST` |
| Acesso | Quem gere a organização |

Consulta a conta Connect no Stripe e atualiza a situação do recebimento (`organizacao.recebimento`). Usada no retorno do cadastro.

## Entrada

| Campo | Tipo | Observação |
|---|---|---|
| `organizacaoId` | string |  |

## Regras

- O webhook `account.updated` faz o mesmo automaticamente; esta chamada só antecipa.
- Conta guardada que só existe no outro modo do Stripe (conta de teste depois da troca para as chaves de produção) é esquecida e a organização faz um cadastro novo.

## Resposta

O `RecebimentoOrganizacao` atualizado (ou `undefined` se a organização ainda não tem conta).

## Erros

Mensagens que chegam ao navegador em `error.message` (regras de negócio):

- Você só pode configurar os recebimentos da sua organização.
- Falhas do Stripe (`mensagemDeFalhaStripe` em `src/lib/stripe.ts`): "O Stripe não libera a criação de contas conectadas pela API Accounts v1 nesta conta. No painel do Stripe (modo de produção), ative "Accounts v1 support" nas configurações do Connect e tente de novo." (erro de Accounts v1), "O Stripe recusou a chave secreta da plataforma (STRIPE_SERVER_API_KEY). Confira se ela foi copiada inteira e se o site foi publicado de novo depois da troca." (401), "O Stripe recusou esta operação de contas conectadas." (403); as três terminam com a mensagem original entre parênteses, "(Stripe: ...)", "O Stripe Connect ainda não está ativado na conta da plataforma neste modo. Ative o Connect no painel do Stripe (modo de produção) e tente de novo.", "Stripe: <mensagem do Stripe>" (outros 400/404) ou "Não foi possível falar com o Stripe agora. Tente novamente em instantes." (rede ou erro do Stripe).
- Entre na sua conta para continuar.

## Exemplo

```ts
import { atualizarRecebimento } from "@/api/repasses.functions";

await atualizarRecebimento("org-mv76sa2r-8frtq");
```

`data` enviado à server function (`sincronizarRecebimentoFn({ data })`):

```json
{
  "organizacaoId": "org-mv76sa2r-8frtq"
}
```

Resultado devolvido pela chamada:

```json
{
  "provedor": "stripe",
  "contaId": "acct_1Q…",
  "status": "ativa",
  "transferenciasAtivas": true,
  "saquesAtivos": true,
  "pendencias": [],
  "atualizadoEm": "2026-10-19T17:40:00.000Z"
}
```
