# `removerMembro`

[← Índice de APIs](../README.md) · Módulo: [Comunidade geral](../README.md#social)

| | |
|---|---|
| Server function | `removerMembroFn` em [`src/api/social.functions.ts`](../../../src/api/social.functions.ts) |
| Uso no navegador | `removerMembro(…)` |
| Método | `POST` |
| Acesso | Dono ou moderador do fórum |

Remove um membro do fórum.

## Entrada

| Campo | Tipo | Observação |
|---|---|---|
| `forumId` | string |  |
| `usuarioId` | string (UUID) |  |

## Regras

- Dono remove moderadores e membros; moderador remove só membros; ninguém remove o dono.

## Resposta

`null`.

## Erros

Mensagens que chegam ao navegador em `error.message` (regras de negócio):

- Só o dono e os moderadores do fórum podem fazer isso.
- Membro não encontrado.
- Você não pode remover este membro.
- Entre na sua conta para continuar.

## Exemplo

```ts
import { removerMembro } from "@/api/social.functions";

await removerMembro("frm-…", "2f0c…");
```

`data` enviado à server function (`removerMembroFn({ data })`):

```json
{
  "forumId": "frm-…",
  "usuarioId": "2f0c…"
}
```
