# `excluirParceiro`

[← Índice de APIs](../README.md) · Módulo: [Página inicial](../README.md#divulgacao)

| | |
|---|---|
| Server function | `excluirParceiroFn` em [`src/api/divulgacao.functions.ts`](../../../src/api/divulgacao.functions.ts) |
| Uso no navegador | `excluirParceiro(…)` |
| Método | `POST` |
| Acesso | Somente admin |

Exclui um parceiro (sai também das seções que o usavam).

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
import { excluirParceiro } from "@/api/divulgacao.functions";

await excluirParceiro("par-9");
```

`data` enviado à server function (`excluirParceiroFn({ data })`):

```json
{
  "id": "par-9"
}
```

Resultado devolvido pela chamada:

```json
null
```
