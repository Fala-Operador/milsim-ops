# `arquivarForum`

[← Índice de APIs](../README.md) · Módulo: [Comunidade geral](../README.md#social)

| | |
|---|---|
| Server function | `arquivarForumFn` em [`src/api/social.functions.ts`](../../../src/api/social.functions.ts) |
| Uso no navegador | `arquivarForum(…)` |
| Método | `POST` |
| Acesso | Dono do fórum ou admin |

Arquiva o fórum: some da lista e ninguém mais lê nem publica.

## Entrada

| Campo | Tipo | Observação |
|---|---|---|
| `forumId` | string |  |

## Regras

- Libera uma das 3 vagas de fórum do dono.

## Resposta

`null`.

## Erros

Mensagens que chegam ao navegador em `error.message` (regras de negócio):

- Só o dono do fórum ou a administração podem arquivar.
- Fórum indisponível.
- Entre na sua conta para continuar.

## Exemplo

```ts
import { arquivarForum } from "@/api/social.functions";

await arquivarForum("frm-…");
```

`data` enviado à server function (`arquivarForumFn({ data })`):

```json
{
  "forumId": "frm-…"
}
```
