# `moverOrdemForum`

[← Índice de APIs](../README.md) · Módulo: [Comunidade](../README.md#comunidade)

| | |
|---|---|
| Server function | `moverOrdemForumFn` em [`src/api/comunidade.functions.ts`](../../../src/api/comunidade.functions.ts) |
| Uso no navegador | `moverOrdemForum(…)` |
| Método | `POST` |
| Acesso | Gestão do evento: organização dona ou admin |

Sobe ou desce o fórum na lista.

## Entrada

| Campo | Tipo | Observação |
|---|---|---|
| `forumId` | string |  |
| `direcao` | -1 \| 1 | -1 sobe, 1 desce. |

## Resposta

`void`.

## Erros

Mensagens que chegam ao navegador em `error.message` (regras de negócio):

- Apenas a organização do evento e a administração podem fazer isso.
- Entre na sua conta para continuar.

## Exemplo

```ts
import { moverOrdemForum } from "@/api/comunidade.functions";

await moverOrdemForum("for-logistica-mv76", -1);
```

`data` enviado à server function (`moverOrdemForumFn({ data })`):

```json
{
  "forumId": "for-logistica-mv76",
  "direcao": -1
}
```

Resultado devolvido pela chamada:

```json
null
```
