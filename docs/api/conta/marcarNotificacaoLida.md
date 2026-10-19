# `marcarNotificacaoLida`

[← Índice de APIs](../README.md) · Módulo: [Conta](../README.md#conta)

| | |
|---|---|
| Server function | `marcarNotificacaoLidaFn` em [`src/api/conta.functions.ts`](../../../src/api/conta.functions.ts) |
| Uso no navegador | `marcarNotificacaoLida(…)` |
| Método | `POST` |
| Acesso | Qualquer pessoa autenticada e ativa |

Marca uma notificação da própria pessoa como lida.

## Entrada

| Campo | Tipo | Observação |
|---|---|---|
| `id` | string | Id da notificação. |

## Regras

- Participante e organizador só marcam as próprias notificações (ids de terceiros são ignorados, sem erro); o admin pode marcar qualquer uma.

## Resposta

`void`.

## Erros

Mensagens que chegam ao navegador em `error.message` (regras de negócio):

- Entre na sua conta para continuar.

## Exemplo

```ts
import { marcarNotificacaoLida } from "@/api/conta.functions";

await marcarNotificacaoLida("not-8f2k1");
```

`data` enviado à server function (`marcarNotificacaoLidaFn({ data })`):

```json
{
  "id": "not-8f2k1"
}
```

Resultado devolvido pela chamada:

```json
null
```
