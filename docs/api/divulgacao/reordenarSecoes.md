# `reordenarSecoes`

[← Índice de APIs](../README.md) · Módulo: [Página inicial](../README.md#divulgacao)

| | |
|---|---|
| Server function | `reordenarSecoesFn` em [`src/api/divulgacao.functions.ts`](../../../src/api/divulgacao.functions.ts) |
| Uso no navegador | `reordenarSecoes(…)` |
| Método | `POST` |
| Acesso | Somente admin |

Define a ordem das seções na página inicial.

## Entrada

| Campo | Tipo | Observação |
|---|---|---|
| `ids` | string[] (até 200) | Ids na ordem desejada. |

## Resposta

`void`.

## Erros

Mensagens que chegam ao navegador em `error.message` (regras de negócio):

- Somente administradores gerenciam a página inicial.
- Entre na sua conta para continuar.

## Exemplo

```ts
import { reordenarSecoes } from "@/api/divulgacao.functions";

await reordenarSecoes(["sec-destaques", "sec-nordeste", "sec-patrocinadores"]);
```

`data` enviado à server function (`reordenarSecoesFn({ data })`):

```json
{
  "ids": [
    "sec-destaques",
    "sec-nordeste",
    "sec-patrocinadores"
  ]
}
```

Resultado devolvido pela chamada:

```json
null
```
