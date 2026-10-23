# `ocultarPostDoForum`

[← Índice de APIs](../README.md) · Módulo: [Comunidade geral](../README.md#social)

| | |
|---|---|
| Server function | `ocultarPostDoForumFn` em [`src/api/social.functions.ts`](../../../src/api/social.functions.ts) |
| Uso no navegador | `ocultarPostDoForum(…)` |
| Método | `POST` |
| Acesso | Dono ou moderador do fórum do post |

Oculta uma publicação (ou resposta) do fórum.

## Entrada

| Campo | Tipo | Observação |
|---|---|---|
| `postId` | string |  |
| `motivo` | string (até 300) | O autor recebe por notificação. |

## Regras

- Só posts de fórum; posts do feed geral são moderados pelo admin (denúncias).

## Resposta

`null`.

## Erros

Mensagens que chegam ao navegador em `error.message` (regras de negócio):

- Informe o motivo para ocultar a publicação.
- Publicação indisponível.
- Só o dono e os moderadores do fórum podem fazer isso.
- Entre na sua conta para continuar.

## Exemplo

```ts
import { ocultarPostDoForum } from "@/api/social.functions";

await ocultarPostDoForum("sp-…", "Fora do tema");
```

`data` enviado à server function (`ocultarPostDoForumFn({ data })`):

```json
{
  "postId": "sp-…",
  "motivo": "Fora do tema"
}
```
