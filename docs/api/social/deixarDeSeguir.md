# `deixarDeSeguir`

[← Índice de APIs](../README.md) · Módulo: [Comunidade geral](../README.md#social)

| | |
|---|---|
| Server function | `deixarDeSeguirFn` em [`src/api/social.functions.ts`](../../../src/api/social.functions.ts) |
| Uso no navegador | `deixarDeSeguir(…)` |
| Método | `POST` |
| Acesso | Qualquer pessoa autenticada e ativa |

Deixa de seguir (ou cancela o pedido para seguir).

## Entrada

| Campo | Tipo | Observação |
|---|---|---|
| `usuarioId` | string (UUID) |  |

## Regras

Sem regras além do acesso.

## Resposta

`null`.

## Erros

Mensagens que chegam ao navegador em `error.message` (regras de negócio):

- Entre na sua conta para continuar.

## Exemplo

```ts
import { deixarDeSeguir } from "@/api/social.functions";

await deixarDeSeguir("2f0c…");
```

`data` enviado à server function (`deixarDeSeguirFn({ data })`):

```json
{
  "usuarioId": "2f0c…"
}
```
