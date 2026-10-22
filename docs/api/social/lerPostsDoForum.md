# `lerPostsDoForum`

[← Índice de APIs](../README.md) · Módulo: [Comunidade geral](../README.md#social)

| | |
|---|---|
| Server function | `postsDoForumFn` em [`src/api/social.functions.ts`](../../../src/api/social.functions.ts) |
| Uso no navegador | `lerPostsDoForum(…)` |
| Método | `POST` |
| Acesso | Pública (privado: só membros aprovados) |

Página de publicações de um fórum.

## Entrada

| Campo | Tipo | Observação |
|---|---|---|
| `forumId` | string |  |
| `antes?` | string (ISO) | Cursor. |
| `antesId?` | string | Cursor. |

## Regras

- Visibilidade aplicada no banco (`social_posts_page` com `p_forum`).

## Resposta

`PaginaPosts`.

## Erros

Mensagens que chegam ao navegador em `error.message` (regras de negócio):

- Fórum indisponível.
- Fórum privado: só membros aprovados veem as publicações.

## Exemplo

```ts
import { lerPostsDoForum } from "@/api/social.functions";

await lerPostsDoForum("frm-…");
```

`data` enviado à server function (`postsDoForumFn({ data })`):

```json
{
  "forumId": "frm-…"
}
```
