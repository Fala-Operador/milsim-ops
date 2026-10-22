# `entrarNoForum`

[← Índice de APIs](../README.md) · Módulo: [Comunidade geral](../README.md#social)

| | |
|---|---|
| Server function | `entrarNoForumFn` em [`src/api/social.functions.ts`](../../../src/api/social.functions.ts) |
| Uso no navegador | `entrarNoForum(…)` |
| Método | `POST` |
| Acesso | Qualquer pessoa autenticada e ativa |

Entra num fórum público ou pede para entrar num privado.

## Entrada

| Campo | Tipo | Observação |
|---|---|---|
| `forumId` | string |  |

## Regras

- Público: aprovado na hora.
- Privado: pedido pendente; dono e moderadores são notificados.
- Já participando: devolve a situação atual.

## Resposta

`"aprovado"` ou `"pendente"`.

## Erros

Mensagens que chegam ao navegador em `error.message` (regras de negócio):

- Fórum indisponível.
- Entre na sua conta para continuar.

## Exemplo

```ts
import { entrarNoForum } from "@/api/social.functions";

await entrarNoForum("frm-…");
```

`data` enviado à server function (`entrarNoForumFn({ data })`):

```json
{
  "forumId": "frm-…"
}
```
