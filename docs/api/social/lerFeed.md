# `lerFeed`

[← Índice de APIs](../README.md) · Módulo: [Comunidade geral](../README.md#social)

| | |
|---|---|
| Server function | `feedFn` em [`src/api/social.functions.ts`](../../../src/api/social.functions.ts) |
| Uso no navegador | `lerFeed(…)` |
| Método | `POST` |
| Acesso | Pública (visitante vê só perfis públicos) |

Página do feed geral (posts sem as respostas), do mais novo para o mais antigo.

## Entrada

| Campo | Tipo | Observação |
|---|---|---|
| `antes?` | string (ISO) | Cursor: data do último post recebido. |
| `antesId?` | string | Cursor: id do último post recebido. |

## Regras

- Visibilidade aplicada no banco por `social_posts_page()`: perfil público, seguidor aprovado de perfil privado ou o próprio; bloqueios escondem.
- Páginas de 20; `proximo` vem vazio quando acabou.

## Resposta

`PaginaPosts`: `{ posts: PostDTO[], proximo?: { antes, antesId } }`.

## Erros

Nenhum erro de regra específico (falhas de banco viram mensagem genérica com código).

## Exemplo

```ts
import { lerFeed } from "@/api/social.functions";

await lerFeed();
```

`data` enviado à server function (`feedFn({ data })`):

```json
{}
```
