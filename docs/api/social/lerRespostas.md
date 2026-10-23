# `lerRespostas`

[← Índice de APIs](../README.md) · Módulo: [Comunidade geral](../README.md#social)

| | |
|---|---|
| Server function | `respostasFn` em [`src/api/social.functions.ts`](../../../src/api/social.functions.ts) |
| Uso no navegador | `lerRespostas(…)` |
| Método | `POST` |
| Acesso | Pública (respeita a visibilidade de cada autor) |

Próximas páginas de respostas de uma publicação.

## Entrada

| Campo | Tipo | Observação |
|---|---|---|
| `postId` | string |  |
| `antes?` | string (ISO) | Cursor. |
| `antesId?` | string | Cursor. |

## Regras

- Respostas de autores que quem vê não pode ver ficam de fora.

## Resposta

`PaginaPosts`.

## Erros

Nenhum erro de regra específico (falhas de banco viram mensagem genérica com código).

## Exemplo

```ts
import { lerRespostas } from "@/api/social.functions";

await lerRespostas("sp-…");
```

`data` enviado à server function (`respostasFn({ data })`):

```json
{
  "postId": "sp-…"
}
```
