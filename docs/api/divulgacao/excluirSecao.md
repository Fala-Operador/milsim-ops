# `excluirSecao`

[← Índice de APIs](../README.md) · Módulo: [Página inicial](../README.md#divulgacao)

| | |
|---|---|
| Server function | `excluirSecaoFn` em [`src/api/divulgacao.functions.ts`](../../../src/api/divulgacao.functions.ts) |
| Uso no navegador | `excluirSecao(…)` |
| Método | `POST` |
| Acesso | Somente admin |

Exclui uma seção da página inicial.

## Entrada

| Campo | Tipo | Observação |
|---|---|---|
| `id` | string |  |

## Regras

- Auditado.

## Resposta

`void`.

## Erros

Mensagens que chegam ao navegador em `error.message` (regras de negócio):

- Somente administradores gerenciam a página inicial.
- Entre na sua conta para continuar.

## Exemplo

```ts
import { excluirSecao } from "@/api/divulgacao.functions";

await excluirSecao("sec-nordeste");
```

`data` enviado à server function (`excluirSecaoFn({ data })`):

```json
{
  "id": "sec-nordeste"
}
```

Resultado devolvido pela chamada:

```json
null
```
