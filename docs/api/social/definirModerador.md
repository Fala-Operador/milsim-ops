# `definirModerador`

[← Índice de APIs](../README.md) · Módulo: [Comunidade geral](../README.md#social)

| | |
|---|---|
| Server function | `definirModeradorFn` em [`src/api/social.functions.ts`](../../../src/api/social.functions.ts) |
| Uso no navegador | `definirModerador(…)` |
| Método | `POST` |
| Acesso | Dono do fórum |

Torna um membro aprovado moderador (ou tira a moderação).

## Entrada

| Campo | Tipo | Observação |
|---|---|---|
| `forumId` | string |  |
| `usuarioId` | string (UUID) |  |
| `moderador` | boolean |  |

## Regras

Sem regras além do acesso.

## Resposta

`null`.

## Erros

Mensagens que chegam ao navegador em `error.message` (regras de negócio):

- Só o dono do fórum nomeia moderadores.
- Membro não encontrado.
- Entre na sua conta para continuar.

## Exemplo

```ts
import { definirModerador } from "@/api/social.functions";

await definirModerador("frm-…", "2f0c…", true);
```

`data` enviado à server function (`definirModeradorFn({ data })`):

```json
{
  "forumId": "frm-…",
  "usuarioId": "2f0c…",
  "moderador": true
}
```
