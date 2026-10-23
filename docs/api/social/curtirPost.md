# `curtirPost`

[← Índice de APIs](../README.md) · Módulo: [Comunidade geral](../README.md#social)

| | |
|---|---|
| Server function | `curtirPostFn` em [`src/api/social.functions.ts`](../../../src/api/social.functions.ts) |
| Uso no navegador | `curtirPost(…)` |
| Método | `POST` |
| Acesso | Qualquer pessoa autenticada e ativa |

Curte ou descurte uma publicação visível.

## Entrada

| Campo | Tipo | Observação |
|---|---|---|
| `postId` | string |  |
| `curtir` | boolean | `false` desfaz. |

## Regras

- Idempotente: curtir duas vezes conta uma.

## Resposta

`null`.

## Erros

Mensagens que chegam ao navegador em `error.message` (regras de negócio):

- Publicação indisponível.
- Entre na sua conta para continuar.

## Exemplo

```ts
import { curtirPost } from "@/api/social.functions";

await curtirPost("sp-…", true);
```

`data` enviado à server function (`curtirPostFn({ data })`):

```json
{
  "postId": "sp-…",
  "curtir": true
}
```
