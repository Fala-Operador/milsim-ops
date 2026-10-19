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

## Resposta

O `RecebimentoOrganizacao` atualizado (ou `undefined` se a organização ainda não tem conta).

## Erros

Mensagens que chegam ao navegador em `error.message` (regras de negócio):

- Você só pode configurar os recebimentos da sua organização.
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
