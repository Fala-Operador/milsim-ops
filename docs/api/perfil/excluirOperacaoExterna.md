# `excluirOperacaoExterna`

[← Índice de APIs](../README.md) · Módulo: [Perfil do operador](../README.md#perfil)

| | |
|---|---|
| Server function | `excluirOperacaoExternaFn` em [`src/api/perfil.functions.ts`](../../../src/api/perfil.functions.ts) |
| Uso no navegador | `excluirOperacaoExterna(…)` |
| Método | `POST` |
| Acesso | Dono do perfil (a própria conta) |

Exclui uma operação registrada fora da plataforma.

## Entrada

| Campo | Tipo | Observação |
|---|---|---|
| `id` | string |  |

## Regras

- Só a própria conta.

## Resposta

`void`.

## Erros

Mensagens que chegam ao navegador em `error.message` (regras de negócio):

- Operação não encontrada.
- Entre na sua conta para continuar.

## Exemplo

```ts
import { excluirOperacaoExterna } from "@/api/perfil.functions";

await excluirOperacaoExterna("opx-mv9k2a1b-x7q2");
```

`data` enviado à server function (`excluirOperacaoExternaFn({ data })`):

```json
{
  "id": "opx-mv9k2a1b-x7q2"
}
```

Resultado devolvido pela chamada:

```json
null
```
