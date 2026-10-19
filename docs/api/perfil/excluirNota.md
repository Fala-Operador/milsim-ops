# `excluirNota`

[← Índice de APIs](../README.md) · Módulo: [Perfil do operador](../README.md#perfil)

| | |
|---|---|
| Server function | `excluirNotaFn` em [`src/api/perfil.functions.ts`](../../../src/api/perfil.functions.ts) |
| Uso no navegador | `excluirNota(…)` |
| Método | `POST` |
| Acesso | Dono do equipamento |

Apaga a nota fiscal do equipamento (arquivo e metadados).

## Entrada

| Campo | Tipo | Observação |
|---|---|---|
| `equipamentoId` | string |  |

## Resposta

`void`.

## Erros

Mensagens que chegam ao navegador em `error.message` (regras de negócio):

- Documento não encontrado.
- Equipamento não encontrado.
- Entre na sua conta para continuar.

## Exemplo

```ts
import { excluirNota } from "@/api/perfil.functions";

await excluirNota("eqp-7h2k");
```

`data` enviado à server function (`excluirNotaFn({ data })`):

```json
{
  "equipamentoId": "eqp-7h2k"
}
```

Resultado devolvido pela chamada:

```json
null
```
