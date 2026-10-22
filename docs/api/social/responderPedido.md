# `responderPedido`

[← Índice de APIs](../README.md) · Módulo: [Comunidade geral](../README.md#social)

| | |
|---|---|
| Server function | `responderPedidoFn` em [`src/api/social.functions.ts`](../../../src/api/social.functions.ts) |
| Uso no navegador | `responderPedido(…)` |
| Método | `POST` |
| Acesso | Dono do perfil seguido |

Aceita ou recusa um pedido para seguir.

## Entrada

| Campo | Tipo | Observação |
|---|---|---|
| `seguidorId` | string (UUID) |  |
| `aprovar` | boolean | `false` recusa (e remove). |

## Regras

- Aceitar notifica quem pediu.

## Resposta

`null`.

## Erros

Mensagens que chegam ao navegador em `error.message` (regras de negócio):

- Pedido não encontrado.
- Entre na sua conta para continuar.

## Exemplo

```ts
import { responderPedido } from "@/api/social.functions";

await responderPedido("2f0c…", true);
```

`data` enviado à server function (`responderPedidoFn({ data })`):

```json
{
  "seguidorId": "2f0c…",
  "aprovar": true
}
```
