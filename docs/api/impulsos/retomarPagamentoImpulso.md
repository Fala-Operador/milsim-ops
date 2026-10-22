# `retomarPagamentoImpulso`

[← Índice de APIs](../README.md) · Módulo: [Impulsos das organizações](../README.md#impulsos)

| | |
|---|---|
| Server function | `retomarPagamentoImpulsoFn` em [`src/api/impulsos.functions.ts`](../../../src/api/impulsos.functions.ts) |
| Uso no navegador | `retomarPagamentoImpulso(…)` |
| Método | `POST` |
| Acesso | Organizador ativo da organização do impulso |

Volta à página de pagamento de um impulso que ainda aguarda pagamento.

## Entrada

| Campo | Tipo | Observação |
|---|---|---|
| `impulsoId` | string |  |

## Regras

- Reaproveita a Checkout Session aberta; sessão já paga ou expirada é aplicada e a chamada avisa.

## Resposta

`{ impulso, urlPagamento }`.

## Erros

Mensagens que chegam ao navegador em `error.message` (regras de negócio):

- Impulso não encontrado.
- Este impulso não está mais aguardando pagamento.
- Este pagamento já foi concluído ou expirou. Confira em Impulsionar.

## Exemplo

```ts
import { retomarPagamentoImpulso } from "@/api/impulsos.functions";

const { urlPagamento } = await retomarPagamentoImpulso("ipc-m1x2-ab12c");
```

`data` enviado à server function (`retomarPagamentoImpulsoFn({ data })`):

```json
{
  "impulsoId": "ipc-m1x2-ab12c"
}
```

Resultado devolvido pela chamada:

```json
{
  "impulso": {
    "id": "ipc-m1x2-ab12c",
    "organizacaoId": "org-bravo",
    "planoId": "7d",
    "compradoPor": "usr-organizador",
    "duracaoHoras": 168,
    "precoCentavos": 4490,
    "validadeDias": 30,
    "status": "aguardando_pagamento",
    "criadoEm": "2026-10-21T02:00:00.000Z",
    "sessaoId": "cs_live_..."
  },
  "urlPagamento": "https://checkout.stripe.com/c/pay/cs_live_..."
}
```
