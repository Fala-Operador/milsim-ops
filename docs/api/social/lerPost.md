# `lerPost`

[← Índice de APIs](../README.md) · Módulo: [Comunidade geral](../README.md#social)

| | |
|---|---|
| Server function | `postFn` em [`src/api/social.functions.ts`](../../../src/api/social.functions.ts) |
| Uso no navegador | `lerPost(…)` |
| Método | `POST` |
| Acesso | Pública (respeita a visibilidade do autor) |

Uma publicação, o post a que ela responde (se visível) e a primeira página de respostas.

## Entrada

| Campo | Tipo | Observação |
|---|---|---|
| `postId` | string |  |

## Regras

- Excluída, ocultada, de perfil privado não seguido ou com bloqueio: indisponível.

## Resposta

`{ post: PostDTO, pai?: PostDTO, respostas: PaginaPosts }`.

## Erros

Mensagens que chegam ao navegador em `error.message` (regras de negócio):

- Publicação indisponível.

## Exemplo

```ts
import { lerPost } from "@/api/social.functions";

await lerPost("sp-…");
```

`data` enviado à server function (`postFn({ data })`):

```json
{
  "postId": "sp-…"
}
```
