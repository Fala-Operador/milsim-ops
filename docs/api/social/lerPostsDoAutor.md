# `lerPostsDoAutor`

[← Índice de APIs](../README.md) · Módulo: [Comunidade geral](../README.md#social)

| | |
|---|---|
| Server function | `postsDoAutorFn` em [`src/api/social.functions.ts`](../../../src/api/social.functions.ts) |
| Uso no navegador | `lerPostsDoAutor(…)` |
| Método | `POST` |
| Acesso | Pública (perfil privado: só seguidores aprovados) |

Posts de uma pessoa (aba Publicações do perfil do operador).

## Entrada

| Campo | Tipo | Observação |
|---|---|---|
| `autorId` | string (UUID) |  |
| `antes?` | string (ISO) | Cursor. |
| `antesId?` | string | Cursor. |

## Regras

- Mesma visibilidade do feed: perfil privado sem seguir devolve página vazia.

## Resposta

`PaginaPosts`.

## Erros

Nenhum erro de regra específico (falhas de banco viram mensagem genérica com código).

## Exemplo

```ts
import { lerPostsDoAutor } from "@/api/social.functions";

await lerPostsDoAutor("2f0c…");
```

`data` enviado à server function (`postsDoAutorFn({ data })`):

```json
{
  "autorId": "2f0c…"
}
```
