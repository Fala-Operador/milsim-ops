# `lerForum`

[← Índice de APIs](../README.md) · Módulo: [Comunidade geral](../README.md#social)

| | |
|---|---|
| Server function | `forumFn` em [`src/api/social.functions.ts`](../../../src/api/social.functions.ts) |
| Uso no navegador | `lerForum(…)` |
| Método | `POST` |
| Acesso | Pública |

Um fórum e se quem vê pode ler o conteúdo.

## Entrada

| Campo | Tipo | Observação |
|---|---|---|
| `forumId` | string |  |

## Regras

- `podeLer`: fórum público ou membro aprovado do privado.

## Resposta

`{ forum: ForumDTO, podeLer: boolean }`.

## Erros

Mensagens que chegam ao navegador em `error.message` (regras de negócio):

- Fórum indisponível.

## Exemplo

```ts
import { lerForum } from "@/api/social.functions";

await lerForum("frm-…");
```

`data` enviado à server function (`forumFn({ data })`):

```json
{
  "forumId": "frm-…"
}
```
