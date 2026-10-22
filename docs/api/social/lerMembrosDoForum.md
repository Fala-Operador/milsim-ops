# `lerMembrosDoForum`

[← Índice de APIs](../README.md) · Módulo: [Comunidade geral](../README.md#social)

| | |
|---|---|
| Server function | `membrosDoForumFn` em [`src/api/social.functions.ts`](../../../src/api/social.functions.ts) |
| Uso no navegador | `lerMembrosDoForum(…)` |
| Método | `POST` |
| Acesso | Membros aprovados: quem lê o fórum; pedidos: dono e moderadores |

Membros aprovados ou pedidos pendentes de um fórum.

## Entrada

| Campo | Tipo | Observação |
|---|---|---|
| `forumId` | string |  |
| `situacao` | "aprovado" \| "pendente" |  |

## Regras

- Ordem: dono, moderadores, membros.

## Resposta

`MembroForumDTO[]`.

## Erros

Mensagens que chegam ao navegador em `error.message` (regras de negócio):

- Fórum indisponível.
- Fórum privado: só membros aprovados veem os membros.
- Só o dono e os moderadores do fórum podem fazer isso.
- Entre na sua conta para continuar.

## Exemplo

```ts
import { lerMembrosDoForum } from "@/api/social.functions";

await lerMembrosDoForum("frm-…", "pendente");
```

`data` enviado à server function (`membrosDoForumFn({ data })`):

```json
{
  "forumId": "frm-…",
  "situacao": "pendente"
}
```
