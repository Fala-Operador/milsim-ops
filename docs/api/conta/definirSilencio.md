# `definirSilencio`

[← Índice de APIs](../README.md) · Módulo: [Conta](../README.md#conta)

| | |
|---|---|
| Server function | `definirSilencioFn` em [`src/api/conta.functions.ts`](../../../src/api/conta.functions.ts) |
| Uso no navegador | `definirSilencio(…)` |
| Método | `POST` |
| Acesso | Qualquer pessoa autenticada e ativa |

Silencia notificações: todas (`todas`) ou só as da comunidade (`comunidade`). Envia só o que mudou.

## Entrada

| Campo | Tipo | Observação |
|---|---|---|
| `todas?` | boolean |  |
| `comunidade?` | boolean |  |

## Regras

- Silenciar não apaga notificações; só deixa de criar as novas do tipo silenciado.

## Resposta

`void`.

## Erros

Mensagens que chegam ao navegador em `error.message` (regras de negócio):

- Entre na sua conta para continuar.

## Exemplo

```ts
import { definirSilencio } from "@/api/conta.functions";

await definirSilencio({ comunidade: true });
```

`data` enviado à server function (`definirSilencioFn({ data })`):

```json
{
  "comunidade": true
}
```

Resultado devolvido pela chamada:

```json
null
```
