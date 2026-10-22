# `bloquear`

[← Índice de APIs](../README.md) · Módulo: [Comunidade geral](../README.md#social)

| | |
|---|---|
| Server function | `bloquearFn` em [`src/api/social.functions.ts`](../../../src/api/social.functions.ts) |
| Uso no navegador | `bloquear(…)` |
| Método | `POST` |
| Acesso | Qualquer pessoa autenticada e ativa |

Bloqueia ou desbloqueia uma pessoa na comunidade geral.

## Entrada

| Campo | Tipo | Observação |
|---|---|---|
| `usuarioId` | string (UUID) |  |
| `bloquear` | boolean | `false` desbloqueia. |

## Regras

- Bloquear desfaz o seguir nos dois sentidos e esconde os posts de um para o outro.

## Resposta

`null`.

## Erros

Mensagens que chegam ao navegador em `error.message` (regras de negócio):

- Você não pode bloquear a si mesmo.
- Entre na sua conta para continuar.

## Exemplo

```ts
import { bloquear } from "@/api/social.functions";

await bloquear("2f0c…", true);
```

`data` enviado à server function (`bloquearFn({ data })`):

```json
{
  "usuarioId": "2f0c…",
  "bloquear": true
}
```
