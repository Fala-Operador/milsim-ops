# `excluirEquipamento`

[← Índice de APIs](../README.md) · Módulo: [Perfil do operador](../README.md#perfil)

| | |
|---|---|
| Server function | `excluirEquipamentoFn` em [`src/api/perfil.functions.ts`](../../../src/api/perfil.functions.ts) |
| Uso no navegador | `excluirEquipamento(…)` |
| Método | `POST` |
| Acesso | Dono do perfil (a própria conta) |

Exclui um equipamento. A nota fiscal privada é apagada junto.

## Entrada

| Campo | Tipo | Observação |
|---|---|---|
| `id` | string |  |

## Resposta

`void`.

## Erros

Mensagens que chegam ao navegador em `error.message` (regras de negócio):

- Equipamento não encontrado.
- Entre na sua conta para continuar.

## Exemplo

```ts
import { excluirEquipamento } from "@/api/perfil.functions";

await excluirEquipamento("eqp-7h2k");
```

`data` enviado à server function (`excluirEquipamentoFn({ data })`):

```json
{
  "id": "eqp-7h2k"
}
```

Resultado devolvido pela chamada:

```json
null
```
