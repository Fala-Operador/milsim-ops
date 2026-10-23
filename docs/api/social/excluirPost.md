# `excluirPost`

[← Índice de APIs](../README.md) · Módulo: [Comunidade geral](../README.md#social)

| | |
|---|---|
| Server function | `excluirPostFn` em [`src/api/social.functions.ts`](../../../src/api/social.functions.ts) |
| Uso no navegador | `excluirPost(…)` |
| Método | `POST` |
| Acesso | Autor da publicação |

Exclui a própria publicação (some do feed e do perfil).

## Entrada

| Campo | Tipo | Observação |
|---|---|---|
| `postId` | string |  |

## Regras

- Marca como `removido`; as respostas de outras pessoas continuam no banco.

## Resposta

`null`.

## Erros

Mensagens que chegam ao navegador em `error.message` (regras de negócio):

- Publicação indisponível.
- Entre na sua conta para continuar.

## Exemplo

```ts
import { excluirPost } from "@/api/social.functions";

await excluirPost("sp-…");
```

`data` enviado à server function (`excluirPostFn({ data })`):

```json
{
  "postId": "sp-…"
}
```
