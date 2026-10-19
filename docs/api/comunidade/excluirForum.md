# `excluirForum`

[← Índice de APIs](../README.md) · Módulo: [Comunidade](../README.md#comunidade)

| | |
|---|---|
| Server function | `excluirForumFn` em [`src/api/comunidade.functions.ts`](../../../src/api/comunidade.functions.ts) |
| Uso no navegador | `excluirForum(…)` |
| Método | `POST` |
| Acesso | Gestão do evento: organização dona ou admin |

Exclui um fórum vazio.

## Entrada

| Campo | Tipo | Observação |
|---|---|---|
| `forumId` | string |  |

## Regras

- Fórum com conteúdo deve ser arquivado, não excluído.

## Resposta

`void`.

## Erros

Mensagens que chegam ao navegador em `error.message` (regras de negócio):

- Fórum não encontrado.
- Fóruns com conteúdo devem ser arquivados, não excluídos.
- Apenas a organização do evento e a administração podem fazer isso.
- Entre na sua conta para continuar.

## Exemplo

```ts
import { excluirForum } from "@/api/comunidade.functions";

await excluirForum("for-vazio-1");
```

`data` enviado à server function (`excluirForumFn({ data })`):

```json
{
  "forumId": "for-vazio-1"
}
```

Resultado devolvido pela chamada:

```json
null
```
