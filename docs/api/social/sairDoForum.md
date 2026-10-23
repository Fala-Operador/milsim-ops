# `sairDoForum`

[← Índice de APIs](../README.md) · Módulo: [Comunidade geral](../README.md#social)

| | |
|---|---|
| Server function | `sairDoForumFn` em [`src/api/social.functions.ts`](../../../src/api/social.functions.ts) |
| Uso no navegador | `sairDoForum(…)` |
| Método | `POST` |
| Acesso | Membro (ou quem pediu para entrar) |

Sai do fórum ou cancela o pedido para entrar.

## Entrada

| Campo | Tipo | Observação |
|---|---|---|
| `forumId` | string |  |

## Regras

- O dono não sai: arquiva o fórum.

## Resposta

`null`.

## Erros

Mensagens que chegam ao navegador em `error.message` (regras de negócio):

- O dono não pode sair do fórum. Arquive o fórum se quiser encerrá-lo.
- Entre na sua conta para continuar.

## Exemplo

```ts
import { sairDoForum } from "@/api/social.functions";

await sairDoForum("frm-…");
```

`data` enviado à server function (`sairDoForumFn({ data })`):

```json
{
  "forumId": "frm-…"
}
```
