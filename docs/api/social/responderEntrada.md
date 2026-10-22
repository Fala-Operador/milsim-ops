# `responderEntrada`

[← Índice de APIs](../README.md) · Módulo: [Comunidade geral](../README.md#social)

| | |
|---|---|
| Server function | `responderEntradaFn` em [`src/api/social.functions.ts`](../../../src/api/social.functions.ts) |
| Uso no navegador | `responderEntrada(…)` |
| Método | `POST` |
| Acesso | Dono ou moderador do fórum |

Aprova ou recusa um pedido para entrar.

## Entrada

| Campo | Tipo | Observação |
|---|---|---|
| `forumId` | string |  |
| `usuarioId` | string (UUID) |  |
| `aprovar` | boolean | `false` recusa (e remove o pedido). |

## Regras

- Aprovar notifica quem pediu.

## Resposta

`null`.

## Erros

Mensagens que chegam ao navegador em `error.message` (regras de negócio):

- Só o dono e os moderadores do fórum podem fazer isso.
- Pedido não encontrado.
- Entre na sua conta para continuar.

## Exemplo

```ts
import { responderEntrada } from "@/api/social.functions";

await responderEntrada("frm-…", "2f0c…", true);
```

`data` enviado à server function (`responderEntradaFn({ data })`):

```json
{
  "forumId": "frm-…",
  "usuarioId": "2f0c…",
  "aprovar": true
}
```
