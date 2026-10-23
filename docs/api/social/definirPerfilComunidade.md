# `definirPerfilComunidade`

[← Índice de APIs](../README.md) · Módulo: [Comunidade geral](../README.md#social)

| | |
|---|---|
| Server function | `definirPerfilComunidadeFn` em [`src/api/social.functions.ts`](../../../src/api/social.functions.ts) |
| Uso no navegador | `definirPerfilComunidade(…)` |
| Método | `POST` |
| Acesso | Qualquer pessoa autenticada e ativa |

Define o perfil na comunidade geral como público ou privado.

## Entrada

| Campo | Tipo | Observação |
|---|---|---|
| `privado` | boolean |  |

## Regras

- Grava na conta (`users.social_private`, dentro da base) e devolve a visão.
- Ao tornar público, os pedidos pendentes são aceitos.

## Resposta

`null` (com a visão atualizada).

## Erros

Mensagens que chegam ao navegador em `error.message` (regras de negócio):

- Entre na sua conta para continuar.

## Exemplo

```ts
import { definirPerfilComunidade } from "@/api/social.functions";

await definirPerfilComunidade(true);
```

`data` enviado à server function (`definirPerfilComunidadeFn({ data })`):

```json
{
  "privado": true
}
```
