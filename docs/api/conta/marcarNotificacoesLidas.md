# `marcarNotificacoesLidas`

[← Índice de APIs](../README.md) · Módulo: [Conta](../README.md#conta)

| | |
|---|---|
| Server function | `marcarNotificacoesLidasFn` em [`src/api/conta.functions.ts`](../../../src/api/conta.functions.ts) |
| Uso no navegador | `marcarNotificacoesLidas(…)` |
| Método | `POST` |
| Acesso | Qualquer pessoa autenticada e ativa |

Marca todas as notificações da pessoa como lidas. Com `plataforma: true` (admin), marca também as notificações da plataforma.

## Entrada

| Campo | Tipo | Observação |
|---|---|---|
| `plataforma` | boolean | Padrão `false`. |

## Regras

- `plataforma: true` exige perfil admin.

## Resposta

`void`.

## Erros

Mensagens que chegam ao navegador em `error.message` (regras de negócio):

- Apenas administradores.
- Entre na sua conta para continuar.

## Exemplo

```ts
import { marcarNotificacoesLidas } from "@/api/conta.functions";

await marcarNotificacoesLidas();
```

`data` enviado à server function (`marcarNotificacoesLidasFn({ data })`):

```json
{
  "plataforma": false
}
```

Resultado devolvido pela chamada:

```json
null
```
