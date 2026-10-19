# `definirPreferenciaForum`

[← Índice de APIs](../README.md) · Módulo: [Comunidade](../README.md#comunidade)

| | |
|---|---|
| Server function | `definirPreferenciaForumFn` em [`src/api/comunidade.functions.ts`](../../../src/api/comunidade.functions.ts) |
| Uso no navegador | `definirPreferenciaForum(…)` |
| Método | `POST` |
| Acesso | Quem vê o fórum |

Segue, silencia ou volta ao padrão de notificações de um fórum.

## Entrada

| Campo | Tipo | Observação |
|---|---|---|
| `forumId` | string |  |
| `modo` | "seguir" \| "silenciar" \| "padrao" |  |

## Regras

- Seguir: notifica cada publicação nova. Publicações importantes notificam sempre, salvo silêncio geral da comunidade.

## Resposta

`void`.

## Erros

Mensagens que chegam ao navegador em `error.message` (regras de negócio):

- Conteúdo indisponível ou você não tem acesso a ele.
- Entre na sua conta para continuar.

## Exemplo

```ts
import { definirPreferenciaForum } from "@/api/comunidade.functions";

await definirPreferenciaForum("for-geral-mv76", "seguir");
```

`data` enviado à server function (`definirPreferenciaForumFn({ data })`):

```json
{
  "forumId": "for-geral-mv76",
  "modo": "seguir"
}
```

Resultado devolvido pela chamada:

```json
null
```
